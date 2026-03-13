from pydantic import BaseModel

from backend.schemas.transaction import TransactionPreview


class UploadResponse(BaseModel):
    import_id: int
    account_id: int
    bank_code: str
    template: str = ""
    filename: str
    transactions: list[TransactionPreview]
    duplicate: bool = False


class ConfirmRequest(BaseModel):
    import_id: int


class ConfirmResponse(BaseModel):
    import_id: int
    transaction_count: int
    status: str


class StatementImportOut(BaseModel):
    id: int
    filename: str
    bank_code: str
    bank_name: str
    account_name: str
    status: str
    transaction_count: int
    stored_path: str | None
    created_at: str


class AccountCoverage(BaseModel):
    account_id: int
    account_name: str
    bank_name: str
    months_present: list[str]  # ["2025-01", "2025-02", ...]
    months_missing: list[str]  # ["2025-03", ...]
    first_month: str
    last_month: str
