from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base, TimestampMixin


class ExchangeRate(Base, TimestampMixin):
    __tablename__ = "exchange_rates"
    __table_args__ = (UniqueConstraint("base_currency", "quote_currency", "rate_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    base_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    quote_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False)
    rate_date: Mapped[date] = mapped_column(Date, nullable=False)
