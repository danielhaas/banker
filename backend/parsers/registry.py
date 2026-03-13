import importlib
import pkgutil
from pathlib import Path

from backend.parsers.base import BankStatementParser

_parsers: list[BankStatementParser] = []


def register(cls: type[BankStatementParser]) -> type[BankStatementParser]:
    """Decorator to register a bank statement parser."""
    _parsers.append(cls())
    return cls


def _discover():
    """Auto-discover all parser modules in the banks/ directory."""
    banks_path = Path(__file__).parent / "banks"
    for module_info in pkgutil.iter_modules([str(banks_path)]):
        if not module_info.name.startswith("_"):
            importlib.import_module(f"backend.parsers.banks.{module_info.name}")


class ParserRegistry:
    def __init__(self):
        self._discovered = False

    def _ensure_discovered(self):
        if not self._discovered:
            _discover()
            self._discovered = True

    def find_parser(self, file_path: Path) -> BankStatementParser | None:
        self._ensure_discovered()
        for parser in _parsers:
            if parser.can_parse(file_path):
                return parser
        return None

    def get_parsers(self) -> list[BankStatementParser]:
        self._ensure_discovered()
        return list(_parsers)


registry = ParserRegistry()
