from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.database import get_db
from backend.models import Transaction, Category
from backend.schemas.transaction import TransactionOut, TransactionUpdate

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionOut])
async def list_transactions(
    account_id: int | None = None,
    category_id: int | None = None,
    search: str | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Transaction).options(joinedload(Transaction.category))

    if account_id is not None:
        stmt = stmt.where(Transaction.account_id == account_id)
    if category_id is not None:
        stmt = stmt.where(Transaction.category_id == category_id)
    if search:
        stmt = stmt.where(Transaction.description.ilike(f"%{search}%"))

    stmt = stmt.order_by(Transaction.date.desc(), Transaction.id.desc())
    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    txns = result.scalars().all()

    return [
        TransactionOut(
            id=t.id,
            account_id=t.account_id,
            date=t.date,
            description=t.description,
            amount=t.amount,
            currency=t.currency,
            amount_hkd=t.amount_hkd,
            balance_after=t.balance_after,
            category_id=t.category_id,
            category_source=t.category_source,
            category_confidence=t.category_confidence,
            category_name=t.category.name if t.category else None,
        )
        for t in txns
    ]


@router.patch("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    transaction_id: int,
    update: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(Transaction.id == transaction_id)
    )
    txn = result.scalar_one_or_none()
    if txn is None:
        raise HTTPException(404, "Transaction not found")

    if update.category_id is not None:
        txn.category_id = update.category_id
        txn.category_source = update.category_source
        txn.category_confidence = 1.0 if update.category_source == "manual" else None

    await db.commit()
    await db.refresh(txn, ["category"])

    return TransactionOut(
        id=txn.id,
        account_id=txn.account_id,
        date=txn.date,
        description=txn.description,
        amount=txn.amount,
        currency=txn.currency,
        amount_hkd=txn.amount_hkd,
        balance_after=txn.balance_after,
        category_id=txn.category_id,
        category_source=txn.category_source,
        category_confidence=txn.category_confidence,
        category_name=txn.category.name if txn.category else None,
    )
