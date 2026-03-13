import { useState } from 'react';
import { useTransactions, useCategories, useUpdateTransaction } from '../hooks/useApi';

export default function TransactionsPage() {
  const [search, setSearch] = useState('');
  const { data: transactions, isLoading } = useTransactions({ search: search || undefined, limit: 200 });
  const { data: categories } = useCategories();
  const updateTxn = useUpdateTransaction();

  const parentCategories = categories?.filter((c) => c.parent_id === null) ?? [];

  const handleCategoryChange = (txnId: number, categoryId: string) => {
    if (!categoryId) return;
    updateTxn.mutate({ id: txnId, category_id: Number(categoryId), category_source: 'manual' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm w-64"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !transactions?.length ? (
        <p className="text-gray-500 text-center py-12">No transactions found.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{txn.date}</td>
                  <td className="px-4 py-3">{txn.description}</td>
                  <td className={`px-4 py-3 text-right whitespace-nowrap font-medium ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {txn.amount >= 0 ? '+' : ''}
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
      )}
    </div>
  );
}
