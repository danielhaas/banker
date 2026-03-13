import asyncio
import hashlib
import logging
import shutil
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.models import Account, Bank, StatementImport, Transaction
from backend.parsers import registry
from backend.parsers.base import ParsedStatement

logger = logging.getLogger(__name__)

# Serialize DB writes to avoid SQLite locking
_db_write_lock = asyncio.Lock()


async def get_or_create_bank(db: AsyncSession, bank_code: str, bank_name: str, country: str) -> Bank:
    result = await db.execute(select(Bank).where(Bank.code == bank_code))
    bank = result.scalar_one_or_none()
    if bank is None:
        bank = Bank(code=bank_code, name=bank_name, country=country)
        db.add(bank)
        await db.flush()
    return bank


async def get_or_create_account(
    db: AsyncSession, bank_id: int, parsed: ParsedStatement
) -> Account:
    stmt = select(Account).where(
        Account.bank_id == bank_id,
        Account.account_type == parsed.account_type,
    )
    if parsed.account_number:
        stmt = stmt.where(Account.account_number == parsed.account_number)
    result = await db.execute(stmt)
    account = result.scalars().first()
    if account is None:
        default_name = f"{parsed.bank_code} {'Credit Card' if parsed.account_type == 'credit_card' else 'Account'}"
        account = Account(
            bank_id=bank_id,
            name=parsed.account_name or default_name,
            account_number=parsed.account_number,
            currency=parsed.currency,
            account_type=parsed.account_type,
        )
        db.add(account)
        await db.flush()
    return account


def compute_file_hash(file_path: Path) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


async def check_duplicate(db: AsyncSession, file_hash: str) -> StatementImport | None:
    """Return an existing confirmed import with this hash, or None."""
    result = await db.execute(
        select(StatementImport).where(
            StatementImport.file_hash == file_hash,
            StatementImport.status == "confirmed",
        )
    )
    return result.scalar_one_or_none()


async def cleanup_pending(db: AsyncSession, file_hash: str) -> None:
    """Delete any stale pending imports for this file so re-upload works."""
    result = await db.execute(
        select(StatementImport).where(
            StatementImport.file_hash == file_hash,
            StatementImport.status == "pending",
        )
    )
    for si in result.scalars().all():
        # Remove stored PDF if it exists
        if si.stored_path:
            Path(si.stored_path).unlink(missing_ok=True)
        await db.delete(si)
    await db.flush()


def store_pdf(
    file_path: Path,
    bank_code: str,
    account_id: int,
    filename: str,
    file_hash: str,
    transactions: list,
) -> str:
    """Copy PDF to data/statements/{bank}/{account_id}/{YYYY-MM}/{name}_{hash8}.pdf"""
    from datetime import date as date_type

    # Derive month from earliest transaction, fall back to current date
    if transactions:
        dates = [t["date"] if isinstance(t, dict) else t.date for t in transactions]
        earliest = min(dates)
        if isinstance(earliest, str):
            earliest = date_type.fromisoformat(earliest)
        month_dir = earliest.strftime("%Y-%m")
    else:
        month_dir = date_type.today().strftime("%Y-%m")

    short_hash = file_hash[:8]
    stem = Path(filename).stem
    safe_name = f"{stem}_{short_hash}.pdf"

    dest_dir = Path(settings.data_dir) / "statements" / bank_code / str(account_id) / month_dir
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / safe_name

    shutil.copy2(file_path, dest)
    return str(dest)


async def upload_statement(db: AsyncSession, file_path: Path, filename: str) -> dict:
    """Parse a statement file and create a pending import."""
    parser = registry.find_parser(file_path)
    if parser is None:
        raise ValueError("No parser found for this file. Supported banks: HSBC HK")

    # Do heavy work (hashing + PDF parsing) outside the DB lock
    file_hash = compute_file_hash(file_path)
    parsed = parser.parse(file_path)

    # Serialize all DB writes to avoid SQLite locking errors
    async with _db_write_lock:
        if await check_duplicate(db, file_hash):
            return {"duplicate": True, "filename": filename}

        # Clean up stale pending imports (best-effort)
        try:
            await cleanup_pending(db, file_hash)
        except Exception:
            logger.debug("cleanup_pending failed, continuing", exc_info=True)

        bank = await get_or_create_bank(db, parser.bank_code, parser.bank_name, parser.country)
        account = await get_or_create_account(db, bank.id, parsed)

        statement_import = StatementImport(
            account_id=account.id,
            filename=filename,
            file_hash=file_hash,
            bank_code=parser.bank_code,
            status="pending",
            transaction_count=len(parsed.transactions),
        )
        db.add(statement_import)
        await db.flush()
        await db.commit()

    return {
        "duplicate": False,
        "import_id": statement_import.id,
        "account_id": account.id,
        "bank_code": parser.bank_code,
        "template": parsed.template,
        "file_hash": file_hash,
        "filename": filename,
        "transactions": [
            {
                "date": t.date,
                "description": t.description,
                "amount": t.amount,
                "currency": t.currency,
                "balance_after": t.balance_after,
            }
            for t in parsed.transactions
        ],
    }


async def confirm_import(db: AsyncSession, import_id: int, stored_path: str) -> dict:
    """Confirm a pending import and save the stored PDF path."""
    result = await db.execute(
        select(StatementImport).where(StatementImport.id == import_id)
    )
    stmt_import = result.scalar_one_or_none()
    if stmt_import is None:
        raise ValueError("Import not found")
    if stmt_import.status != "pending":
        raise ValueError(f"Import is already {stmt_import.status}")

    stmt_import.status = "confirmed"
    stmt_import.stored_path = stored_path

    return {
        "import_id": stmt_import.id,
        "transaction_count": stmt_import.transaction_count,
        "status": "confirmed",
    }


async def create_transactions_from_preview(
    db: AsyncSession, import_id: int, account_id: int, transactions: list[dict]
) -> int:
    """Create transaction records from preview data."""
    count = 0
    for t in transactions:
        txn = Transaction(
            account_id=account_id,
            date=t["date"],
            description=t["description"],
            amount=t["amount"],
            currency=t["currency"],
            balance_after=t.get("balance_after"),
            statement_import_id=import_id,
        )
        db.add(txn)
        count += 1
    await db.flush()
    return count
