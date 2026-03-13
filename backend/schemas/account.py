from pydantic import BaseModel


class AccountCreate(BaseModel):
    bank_id: int
    name: str
    account_number: str | None = None
    currency: str = "HKD"
    account_type: str = "checking"


class AccountOut(BaseModel):
    id: int
    bank_id: int
    name: str
    account_number: str | None
    currency: str
    account_type: str

    model_config = {"from_attributes": True}


class BankOut(BaseModel):
    id: int
    code: str
    name: str
    country: str

    model_config = {"from_attributes": True}
