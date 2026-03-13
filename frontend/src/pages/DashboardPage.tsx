import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccounts, useDashboardSummary, useMonthlyFlow, useSpending } from '../hooks/useApi';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import type { AccountBalance } from '../types';

const COLORS = ['#ef4444', '#3b82f6', '#ec4899', '#f59e0b', '#a855f7', '#10b981', '#6b7280', '#14b8a6'];

function groupAccounts(balances: AccountBalance[]) {
  const groups: { name: string; accounts: AccountBalance[] }[] = [];
  const groupMap = new Map<string, AccountBalance[]>();

  for (const b of balances) {
    let group: string;
    if (b.account_type === 'credit_card') {
      group = 'Credit Card';
    } else if (b.account_name.startsWith('PIA ')) {
      group = 'Personal Integrated Account';
    } else {
      group = 'Premier';
    }
    if (!groupMap.has(group)) groupMap.set(group, []);
    groupMap.get(group)!.push(b);
  }

  // Fixed order
  for (const name of ['Premier', 'Personal Integrated Account', 'Credit Card']) {
    const accounts = groupMap.get(name);
    if (accounts?.length) groups.push({ name, accounts });
  }
  return groups;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: accounts } = useAccounts();
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('');
  const dateParams = {
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  };
  const { data: spendingRaw, isLoading: spendingLoading } = useSpending(dateParams);
  const spending = useMemo(() => spendingRaw?.map((s) => ({ ...s, total: Number(s.total) })), [spendingRaw]);

  // Last month date range
  const lastMonthParams = useMemo(() => {
    const now = new Date();
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const m = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-based
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start_date: start, end_date: end, label: `${y}-${String(m).padStart(2, '0')}` };
  }, []);
  const { data: lastMonthSpendingRaw } = useSpending({ start_date: lastMonthParams.start_date, end_date: lastMonthParams.end_date });
  const lastMonthSpending = useMemo(() => lastMonthSpendingRaw?.map((s) => ({ ...s, total: Number(s.total) })), [lastMonthSpendingRaw]);

  const [flowAccountId, setFlowAccountId] = useState<number | undefined>(undefined);
  const { data: monthlyFlow } = useMonthlyFlow({ account_id: flowAccountId, ...dateParams });

  const taxesTotal = useMemo(() => {
    if (!spending) return 0;
    const taxes = spending.find((s) => s.category_name === 'Taxes');
    return taxes ? Number(taxes.total) : 0;
  }, [spending]);

  const monthlyAverages = useMemo(() => {
    if (!monthlyFlow?.length) return null;
    const months = monthlyFlow.length;
    const avgIncome = monthlyFlow.reduce((s, m) => s + Number(m.income), 0) / months;
    const avgExpense = monthlyFlow.reduce((s, m) => s + Number(m.expense), 0) / months;
    const avgExpenseExTax = avgExpense - taxesTotal / months;
    return { avgIncome, avgExpense, avgExpenseExTax, avgNet: avgIncome - avgExpense, avgNetExTax: avgIncome - avgExpenseExTax, months };
  }, [monthlyFlow, taxesTotal]);

  const spendingWithAvg = useMemo(() => {
    if (!spending?.length || !monthlyAverages) return null;
    return spending.map((s) => ({
      ...s,
      monthly_avg: Number(s.total) / monthlyAverages.months,
    }));
  }, [spending, monthlyAverages]);

  if (summaryLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded-lg px-3 py-1.5"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded-lg px-3 py-1.5"
          />
        </div>
      </div>

      {/* Net Worth */}
      {summary && (
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-500">Net Worth (HKD)</p>
          <p className="text-3xl font-bold text-gray-900">
            ${Number(summary.net_worth_hkd).toLocaleString('en-HK', { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      {/* Monthly Averages */}
      {monthlyAverages && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">Avg Monthly Income</p>
            <p className="text-xl font-bold text-green-600">
              ${monthlyAverages.avgIncome.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">Avg Monthly Expense</p>
            <p className="text-xl font-bold text-red-600">
              ${monthlyAverages.avgExpense.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            {taxesTotal > 0 && (
              <p className="text-sm text-gray-400 mt-1">
                ${monthlyAverages.avgExpenseExTax.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} excl. taxes
              </p>
            )}
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">Avg Monthly Savings</p>
            <p className={`text-xl font-bold ${monthlyAverages.avgNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${monthlyAverages.avgNet.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            {taxesTotal > 0 && (
              <p className={`text-sm mt-1 ${monthlyAverages.avgNetExTax >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${monthlyAverages.avgNetExTax.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} excl. taxes
              </p>
            )}
          </div>
        </div>
      )}

      {/* Account Balances — grouped */}
      {summary && summary.balances.length > 0 &&
        groupAccounts(summary.balances).map((group) => {
          const hkdTotal = group.accounts
            .filter((b) => b.currency === 'HKD')
            .reduce((sum, b) => sum + Number(b.balance), 0);
          return (
            <div key={group.name} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-700">{group.name}</h2>
                <span className="text-sm text-gray-500">
                  HKD {hkdTotal.toLocaleString('en-HK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.accounts.map((b) => (
                  <div
                    key={b.account_id}
                    className="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                    onClick={() => navigate(`/transactions?account_id=${b.account_id}`)}
                  >
                    <p className="text-sm text-gray-500">{b.account_name}</p>
                    {b.account_number && (
                      <p className="text-xs text-gray-400">{b.account_number}</p>
                    )}
                    <p className="text-xl font-bold mt-1">
                      {b.currency} {Number(b.balance).toLocaleString('en-HK', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      }

      {/* Monthly Income vs Expense */}
      {monthlyFlow && monthlyFlow.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Monthly Cash Flow</h2>
            <select
              value={flowAccountId ?? ''}
              onChange={(e) => setFlowAccountId(e.target.value ? Number(e.target.value) : undefined)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">All accounts</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyFlow}
                onClick={(state) => {
                  if (state?.activeLabel) {
                    const month = state.activeLabel;
                    const [y, m] = month.split('-');
                    const start = `${y}-${m}-01`;
                    const lastDay = new Date(Number(y), Number(m), 0).getDate();
                    const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
                    navigate(`/transactions?start_date=${start}&end_date=${end}`);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => `$${Number(value).toLocaleString('en-HK', { minimumFractionDigits: 2 })}`} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#10b981" />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" />
                {monthlyAverages && (
                  <ReferenceLine y={monthlyAverages.avgExpense} stroke="#ef4444" strokeDasharray="6 3" label={{ value: 'Avg Expense', position: 'right', fontSize: 11, fill: '#ef4444' }} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Spending by Category — Overall & Last Month */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!spendingLoading && spending && spending.length > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
            <div className="flex flex-col items-center gap-4">
              <div>
                <PieChart width={224} height={224}>
                    <Pie
                      data={spending}
                      dataKey="total"
                      nameKey="category_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      style={{ cursor: 'pointer' }}
                      onClick={(_, index) => {
                        const s = spending[index];
                        if (s) {
                          if (s.category_id != null) {
                            navigate(`/transactions?category_id=${s.category_id}`);
                          } else {
                            navigate('/transactions?uncategorized=true');
                          }
                        }
                      }}
                    >
                      {spending.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                </PieChart>
              </div>
              <div className="w-full space-y-1.5">
                {(spendingWithAvg ?? spending)?.map((s, i) => (
                  <div
                    key={s.category_name}
                    className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1"
                    onClick={() => {
                      if (s.category_id != null) {
                        navigate(`/transactions?category_id=${s.category_id}`);
                      } else {
                        navigate('/transactions?uncategorized=true');
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span>{s.category_name}</span>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="font-medium">
                        ${Number(s.total).toLocaleString('en-HK', { minimumFractionDigits: 2 })}
                      </span>
                      {'monthly_avg' in s && (
                        <span className="text-gray-400 text-xs ml-2">
                          ${(s as { monthly_avg: number }).monthly_avg.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo
                        </span>
                      )}
                      <span className="text-gray-400 ml-1">({s.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {lastMonthSpending && lastMonthSpending.length > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Last Month ({lastMonthParams.label})</h2>
            <div className="flex flex-col items-center gap-4">
              <div>
                <PieChart width={224} height={224}>
                    <Pie
                      data={lastMonthSpending}
                      dataKey="total"
                      nameKey="category_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      style={{ cursor: 'pointer' }}
                      onClick={(_, index) => {
                        const s = lastMonthSpending[index];
                        if (s) {
                          if (s.category_id != null) {
                            navigate(`/transactions?category_id=${s.category_id}&start_date=${lastMonthParams.start_date}&end_date=${lastMonthParams.end_date}`);
                          } else {
                            navigate(`/transactions?uncategorized=true&start_date=${lastMonthParams.start_date}&end_date=${lastMonthParams.end_date}`);
                          }
                        }
                      }}
                    >
                      {lastMonthSpending.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                </PieChart>
              </div>
              <div className="w-full space-y-1.5">
                {lastMonthSpending.map((s, i) => (
                  <div
                    key={s.category_name}
                    className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1"
                    onClick={() => {
                      if (s.category_id != null) {
                        navigate(`/transactions?category_id=${s.category_id}&start_date=${lastMonthParams.start_date}&end_date=${lastMonthParams.end_date}`);
                      } else {
                        navigate(`/transactions?uncategorized=true&start_date=${lastMonthParams.start_date}&end_date=${lastMonthParams.end_date}`);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span>{s.category_name}</span>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="font-medium">
                        ${Number(s.total).toLocaleString('en-HK', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-gray-400 ml-1">({s.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {summary && summary.balances.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          No data yet. Import a bank statement to get started.
        </p>
      )}
    </div>
  );
}
