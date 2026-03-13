export interface Bank {
  id: number;
  code: string;
  name: string;
  country: string;
}

export interface Account {
  id: number;
  bank_id: number;
  name: string;
  account_number: string | null;
  currency: string;
  account_type: string;
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  icon: string | null;
  color: string | null;
}

export interface Transaction {
  id: number;
  account_id: number;
  date: string;
  description: string;
  amount: number;
  currency: string;
  amount_hkd: number | null;
  balance_after: number | null;
  category_id: number | null;
  category_source: string | null;
  category_confidence: number | null;
  category_name: string | null;
  transfer_pair_id: number | null;
}

export interface TransactionPreview {
  date: string;
  description: string;
  amount: number;
  currency: string;
  balance_after: number | null;
}

export interface UploadResponse {
  import_id: number;
  account_id: number;
  bank_code: string;
  template: string;
  filename: string;
  transactions: TransactionPreview[];
  duplicate: boolean;
}

export interface ConfirmResponse {
  import_id: number;
  transaction_count: number;
  status: string;
}

export interface AccountBalance {
  account_id: number;
  account_name: string;
  account_number: string | null;
  account_type: string;
  bank_name: string;
  currency: string;
  balance: number;
}

export interface DashboardSummary {
  balances: AccountBalance[];
  net_worth_hkd: number;
}

export interface SpendingByCategory {
  category_id: number | null;
  category_name: string;
  total: number;
  count: number;
}

export interface StatementImport {
  id: number;
  filename: string;
  bank_code: string;
  bank_name: string;
  account_name: string;
  status: string;
  transaction_count: number;
  stored_path: string | null;
  created_at: string;
}

export interface MonthlyFlow {
  month: string;
  income: number;
  expense: number;
}

export interface CategoryRule {
  id: number;
  pattern: string;
  category_id: number;
  category_name: string | null;
  priority: number;
}

export interface AccountCoverage {
  account_id: number;
  account_name: string;
  bank_name: string;
  months_present: string[];
  months_missing: string[];
  first_month: string;
  last_month: string;
}
