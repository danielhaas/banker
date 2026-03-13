import type {
  Account,
  AccountCoverage,
  Category,
  ConfirmResponse,
  DashboardSummary,
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
  search?: string;
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
  data: { category_id: number; category_source?: string }
): Promise<Transaction> {
  return fetchJSON(`/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Accounts
export async function getAccounts(): Promise<Account[]> {
  return fetchJSON('/accounts');
}

// Categories
export async function getCategories(): Promise<Category[]> {
  return fetchJSON('/categories');
}

// Dashboard
export async function getDashboardSummary(): Promise<DashboardSummary> {
  return fetchJSON('/dashboard/summary');
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
