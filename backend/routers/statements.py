import logging
import shutil
import tempfile
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.database import get_db
from backend.models import StatementImport, Account, Bank, Transaction
from backend.schemas.statement import AccountCoverage, ConfirmRequest, ConfirmResponse, StatementImportOut, UploadResponse
from backend.services.import_service import (
    _db_write_lock,
    confirm_import,
    create_transactions_from_preview,
    store_pdf,
    upload_statement,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/statements", tags=["statements"])

# In-memory cache per import_id: parsed data + temp file path for confirm step
_preview_cache: dict[int, dict] = {}


@router.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile, db: AsyncSession = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        result = await upload_statement(db, tmp_path, file.filename)
    except ValueError as e:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(400, str(e))
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        logger.exception("Upload failed for %s", file.filename)
        raise HTTPException(500, f"Upload failed: {e}")

    if result.get("duplicate"):
        tmp_path.unlink(missing_ok=True)
        return UploadResponse(
            import_id=0,
            account_id=0,
            bank_code="",
            filename=result["filename"],
            transactions=[],
            duplicate=True,
        )

    # Keep the temp file for the confirm step (where we store it permanently)
    result["tmp_path"] = str(tmp_path)
    _preview_cache[result["import_id"]] = result

    return UploadResponse(
        import_id=result["import_id"],
        account_id=result["account_id"],
        bank_code=result["bank_code"],
        template=result.get("template", ""),
        filename=result["filename"],
        transactions=result["transactions"],
    )


@router.get("", response_model=list[StatementImportOut])
async def list_statements(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StatementImport)
        .options(joinedload(StatementImport.account).joinedload(Account.bank))
        .order_by(StatementImport.created_at.desc())
    )
    imports = result.scalars().unique().all()
    return [
        StatementImportOut(
            id=si.id,
            filename=si.filename,
            bank_code=si.bank_code,
            bank_name=si.account.bank.name if si.account and si.account.bank else si.bank_code,
            account_name=si.account.name if si.account else "",
            status=si.status,
            transaction_count=si.transaction_count,
            stored_path=si.stored_path,
            created_at=si.created_at.isoformat(),
        )
        for si in imports
    ]


@router.get("/{statement_id}/pdf")
async def get_pdf(statement_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StatementImport).where(StatementImport.id == statement_id)
    )
    si = result.scalar_one_or_none()
    if si is None:
        raise HTTPException(404, "Statement not found")
    if not si.stored_path:
        raise HTTPException(404, "PDF file not available")
    pdf_path = Path(si.stored_path)
    if not pdf_path.exists():
        raise HTTPException(404, "PDF file missing from disk")
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{si.filename}"'},
    )


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm(req: ConfirmRequest, db: AsyncSession = Depends(get_db)):
    cached = _preview_cache.pop(req.import_id, None)
    if cached is None:
        raise HTTPException(400, "No pending import found. Please re-upload.")

    tmp_path = Path(cached["tmp_path"])
    try:
        # Store PDF permanently now that user confirmed
        stored_path = store_pdf(
            tmp_path,
            cached["bank_code"],
            cached["account_id"],
            cached["filename"],
            cached["file_hash"],
            cached["transactions"],
        )
        async with _db_write_lock:
            count = await create_transactions_from_preview(
                db, req.import_id, cached["account_id"], cached["transactions"],
                sub_accounts=cached.get("sub_accounts"),
            )
            result = await confirm_import(db, req.import_id, stored_path)
            await db.commit()
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        tmp_path.unlink(missing_ok=True)

    return ConfirmResponse(
        import_id=result["import_id"],
        transaction_count=count,
        status=result["status"],
    )


@router.get("/coverage", response_model=list[AccountCoverage])
async def statement_coverage(db: AsyncSession = Depends(get_db)):
    """For each account, show which months have statements and which are missing."""
    # Get distinct year-months per account from transactions
    result = await db.execute(
        select(
            Transaction.account_id,
            func.strftime("%Y-%m", Transaction.date).label("month"),
        )
        .where(Transaction.statement_import_id.is_not(None))
        .group_by(Transaction.account_id, "month")
    )
    # Build {account_id: set of months}
    account_months: dict[int, set[str]] = {}
    for row in result.all():
        account_months.setdefault(row.account_id, set()).add(row.month)

    if not account_months:
        return []

    # Load accounts with bank info
    acct_result = await db.execute(
        select(Account)
        .options(joinedload(Account.bank))
        .where(Account.id.in_(account_months.keys()))
    )
    accounts = {a.id: a for a in acct_result.scalars().unique().all()}

    coverages = []
    for account_id, months in account_months.items():
        acct = accounts.get(account_id)
        if not acct:
            continue

        sorted_months = sorted(months)
        first = sorted_months[0]
        last = sorted_months[-1]

        # Generate all months in range
        fy, fm = int(first[:4]), int(first[5:7])
        ly, lm = int(last[:4]), int(last[5:7])
        all_months = []
        y, m = fy, fm
        while (y, m) <= (ly, lm):
            all_months.append(f"{y:04d}-{m:02d}")
            m += 1
            if m > 12:
                m = 1
                y += 1

        missing = [mo for mo in all_months if mo not in months]

        coverages.append(AccountCoverage(
            account_id=account_id,
            account_name=acct.name,
            bank_name=acct.bank.name if acct.bank else acct.account_number or "",
            months_present=sorted_months,
            months_missing=missing,
            first_month=first,
            last_month=last,
        ))

    return sorted(coverages, key=lambda c: c.account_name)
