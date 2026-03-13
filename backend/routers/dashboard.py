from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Account, Bank, Category, Transaction
from backend.schemas.dashboard import AccountBalance, DashboardSummary, SpendingByCategory

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def summary(db: AsyncSession = Depends(get_db)):
    # Get latest balance per account from most recent transaction
    accounts_result = await db.execute(select(Account).join(Bank))
    accounts = accounts_result.scalars().all()

    balances = []
    net_worth_hkd = Decimal(0)

    for account in accounts:
        # Get most recent transaction with a balance
        txn_result = await db.execute(
            select(Transaction)
            .where(Transaction.account_id == account.id)
            .where(Transaction.balance_after.is_not(None))
            .order_by(Transaction.date.desc(), Transaction.id.desc())
            .limit(1)
        )
        latest = txn_result.scalar_one_or_none()
        balance = latest.balance_after if latest else Decimal(0)

        # Load bank name
        bank_result = await db.execute(select(Bank).where(Bank.id == account.bank_id))
        bank = bank_result.scalar_one()

        balances.append(
            AccountBalance(
                account_id=account.id,
                account_name=account.name,
                bank_name=bank.name,
                currency=account.currency,
                balance=balance,
            )
        )

        # For now, assume HKD (exchange rates come in Phase 3)
        if account.currency == "HKD":
            net_worth_hkd += balance

    return DashboardSummary(balances=balances, net_worth_hkd=net_worth_hkd)


@router.get("/spending", response_model=list[SpendingByCategory])
async def spending(
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            Transaction.category_id,
            func.sum(Transaction.amount).label("total"),
            func.count().label("count"),
        )
        .where(Transaction.amount < 0)  # Only spending (negative amounts)
        .group_by(Transaction.category_id)
    )

    if start_date:
        stmt = stmt.where(Transaction.date >= start_date)
    if end_date:
        stmt = stmt.where(Transaction.date <= end_date)
    if account_id:
        stmt = stmt.where(Transaction.account_id == account_id)

    result = await db.execute(stmt)
    rows = result.all()

    spending_list = []
    for row in rows:
        cat_name = "Uncategorized"
        if row.category_id:
            cat_result = await db.execute(
                select(Category).where(Category.id == row.category_id)
            )
            cat = cat_result.scalar_one_or_none()
            if cat:
                cat_name = cat.name

        spending_list.append(
            SpendingByCategory(
                category_id=row.category_id,
                category_name=cat_name,
                total=abs(row.total),
                count=row.count,
            )
        )

    return sorted(spending_list, key=lambda x: x.total, reverse=True)
