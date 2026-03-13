import { useStatements } from '../hooks/useApi';
import { format } from 'date-fns';

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function StatementsPage() {
  const { data: statements, isLoading } = useStatements();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Uploaded Statements</h1>

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
