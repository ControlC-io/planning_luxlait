import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@shared/auth';

const Counter = () => {
  const { jwtToken } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [incrementing, setIncrementing] = useState(false);
  const [decrementing, setDecrementing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChangedBy, setLastChangedBy] = useState<string | null>(null);

  const authHeaders = useCallback((): HeadersInit => {
    if (!jwtToken) return {};
    return { Authorization: `Bearer ${jwtToken}` };
  }, [jwtToken]);

  const fetchCount = useCallback(async () => {
    if (!jwtToken) {
      setError('No JWT token available. Please log out and log in again.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/counter', { headers: authHeaders() });
      if (res.status === 401) {
        setError('Unauthorized: your JWT token is missing or expired.');
        return;
      }
      if (res.status === 403) {
        setError('Forbidden: your role does not have access to this endpoint.');
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as { count: number };
      setCount(data.count);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to fetch counter');
    } finally {
      setLoading(false);
    }
  }, [jwtToken, authHeaders]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  const handleIncrement = async () => {
    if (!jwtToken) {
      setError('No JWT token. Please log out and log in again.');
      return;
    }
    setIncrementing(true);
    setError(null);
    try {
      const res = await fetch('/api/counter/increment', {
        method: 'POST',
        headers: authHeaders(),
      });
      if (res.status === 401) {
        setError('Unauthorized: JWT token is missing or expired.');
        return;
      }
      if (res.status === 403) {
        setError('Forbidden: your role does not have access to this endpoint.');
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as { count: number; changedBy: string };
      setCount(data.count);
      setLastChangedBy(data.changedBy);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to increment counter');
    } finally {
      setIncrementing(false);
    }
  };

  const handleDecrement = async () => {
    if (!jwtToken) {
      setError('No JWT token. Please log out and log in again.');
      return;
    }
    setDecrementing(true);
    setError(null);
    try {
      const res = await fetch('/api/counter/decrement', {
        method: 'POST',
        headers: authHeaders(),
      });
      if (res.status === 401) {
        setError('Unauthorized: JWT token is missing or expired.');
        return;
      }
      if (res.status === 403) {
        setError('Forbidden: your role does not have access to this endpoint.');
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as { count: number; changedBy: string };
      setCount(data.count);
      setLastChangedBy(data.changedBy);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to decrement counter');
    } finally {
      setDecrementing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800">Counter Test</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Writes to the database via a JWT-protected endpoint
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
          jwtToken ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {jwtToken ? 'JWT active' : 'No JWT'}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-6">
        <div className="flex-1 text-center">
          {loading ? (
            <span className="text-gray-400 text-sm">Loading…</span>
          ) : (
            <span className="text-6xl font-bold text-indigo-600 tabular-nums">
              {count ?? '—'}
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleDecrement}
            disabled={decrementing || incrementing || loading || !jwtToken}
            className="flex-shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-5 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {decrementing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Decrementing…
              </>
            ) : (
              '− Decrement'
            )}
          </button>
          <button
            onClick={handleIncrement}
            disabled={incrementing || decrementing || loading || !jwtToken}
            className="flex-shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {incrementing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Incrementing…
              </>
            ) : (
              '+ Increment'
            )}
          </button>
        </div>
      </div>

      {lastChangedBy && (
        <p className="mt-3 text-xs text-gray-400 text-center">
          Last change by <span className="font-medium text-gray-600">{lastChangedBy}</span>
        </p>
      )}

      <div className="mt-4 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
        <span className="font-semibold">Middleware proof:</span> each increment call includes{' '}
        <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> and is validated by the
        centralized <code className="font-mono">jwtAuth</code> middleware before touching the database.
      </div>
    </div>
  );
};

export default Counter;
