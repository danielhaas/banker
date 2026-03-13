"""
Template for adding a new bank parser.

1. Copy this file and rename to your_bank.py
2. Implement can_parse() and parse() methods
3. The @register decorator auto-registers the parser
"""

# from pathlib import Path
# from backend.parsers.base import BankStatementParser, ParsedStatement
# from backend.parsers.registry import register
#
#
# @register
# class YourBankParser(BankStatementParser):
#     bank_code = "your_bank"
#     bank_name = "Your Bank Name"
#     country = "XX"
#
#     def can_parse(self, file_path: Path) -> bool:
#         ...
#
#     def parse(self, file_path: Path) -> ParsedStatement:
#         ...
