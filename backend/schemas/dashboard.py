from decimal import Decimal

from pydantic import BaseModel


class AccountBalance(BaseModel):
    account_id: int
    account_name: str
    account_number: str | None
    account_type: str
    bank_name: str
    currency: str
    balance: Decimal


class DashboardSummary(BaseModel):
    balances: list[AccountBalance]
    net_worth_hkd: Decimal


class SpendingByCategory(BaseModel):
    category_id: int | None
    category_name: str
    total: Decimal
    count: int


class MonthlyFlow(BaseModel):
    month: str  # YYYY-MM
    income: Decimal
    expense: Decimal
