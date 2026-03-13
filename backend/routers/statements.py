import logging
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.database import get_db
from backend.models import StatementImport, Account, Bank
from backend.schemas.statement import ConfirmRequest, ConfirmResponse, StatementImportOut, UploadResponse
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
                db, req.import_id, cached["account_id"], cached["transactions"]
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
