from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class TransactionOut(BaseModel):
    id: int
    account_id: int
    date: date
    description: str
    amount: Decimal
    currency: str
    amount_hkd: Decimal | None
    balance_after: Decimal | None
    category_id: int | None
    category_source: str | None
    category_confidence: float | None
    category_name: str | None = None
    transfer_pair_id: int | None = None

    model_config = {"from_attributes": True}


class TransactionUpdate(BaseModel):
    category_id: int | None = None
    category_source: str = "manual"
    is_transfer: bool | None = None


class TransactionPreview(BaseModel):
    date: date
    description: str
    amount: Decimal
    currency: str
    balance_after: Decimal | None = None
