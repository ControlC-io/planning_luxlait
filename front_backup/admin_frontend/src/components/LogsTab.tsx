import { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  action: string;
  userId: string | null;
  details: any;
  timestamp: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || '';

const LogsTab = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/admin/logs`, {
        headers: {
          'x-admin-secret': ADMIN_SECRET
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      
      const data = await response.json();
      setLogs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Auto refresh every 10 seconds
    const interval = setInterval(fetchLogs, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDetails = (details: any): string => {
    if (!details) return '';
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Audit Logs</h3>
            <p className="text-sm text-gray-600 mt-1">
              Recent system activity and changes (auto-refreshes every 10 seconds)
            </p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
        
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {log.userId || <span className="text-gray-400 italic">System</span>}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {log.details && (
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:text-blue-800 font-medium">
                          View Details
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 text-xs overflow-x-auto font-mono">
                          {formatDetails(log.details)}
                        </pre>
                      </details>
                    )}
                    {!log.details && (
                      <span className="text-gray-400 italic">No details</span>
                    )}
                  </td>
                </tr>
              ))}
              
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No audit logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LogsTab;
