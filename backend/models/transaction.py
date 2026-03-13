from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin


class Transaction(Base, TimestampMixin):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="HKD")
    amount_hkd: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    balance_after: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    category_source: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # manual, ai, rule
    category_confidence: Mapped[float | None] = mapped_column(nullable=True)
    statement_import_id: Mapped[int | None] = mapped_column(
        ForeignKey("statement_imports.id"), nullable=True
    )
    transfer_pair_id: Mapped[int | None] = mapped_column(
        ForeignKey("transactions.id"), nullable=True
    )  # links to the matching transaction in another account

    account: Mapped["Account"] = relationship(back_populates="transactions")
    category: Mapped["Category | None"] = relationship(back_populates="transactions")
    statement_import: Mapped["StatementImport | None"] = relationship(
        back_populates="transactions"
    )
