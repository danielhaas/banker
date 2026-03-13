import { useStatements, useStatementCoverage } from '../hooks/useApi';
import { format } from 'date-fns';

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
};

function CoverageGrid() {
  const { data: coverage, isLoading } = useStatementCoverage();

  if (isLoading) return <p className="text-gray-500">Loading coverage...</p>;
  if (!coverage?.length) return null;

  // Build a unified month range across all accounts
  const allMonths = new Set<string>();
  for (const c of coverage) {
    for (const m of c.months_present) allMonths.add(m);
    for (const m of c.months_missing) allMonths.add(m);
  }
  const months = Array.from(allMonths).sort();

  const totalMissing = coverage.reduce((sum, c) => sum + c.months_missing.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Statement Coverage</h2>
        {totalMissing > 0 && (
          <span className="text-sm text-red-600 font-medium">
            {totalMissing} missing month{totalMissing > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-[160px]">
                Account
              </th>
              {months.map((m) => (
                <th key={m} className="px-1 py-2 font-medium text-gray-500 text-center whitespace-nowrap">
                  {m.slice(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {coverage.map((c) => {
              const presentSet = new Set(c.months_present);
              const missingSet = new Set(c.months_missing);
              return (
                <tr key={c.account_id}>
                  <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white whitespace-nowrap">
                    <div>{c.account_name}</div>
                    <div className="text-[10px] text-gray-400 font-normal">{c.bank_name}</div>
                  </td>
                  {months.map((m) => {
                    const isPresent = presentSet.has(m);
                    const isMissing = missingSet.has(m);
                    const inRange = m >= c.first_month && m <= c.last_month;
                    return (
                      <td key={m} className="px-1 py-2 text-center">
                        {isPresent ? (
                          <span className="inline-block w-5 h-5 rounded bg-green-100 text-green-600 leading-5">
                            &#10003;
                          </span>
                        ) : isMissing ? (
                          <span className="inline-block w-5 h-5 rounded bg-red-100 text-red-600 leading-5 font-bold">
                            !
                          </span>
                        ) : inRange ? (
                          <span className="inline-block w-5 h-5 rounded bg-gray-100 text-gray-400 leading-5">
                            -
                          </span>
                        ) : (
                          <span className="inline-block w-5 h-5" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-green-100" /> Present
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-100" /> Missing
        </span>
      </div>
    </div>
  );
}

export default function StatementsPage() {
  const { data: statements, isLoading } = useStatements();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Uploaded Statements</h1>

      <CoverageGrid />

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !statements?.length ? (
        <p className="text-gray-500 text-center py-12">No statements uploaded yet.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Filename</th>
                <th className="px-4 py-3 font-medium">Bank</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium text-right">Transactions</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {statements.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <a
                      href={`/api/statements/${s.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {s.filename}
                    </a>
                  </td>
                  <td className="px-4 py-3">{s.bank_name}</td>
                  <td className="px-4 py-3">{s.account_name}</td>
                  <td className="px-4 py-3 text-right">{s.transaction_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {format(new Date(s.created_at), 'yyyy-MM-dd HH:mm')}
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
