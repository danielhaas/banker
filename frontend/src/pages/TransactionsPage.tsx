import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTransactions, useCategories, useAccounts, useUpdateTransaction, useDetectTransfers, useDeduplicateTransactions, useBulkCategorize } from '../hooks/useApi';

type SortKey = 'date' | 'description' | 'amount' | 'balance_after' | 'category';
type SortDir = 'asc' | 'desc';

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountId = searchParams.get('account_id') ? Number(searchParams.get('account_id')) : undefined;
  const categoryId = searchParams.get('category_id') ? Number(searchParams.get('category_id')) : undefined;
  const uncategorized = searchParams.get('uncategorized') === 'true';
  const startDate = searchParams.get('start_date') || undefined;
  const endDate = searchParams.get('end_date') || undefined;
  const [search, setSearch] = useState('');
  const [hideTransfers, setHideTransfers] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const pageSize = 200;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const bulkCategorize = useBulkCategorize();
  const deduplicate = useDeduplicateTransactions();
  const { data: transactions, isLoading } = useTransactions({
    account_id: accountId,
    category_id: categoryId,
    uncategorized: uncategorized || undefined,
    search: search || undefined,
    start_date: startDate,
    end_date: endDate,
    sort: sortKey,
    sort_dir: sortDir,
    limit: pageSize + 1,
    offset: page * pageSize,
  });

  const hasMore = (transactions?.length ?? 0) > pageSize;
  const pageTransactions = transactions?.slice(0, pageSize);
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const updateTxn = useUpdateTransaction();
  const detectTransfers = useDetectTransfers();

  const currentAccount = accounts?.find((a) => a.id === accountId);

  const parentCategories = categories?.filter((c) => c.parent_id === null) ?? [];

  const displayTransactions = hideTransfers
    ? (pageTransactions?.filter((t) => !t.transfer_pair_id) ?? [])
    : (pageTransactions ?? []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const handleCategoryChange = (txnId: number, categoryId: string) => {
    if (!categoryId) return;
    updateTxn.mutate({ id: txnId, category_id: Number(categoryId), category_source: 'manual' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Transactions
          {currentAccount && (
            <span className="text-lg font-normal text-gray-500 ml-2">— {currentAccount.name}</span>
          )}
          {(categoryId || uncategorized) && (
            <span className="text-lg font-normal text-gray-500 ml-2">
              — {uncategorized ? 'Uncategorized' : categories?.find((c) => c.id === categoryId)?.name ?? 'Category'}
              <button
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('category_id');
                  next.delete('uncategorized');
                  setSearchParams(next);
                }}
                className="ml-2 text-sm text-blue-500 hover:text-blue-700"
              >
                ✕
              </button>
            </span>
          )}
          {startDate && (
            <span className="text-lg font-normal text-gray-500 ml-2">
              — {startDate.slice(0, 7)}
              <button
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('start_date');
                  next.delete('end_date');
                  setSearchParams(next);
                }}
                className="ml-2 text-sm text-blue-500 hover:text-blue-700"
              >
                ✕
              </button>
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (accountId) params.set('account_id', String(accountId));
              if (categoryId) params.set('category_id', String(categoryId));
              if (uncategorized) params.set('uncategorized', 'true');
              if (search) params.set('search', search);
              if (startDate) params.set('start_date', startDate);
              if (endDate) params.set('end_date', endDate);
              if (hideTransfers) params.set('exclude_transfers', 'true');
              params.set('sort', sortKey);
              params.set('sort_dir', sortDir);
              const qs = params.toString();
              window.open(`/api/transactions/export${qs ? `?${qs}` : ''}`, '_blank');
            }}
            className="border rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Export Excel
          </button>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideTransfers}
              onChange={(e) => setHideTransfers(e.target.checked)}
              className="rounded"
            />
            Hide transfers
          </label>
          <button
            onClick={() => deduplicate.mutate(undefined, {
              onSuccess: (data) => alert(`Deleted ${data.deleted} duplicate(s)`),
            })}
            disabled={deduplicate.isPending}
            className="border rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {deduplicate.isPending ? 'Cleaning...' : 'Remove Duplicates'}
          </button>
          <button
            onClick={() => detectTransfers.mutate()}
            disabled={detectTransfers.isPending}
            className="border rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {detectTransfers.isPending ? 'Detecting...' : 'Detect Transfers'}
          </button>
          <select
            value={accountId ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                setSearchParams({ account_id: val });
              } else {
                setSearchParams({});
              }
            }}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">All accounts</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="border rounded-lg px-3 py-1.5 text-sm w-64"
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm font-medium text-blue-700">{selected.size} selected</span>
          <select
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              bulkCategorize.mutate(
                { transaction_ids: [...selected], category_id: Number(e.target.value) },
                { onSuccess: () => setSelected(new Set()) },
              );
              e.target.value = '';
            }}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Assign category...</option>
            {parentCategories.map((cat) => (
              <optgroup key={cat.id} label={`${cat.icon ?? ''} ${cat.name}`}>
                {categories
                  ?.filter((c) => c.parent_id === cat.id)
                  .map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.icon ?? ''} {child.name}
                    </option>
                  ))}
                <option value={cat.id}>{cat.name} (General)</option>
              </optgroup>
            ))}
          </select>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear selection
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !pageTransactions?.length ? (
        <p className="text-gray-500 text-center py-12">No transactions found.</p>
      ) : (
        <>
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-2 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={displayTransactions.length > 0 && displayTransactions.every((t) => selected.has(t.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected(new Set(displayTransactions.map((t) => t.id)));
                      } else {
                        setSelected(new Set());
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('date')}>Date{sortIndicator('date')}</th>
                <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('description')}>Description{sortIndicator('description')}</th>
                <th className="px-4 py-3 font-medium text-right cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('amount')}>Amount{sortIndicator('amount')}</th>
                <th className="px-4 py-3 font-medium text-right cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('balance_after')}>Balance{sortIndicator('balance_after')}</th>
                <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('category')}>Category{sortIndicator('category')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayTransactions.map((txn) => (
                <tr key={txn.id} className={`hover:bg-gray-50 ${selected.has(txn.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(txn.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(txn.id); else next.delete(txn.id);
                        setSelected(next);
                      }}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{txn.date}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => updateTxn.mutate({ id: txn.id, is_transfer: !txn.transfer_pair_id })}
                      className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${
                        txn.transfer_pair_id
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={txn.transfer_pair_id ? 'Unmark as transfer' : 'Mark as transfer'}
                    >
                      Transfer
                    </button>
                    {txn.description}
                  </td>
                  <td className={`px-4 py-3 text-right whitespace-nowrap font-medium ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {txn.currency} {txn.amount >= 0 ? '+' : ''}
                    {Number(txn.amount).toLocaleString('en-HK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-gray-500">
                    {txn.balance_after != null
                      ? Number(txn.balance_after).toLocaleString('en-HK', { minimumFractionDigits: 2 })
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={txn.category_id ?? ''}
                      onChange={(e) => handleCategoryChange(txn.id, e.target.value)}
                      className="border rounded px-2 py-1 text-xs w-full max-w-40"
                    >
                      <option value="">Uncategorized</option>
                      {parentCategories.map((cat) => (
                        <optgroup key={cat.id} label={`${cat.icon ?? ''} ${cat.name}`}>
                          {categories
                            ?.filter((c) => c.parent_id === cat.id)
                            .map((child) => (
                              <option key={child.id} value={child.id}>
                                {child.icon ?? ''} {child.name}
                              </option>
                            ))}
                          <option value={cat.id}>{cat.name} (General)</option>
                        </optgroup>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500 pt-2">
          <span>Page {page + 1} — showing {displayTransactions.length} transactions</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="border rounded px-3 py-1 hover:bg-gray-50 disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="border rounded px-3 py-1 hover:bg-gray-50 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
