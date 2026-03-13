from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path


@dataclass
class ParsedTransaction:
    date: date
    description: str
    amount: Decimal
    currency: str = "HKD"
    balance_after: Decimal | None = None


@dataclass
class ParsedStatement:
    bank_code: str
    account_number: str | None
    account_name: str | None
    currency: str
    template: str = ""  # e.g. "bank_statement", "credit_card"
    account_type: str = "checking"  # checking, savings, credit_card
    transactions: list[ParsedTransaction] = field(default_factory=list)


class BankStatementParser(ABC):
    bank_code: str
    bank_name: str
    country: str

    @abstractmethod
    def can_parse(self, file_path: Path) -> bool:
        """Check if this parser can handle the given file."""
        ...

    @abstractmethod
    def parse(self, file_path: Path) -> ParsedStatement:
        """Parse the file and return structured statement data."""
        ...
