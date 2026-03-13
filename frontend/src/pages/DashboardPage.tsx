import { useDashboardSummary, useSpending } from '../hooks/useApi';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#ef4444', '#3b82f6', '#ec4899', '#f59e0b', '#a855f7', '#10b981', '#6b7280', '#14b8a6'];

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: spending, isLoading: spendingLoading } = useSpending();

  if (summaryLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Net Worth */}
      {summary && (
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-500">Net Worth (HKD)</p>
          <p className="text-3xl font-bold text-gray-900">
            ${Number(summary.net_worth_hkd).toLocaleString('en-HK', { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      {/* Account Balances */}
      {summary && summary.balances.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.balances.map((b) => (
            <div key={b.account_id} className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">{b.bank_name}</p>
              <p className="font-medium text-gray-900">{b.account_name}</p>
              <p className="text-xl font-bold mt-1">
                {b.currency} {Number(b.balance).toLocaleString('en-HK', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Spending by Category */}
      {!spendingLoading && spending && spending.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
          <div className="flex items-center gap-8">
            <div className="w-64 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={spending}
                    dataKey="total"
                    nameKey="category_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                  >
                    {spending.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {spending.map((s, i) => (
                <div key={s.category_name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span>{s.category_name}</span>
                  </div>
                  <span className="font-medium">
                    ${Number(s.total).toLocaleString('en-HK', { minimumFractionDigits: 2 })}
                    <span className="text-gray-400 ml-1">({s.count})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {summary && summary.balances.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          No data yet. Import a bank statement to get started.
        </p>
      )}
    </div>
  );
}
