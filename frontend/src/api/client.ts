import type {
  Account,
  AccountCoverage,
  Category,
  CategoryRule,
  ConfirmResponse,
  DashboardSummary,
  MonthlyFlow,
  SpendingByCategory,
  StatementImport,
  Transaction,
  UploadResponse,
} from '../types';

const BASE = '/api';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// Statements
export async function uploadStatement(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/statements/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function confirmImport(importId: number): Promise<ConfirmResponse> {
  return fetchJSON('/statements/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ import_id: importId }),
  });
}

// Statement imports
export async function getStatements(): Promise<StatementImport[]> {
  return fetchJSON('/statements');
}

// Statement coverage
export async function getStatementCoverage(): Promise<AccountCoverage[]> {
  return fetchJSON('/statements/coverage');
}

// Transactions
export async function getTransactions(params?: {
  account_id?: number;
  category_id?: number;
  uncategorized?: boolean;
  search?: string;
  start_date?: string;
  end_date?: string;
  sort?: string;
  sort_dir?: string;
  limit?: number;
  offset?: number;
}): Promise<Transaction[]> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const qs = searchParams.toString();
  return fetchJSON(`/transactions${qs ? `?${qs}` : ''}`);
}

export async function updateTransaction(
  id: number,
  data: { category_id?: number; category_source?: string; is_transfer?: boolean }
): Promise<Transaction> {
  return fetchJSON(`/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Bulk categorize
export async function bulkCategorize(data: { transaction_ids: number[]; category_id: number }): Promise<{ updated: number }> {
  return fetchJSON('/transactions/bulk-categorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Deduplication
export async function deduplicateTransactions(): Promise<{ deleted: number }> {
  return fetchJSON('/transactions/deduplicate', { method: 'POST' });
}

// Transfers
export async function detectTransfers(): Promise<{ linked: number; total_pairs: number }> {
  return fetchJSON('/transactions/detect-transfers', { method: 'POST' });
}

// Accounts
export async function getAccounts(): Promise<Account[]> {
  return fetchJSON('/accounts');
}

// Categories
export async function getCategories(): Promise<Category[]> {
  return fetchJSON('/categories');
}

// Category Rules
export async function getRules(): Promise<CategoryRule[]> {
  return fetchJSON('/rules');
}

export async function createRule(data: { pattern: string; category_id: number; priority?: number }): Promise<CategoryRule> {
  return fetchJSON('/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateRule(id: number, data: { pattern: string; category_id: number; priority?: number }): Promise<CategoryRule> {
  return fetchJSON(`/rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteRule(id: number): Promise<void> {
  await fetch(`${BASE}/rules/${id}`, { method: 'DELETE' });
}

export async function applyRules(): Promise<{ categorized: number }> {
  return fetchJSON('/rules/apply', { method: 'POST' });
}

// Dashboard
export async function getDashboardSummary(): Promise<DashboardSummary> {
  return fetchJSON('/dashboard/summary');
}

export async function getMonthlyFlow(params?: { account_id?: number; start_date?: string; end_date?: string }): Promise<MonthlyFlow[]> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const qs = searchParams.toString();
  return fetchJSON(`/dashboard/monthly-flow${qs ? `?${qs}` : ''}`);
}

export async function getSpending(params?: {
  start_date?: string;
  end_date?: string;
  account_id?: number;
}): Promise<SpendingByCategory[]> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, v);
    });
  }
  const qs = searchParams.toString();
  return fetchJSON(`/dashboard/spending${qs ? `?${qs}` : ''}`);
}
