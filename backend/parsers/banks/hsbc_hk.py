import re
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import pdfplumber

from backend.parsers.base import BankStatementParser, ParsedStatement, ParsedSubAccount, ParsedTransaction
from backend.parsers.registry import register

# Keywords that identify each template
_CREDIT_CARD_KEYWORDS = ["Post date Trans date Description of transaction"]
_PREMIER_STATEMENT_KEYWORDS = ["Account Transaction History", "Personal Integrated Account"]
_BANK_STATEMENT_KEYWORDS = ["Statement of Account", "Integrated Account", "Savings Account"]


def _detect_template(text: str) -> str | None:
    """Identify document template from first-page text."""
    lower = text.lower()
    for kw in _CREDIT_CARD_KEYWORDS:
        if kw.lower() in lower:
            return "credit_card"
    for kw in _PREMIER_STATEMENT_KEYWORDS:
        if kw.lower() in lower:
            return "premier_statement"
    for kw in _BANK_STATEMENT_KEYWORDS:
        if kw.lower() in lower:
            return "bank_statement"
    return None


def _extract_statement_date(text: str) -> date | None:
    """Extract the statement date from various HSBC statement formats."""
    # Credit card format: "Statement date\nDD MON YYYY" (e.g. "15 JAN 2026")
    match = re.search(r"Statement date\s+.*?\n(\d{1,2}\s+[A-Z]{3}\s+\d{4})", text)
    if match:
        try:
            return datetime.strptime(match.group(1), "%d %b %Y").date()
        except ValueError:
            pass
    # Premier statement format: "DD Month YYYY" (e.g. "17 January 2026")
    match = re.search(r"(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})", text)
    if match:
        try:
            return datetime.strptime(match.group(1), "%d %B %Y").date()
        except ValueError:
            pass
    return None


def _extract_year(text: str) -> int:
    year_match = re.search(r"20[2-3]\d", text)
    if year_match:
        return int(year_match.group(0))
    return datetime.now().year


def _parse_date(date_str: str, year: int) -> date | None:
    """Parse date in 'DD Mon' or 'DDMON' format."""
    # Try "DD Mon" (bank statement)
    try:
        return datetime.strptime(f"{date_str} {year}", "%d %b %Y").date()
    except ValueError:
        pass
    # Try "DDMON" (credit card) - e.g. "17DEC"
    try:
        return datetime.strptime(f"{date_str} {year}", "%d%b %Y").date()
    except ValueError:
        return None


def _parse_cc_date(date_str: str, statement_date: date) -> date | None:
    """Parse credit card date with correct year handling across year boundaries."""
    try:
        parsed = datetime.strptime(date_str, "%d%b").date()
    except ValueError:
        return None
    # Assign year: if parsed month > statement month, it's from previous year
    result = parsed.replace(year=statement_date.year)
    if result > statement_date:
        result = result.replace(year=statement_date.year - 1)
    return result


def _detect_currency(text: str) -> str:
    if "USD" in text and "HKD" not in text:
        return "USD"
    return "HKD"


def _extract_account_number(text: str) -> str | None:
    # Try "Account Number : NNN-NNNNNN-NNN" or "Account No: ..."
    match = re.search(r"Account\s*(?:Number|No\.?)\s*:?\s*([\d-]+)", text, re.I)
    if match:
        return match.group(1).strip()
    # Try "Number : NNN-NNNNNN-NNN" (premier statement format)
    match = re.search(r"Number\s*:\s*([\d-]+)", text)
    if match:
        return match.group(1).strip()
    return None


def _extract_card_number(text: str) -> str | None:
    """Extract last 4 digits of card number."""
    match = re.search(r"Card\s*(?:Number|No\.?)\s*:?\s*[\d*\s-]*(\d{4})", text, re.I)
    if match:
        return f"****{match.group(1)}"
    # Also try patterns like "4532 **** **** 1234"
    match = re.search(r"\d{4}\s*\*{4}\s*\*{4}\s*(\d{4})", text)
    if match:
        return f"****{match.group(1)}"
    return None


def _parse_bank_statement(full_text: str, year: int, currency: str) -> list[ParsedTransaction]:
    """Parse HSBC HK bank statement (checking/savings) transactions."""
    transactions: list[ParsedTransaction] = []

    # Format: DD Mon [DD Mon] description amount [CR] [balance]
    txn_pattern = re.compile(
        r"(\d{2}\s+\w{3})\s+"  # date: DD Mon
        r"(\d{2}\s+\w{3}\s+)?"  # optional posting date
        r"(.+?)\s+"  # description
        r"([\d,]+\.\d{2})\s*"  # amount
        r"(?:(CR)\s*)?"  # optional CR indicator
        r"([\d,]+\.\d{2})?\s*$",  # optional balance
        re.MULTILINE,
    )

    for match in txn_pattern.finditer(full_text):
        txn_date = _parse_date(match.group(1).strip(), year)
        if txn_date is None:
            continue

        desc = match.group(3).strip()
        amount = Decimal(match.group(4).replace(",", ""))
        if not match.group(5):  # no CR = debit
            amount = -amount

        balance_str = match.group(6)
        balance = Decimal(balance_str.replace(",", "")) if balance_str else None

        transactions.append(
            ParsedTransaction(
                date=txn_date,
                description=desc,
                amount=amount,
                currency=currency,
                balance_after=balance,
            )
        )

    return transactions


def _parse_credit_card(full_text: str, statement_date: date, currency: str) -> list[ParsedTransaction]:
    """Parse HSBC HK credit card statement transactions."""
    transactions: list[ParsedTransaction] = []

    # Skip non-transaction lines
    _SKIP_PREFIXES = (
        "PREVIOUS BALANCE", "STATEMENT BALANCE", "REWARDCASH", "***", "****",
        "*EXCHANGE RATE", "*For credit card", "Note:", "Page ",
    )

    # Format: DDMON DDMON description amount[CR]
    # Foreign currency variant: DDMON DDMON description CC foreign_amount hkd_amount
    txn_pattern = re.compile(
        r"^(\d{2}[A-Z]{3})\s+"  # post date: DDMON
        r"(\d{2}[A-Z]{3})\s+"  # trans date: DDMON
        r"(.+)\s+"  # description (greedy — captures foreign amounts too)
        r"([\d,]+\.\d{2})"  # last amount = HKD amount
        r"(CR)?\s*$",  # optional CR (no space before CR)
        re.MULTILINE,
    )

    for match in txn_pattern.finditer(full_text):
        line = match.group(0)
        # Skip exchange rate lines and other noise
        if any(line.strip().startswith(p) for p in _SKIP_PREFIXES):
            continue

        txn_date = _parse_cc_date(match.group(2).strip(), statement_date)
        if txn_date is None:
            continue

        desc = match.group(3).strip()
        amount = Decimal(match.group(4).replace(",", ""))
        is_credit = match.group(5) is not None

        # Clean up description: remove trailing foreign currency amounts
        # e.g. "SLACK T09BCC3MRNV DUBLIN 1 IE USD 4.54" -> "SLACK T09BCC3MRNV DUBLIN 1 IE"
        desc = re.sub(r"\s+[A-Z]{3}\s+[\d,]+\.\d{2}$", "", desc)

        # For credit cards: charges are negative (spending), payments/credits are positive
        if not is_credit:
            amount = -amount

        transactions.append(
            ParsedTransaction(
                date=txn_date,
                description=desc,
                amount=amount,
                currency=currency,
                balance_after=None,
            )
        )

    return transactions


_SECTION_MAP = {
    "HKD Savings": ("HKD Savings", "savings", "HKD"),
    "HKD Current": ("HKD Current", "checking", "HKD"),
    "Foreign Currency Savings": ("Foreign Currency Savings", "savings", None),  # currency set per-line
}


def _parse_premier_statement(pdf_path: Path, statement_date: date) -> dict[str, list[ParsedTransaction]]:
    """Parse HSBC Premier account statement using word positions for column detection.

    Returns a dict mapping section name -> list of transactions.
    """
    # section_name -> transactions
    sections: dict[str, list[ParsedTransaction]] = {}
    year = statement_date.year

    # Amount pattern: digits with optional commas and exactly 2 decimal places
    _AMT_RE = re.compile(r"^[\d,]+\.\d{2}$")

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words()
            if not words:
                continue

            # Find column boundaries by looking for header words on this page
            deposit_x = None
            withdrawal_x = None
            balance_x = None

            for w in words:
                t = w["text"]
                if t == "Deposit":
                    deposit_x = w["x0"]
                elif t == "Withdrawal":
                    withdrawal_x = w["x0"]
                elif t == "Balance" and w["x0"] > 450:
                    balance_x = w["x0"]

            if deposit_x is None or withdrawal_x is None:
                continue

            # Midpoints for classifying amount columns
            dep_mid = (deposit_x + withdrawal_x) / 2
            wdl_mid = (withdrawal_x + (balance_x or 550)) / 2

            # Group words into lines by top position
            lines: dict[float, list] = {}
            for w in words:
                top = round(w["top"], 0)
                lines.setdefault(top, []).append(w)

            in_transaction_section = False
            current_section: str | None = None
            current_section_currency = "HKD"
            current_date: date | None = None
            desc_acc: list[str] = []

            def emit(amt: Decimal, direction: str, bal: Decimal | None):
                """Create a transaction from accumulated description + amount."""
                desc = " ".join(desc_acc).strip()
                if not desc or desc.startswith("B/F BALANCE") or current_section is None:
                    return
                signed = amt if direction == "deposit" else -amt
                sections.setdefault(current_section, []).append(ParsedTransaction(
                    date=current_date,  # type: ignore[arg-type]
                    description=desc,
                    amount=signed,
                    currency=current_section_currency,
                    balance_after=bal,
                ))

            for top in sorted(lines.keys()):
                line_words = sorted(lines[top], key=lambda w: w["x0"])
                full_line = " ".join(w["text"] for w in line_words)

                # Detect section headers
                matched_section = None
                for key in _SECTION_MAP:
                    if key in full_line:
                        matched_section = key
                        break

                if matched_section:
                    current_date = None
                    desc_acc = []
                    in_transaction_section = True
                    current_section = matched_section
                    _, _, ccy = _SECTION_MAP[matched_section]
                    if ccy:
                        current_section_currency = ccy
                    continue

                # Skip column headers
                if full_line.startswith("CCY Date") or full_line.startswith("Date Transaction"):
                    continue
                # End of transaction sections
                if any(kw in full_line for kw in (
                    "Total Relationship", "Important Notice", "The Hongkong and Shanghai",
                )):
                    in_transaction_section = False
                    desc_acc = []
                    continue

                if not in_transaction_section:
                    continue

                # Check for currency prefix on foreign currency lines
                if line_words and line_words[0]["text"] in ("USD", "EUR", "GBP", "CHF", "CNY", "JPY"):
                    current_section_currency = line_words[0]["text"]
                    line_words = line_words[1:]
                    if not line_words:
                        continue

                # Check if line starts with a date (new date group)
                date_text = " ".join(w["text"] for w in line_words[:2]) if len(line_words) >= 2 else ""
                date_match = re.match(
                    r"^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$",
                    date_text, re.I,
                )
                if date_match:
                    parsed_date = _parse_date(date_match.group(0), year)
                    if parsed_date and parsed_date > statement_date:
                        parsed_date = parsed_date.replace(year=year - 1)
                    current_date = parsed_date
                    desc_acc = []
                    remaining = line_words[2:]
                else:
                    remaining = line_words

                # Split line into description words (left) and amount words (right)
                line_desc_parts: list[str] = []
                line_amount: Decimal | None = None
                line_direction: str = "deposit"
                line_balance: Decimal | None = None

                for w in remaining:
                    x = w["x0"]
                    text = w["text"]
                    if _AMT_RE.match(text) and x > dep_mid - 50:
                        val = Decimal(text.replace(",", ""))
                        if x >= wdl_mid:
                            line_balance = val
                        elif x >= dep_mid:
                            line_amount = val
                            line_direction = "withdrawal"
                        else:
                            line_amount = val
                            line_direction = "deposit"
                    elif x < dep_mid:
                        line_desc_parts.append(text)

                line_desc = " ".join(line_desc_parts).strip()

                if line_amount is not None:
                    if line_desc:
                        desc_acc.append(line_desc)
                    emit(line_amount, line_direction, line_balance)
                    desc_acc = []
                elif line_desc:
                    desc_acc.append(line_desc)

    return sections


@register
class HSBCHKParser(BankStatementParser):
    bank_code = "hsbc_hk"
    bank_name = "HSBC Hong Kong"
    country = "HK"

    def can_parse(self, file_path: Path) -> bool:
        try:
            with pdfplumber.open(file_path) as pdf:
                if not pdf.pages:
                    return False
                # Check first two pages for HSBC identifiers
                text = ""
                for page in pdf.pages[:2]:
                    text += (page.extract_text() or "") + "\n"
                has_hsbc = "HSBC" in text or "Hongkong and Shanghai Banking" in text
                has_hk = "Hong Kong" in text or "HK" in text
                return has_hsbc and has_hk
        except Exception:
            return False

    def parse(self, file_path: Path) -> ParsedStatement:
        full_text = ""
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                full_text += (page.extract_text() or "") + "\n"

        template = _detect_template(full_text) or "bank_statement"
        currency = _detect_currency(full_text)
        year = _extract_year(full_text)
        statement_date = _extract_statement_date(full_text)

        if template == "credit_card":
            account_number = _extract_card_number(full_text)
            account_type = "credit_card"
            if statement_date is None:
                statement_date = date(year, 12, 31)  # fallback
            transactions = _parse_credit_card(full_text, statement_date, currency)
        elif template == "premier_statement":
            account_number = _extract_account_number(full_text)
            account_type = "checking"
            if statement_date is None:
                statement_date = date(year, 12, 31)
            section_txns = _parse_premier_statement(file_path, statement_date)
            # Determine account prefix: "PIA" for Personal Integrated Account, else plain
            is_pia = "Personal Integrated Account" in full_text
            prefix = "PIA " if is_pia else ""
            # Build sub-accounts from sections
            sub_accounts = []
            all_transactions = []
            for section_name, txns in section_txns.items():
                if not txns:
                    continue
                acct_name, acct_type, ccy = _SECTION_MAP.get(
                    section_name, (section_name, "savings", "HKD")
                )
                # For foreign currency, use the currency from the transactions
                if ccy is None and txns:
                    ccy = txns[0].currency
                sub_accounts.append(ParsedSubAccount(
                    account_name=f"{prefix}{acct_name}",
                    account_type=acct_type,
                    currency=ccy or "HKD",
                    transactions=txns,
                ))
                all_transactions.extend(txns)
            transactions = all_transactions
        else:
            account_number = _extract_account_number(full_text)
            account_type = "checking"
            transactions = _parse_bank_statement(full_text, year, currency)

        result = ParsedStatement(
            bank_code=self.bank_code,
            account_number=account_number,
            account_name=None,
            currency=currency,
            template=template,
            account_type=account_type,
            transactions=transactions,
        )
        if template == "premier_statement":
            result.sub_accounts = sub_accounts
        return result
