import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@shared/auth';

type ServiceStatus = 'ok' | 'error' | 'checking';

interface Service {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  message: string;
  detail?: string;
}

const StatusDot = ({ status }: { status: ServiceStatus }) => {
  if (status === 'checking') {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400" />
      </span>
    );
  }
  return (
    <span className="relative flex h-3 w-3">
      {status === 'ok' && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${
        status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'
      }`} />
    </span>
  );
};

const ServiceRow = ({ svc }: { svc: Service }) => (
  <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
    svc.status === 'ok'
      ? 'bg-emerald-50 border-emerald-100'
      : svc.status === 'error'
        ? 'bg-red-50 border-red-100'
        : 'bg-gray-50 border-gray-100'
  }`}>
    <StatusDot status={svc.status} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-semibold text-gray-800">{svc.name}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          svc.status === 'ok'
            ? 'bg-emerald-100 text-emerald-700'
            : svc.status === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-yellow-100 text-yellow-700'
        }`}>
          {svc.status === 'ok' ? 'Operational' : svc.status === 'error' ? 'Unavailable' : 'Checking...'}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>
    </div>
    <p className={`text-xs font-mono text-right flex-shrink-0 hidden sm:block ${
      svc.status === 'ok' ? 'text-emerald-600' : svc.status === 'error' ? 'text-red-500' : 'text-gray-400'
    }`}>
      {svc.message}
    </p>
  </div>
);

const CHECKING_PLACEHOLDER: Service[] = [
  { id: 'proxy', name: 'NGINX Proxy', description: 'DMZ reverse proxy and request router', status: 'checking', message: '...' },
  { id: 'api', name: 'Express API', description: 'Internal REST API server', status: 'checking', message: '...' },
  { id: 'database', name: 'PostgreSQL', description: 'Relational database (internal network)', status: 'checking', message: '...' },
  { id: 'auth', name: 'Auth Service', description: 'Better Auth session management', status: 'checking', message: '...' },
  { id: 'session', name: 'User Session', description: 'Current authenticated session', status: 'checking', message: '...' },
];

const Home = () => {
  const [services, setServices] = useState<Service[]>(CHECKING_PLACEHOLDER);
  const [checking, setChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const { user, loading } = useAuth();

  const checkServices = useCallback(async () => {
    setChecking(true);

    // NGINX is operational if this page loaded at all
    const proxyOk: Service = {
      id: 'proxy',
      name: 'NGINX Proxy',
      description: 'DMZ reverse proxy and request router',
      status: 'ok',
      message: 'Routing requests'
    };

    let apiOk: Service = {
      id: 'api',
      name: 'Express API',
      description: 'Internal REST API server',
      status: 'error',
      message: 'No response'
    };

    let dbOk: Service = {
      id: 'database',
      name: 'PostgreSQL',
      description: 'Relational database (internal network)',
      status: 'error',
      message: 'No response'
    };

    let authOk: Service = {
      id: 'auth',
      name: 'Auth Service',
      description: 'Better Auth session management',
      status: 'error',
      message: 'No response'
    };

    try {
      const res = await fetch('/api/health');
      const data = await res.json();

      apiOk = {
        id: 'api',
        name: 'Express API',
        description: 'Internal REST API server',
        status: res.ok ? 'ok' : 'error',
        message: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status}`
      };

      const db = data?.services?.database;
      dbOk = {
        id: 'database',
        name: 'PostgreSQL',
        description: 'Relational database (internal network)',
        status: db?.ok ? 'ok' : 'error',
        message: db?.message ?? (db?.ok ? 'Connected' : 'Connection failed')
      };
    } catch {
      // api and db remain as error
    }

    try {
      const authRes = await fetch('/api/auth/get-session', { credentials: 'include' });
      authOk = {
        id: 'auth',
        name: 'Auth Service',
        description: 'Better Auth session management',
        status: authRes.ok ? 'ok' : 'error',
        message: authRes.ok ? `HTTP ${authRes.status}` : `HTTP ${authRes.status}`
      };
    } catch {
      // authOk remains error
    }

    const sessionSvc: Service = {
      id: 'session',
      name: 'User Session',
      description: 'Current authenticated session',
      status: user ? 'ok' : 'error',
      message: user ? user.email : 'Not authenticated'
    };

    setServices([proxyOk, apiOk, dbOk, authOk, sessionSvc]);
    setLastChecked(new Date());
    setChecking(false);
  }, [user]);

  useEffect(() => {
    if (!loading) checkServices();
  }, [loading, checkServices]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(checkServices, 30_000);
    return () => clearInterval(interval);
  }, [loading, checkServices]);

  const allOk = services.every(s => s.status === 'ok');
  const anyError = services.some(s => s.status === 'error');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* ── Header info ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              DMZ<span className="text-blue-600">Panel</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Management platform with segmented network architecture
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
            checking
              ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
              : allOk
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : anyError
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}>
            <StatusDot status={checking ? 'checking' : allOk ? 'ok' : 'error'} />
            {checking ? 'Checking...' : allOk ? 'All systems operational' : 'Degraded service'}
          </div>
        </div>

        {/* ── Services Status ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Services Status</h2>
            <button
              onClick={checkServices}
              disabled={checking}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {checking ? 'Checking...' : 'Refresh'}
            </button>
          </div>

          <div className="space-y-2.5">
            {services.map(svc => <ServiceRow key={svc.id} svc={svc} />)}
          </div>

          {lastChecked && !checking && (
            <p className="mt-4 text-xs text-gray-400 text-right">
              Last checked: {lastChecked.toLocaleTimeString()} · Auto-refreshes every 30 s
            </p>
          )}
        </div>

        {/* ── Quick access (only if logged in) ── */}
        {!loading && user && (
          <div className="grid grid-cols-1 gap-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-blue-200 hover:shadow-md transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Dashboard</p>
                <p className="text-xs text-gray-400">User panel</p>
              </div>
            </Link>
          </div>
        )}

        {/* ── Features ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '🔐', title: '2FA Authentication', desc: 'TOTP with Google Authenticator and backup codes.' },
              { icon: '🛡️', title: 'Segmented DMZ Network', desc: 'Backend and DB never directly exposed to the internet.' },
              { icon: '👥', title: 'Role-Based Access Control', desc: 'Users and administrators with differentiated permissions.' },
              { icon: '📋', title: 'Audit Logging', desc: 'Logging of every action with timestamp, user, and IP.' },
              { icon: '🔒', title: 'Secure Sessions', desc: 'httpOnly cookies managed by Better Auth.' },
              { icon: '🐳', title: 'Docker Compose', desc: 'All services in isolated and reproducible containers.' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{f.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Architecture diagram ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">Architecture Diagram</h2>

          <div className="flex flex-col items-center gap-0 text-xs">

            {/* Internet */}
            <div className="flex items-center justify-center w-full">
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span className="font-medium">Internet / Client</span>
              </div>
            </div>

            {/* Arrow down */}
            <div className="flex flex-col items-center py-1 text-gray-300">
              <div className="w-px h-5 bg-gray-200" />
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 10L1 4h10L6 10z" />
              </svg>
            </div>

            {/* DMZ zone */}
            <div className="w-full border border-blue-200 bg-blue-50 rounded-xl p-4">
              <p className="text-blue-500 font-bold uppercase tracking-widest text-xs mb-3">DMZ Zone</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-blue-100 rounded-lg px-4 py-2.5 text-center">
                  <p className="font-semibold text-gray-700">NGINX</p>
                  <p className="text-gray-400 text-xs mt-0.5">Reverse Proxy</p>
                </div>
                <div className="bg-white border border-blue-100 rounded-lg px-4 py-2.5 text-center">
                  <p className="font-semibold text-gray-700">React + Vite</p>
                  <p className="text-gray-400 text-xs mt-0.5">Frontend</p>
                </div>
              </div>
            </div>

            {/* Arrow down */}
            <div className="flex flex-col items-center py-1 text-gray-300">
              <div className="w-px h-5 bg-gray-200" />
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 10L1 4h10L6 10z" />
              </svg>
            </div>

            {/* Internal network */}
            <div className="w-full border border-indigo-200 bg-indigo-50 rounded-xl p-4">
              <p className="text-indigo-500 font-bold uppercase tracking-widest text-xs mb-3">Internal Network</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-indigo-100 rounded-lg px-4 py-2.5 text-center">
                  <p className="font-semibold text-gray-700">Express.js</p>
                  <p className="text-gray-400 text-xs mt-0.5">REST API</p>
                </div>
                <div className="bg-white border border-indigo-100 rounded-lg px-4 py-2.5 text-center">
                  <p className="font-semibold text-gray-700">Better Auth</p>
                  <p className="text-gray-400 text-xs mt-0.5">Authentication</p>
                </div>
              </div>
            </div>

            {/* Arrow down */}
            <div className="flex flex-col items-center py-1 text-gray-300">
              <div className="w-px h-5 bg-gray-200" />
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 10L1 4h10L6 10z" />
              </svg>
            </div>

            {/* Data layer */}
            <div className="w-full border border-purple-200 bg-purple-50 rounded-xl p-4">
              <p className="text-purple-500 font-bold uppercase tracking-widest text-xs mb-3">Data Layer</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-purple-100 rounded-lg px-4 py-2.5 text-center">
                  <p className="font-semibold text-gray-700">PostgreSQL</p>
                  <p className="text-gray-400 text-xs mt-0.5">Database</p>
                </div>
                <div className="bg-white border border-purple-100 rounded-lg px-4 py-2.5 text-center">
                  <p className="font-semibold text-gray-700">Prisma ORM</p>
                  <p className="text-gray-400 text-xs mt-0.5">Access layer</p>
                </div>
              </div>
            </div>

          </div>

          {/* Legend */}
          <div className="mt-5 flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100">
            <span className="text-xs text-gray-400 font-medium">Legend:</span>
            {[
              { color: 'bg-blue-200', label: 'Exposed DMZ' },
              { color: 'bg-indigo-200', label: 'Internal network' },
              { color: 'bg-purple-200', label: 'Isolated data' },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Tech stack ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">Technology Stack</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: 'React 18', role: 'UI / SPA', tag: 'Frontend', tagColor: 'bg-cyan-50 text-cyan-700' },
              { name: 'TypeScript', role: 'Static typing', tag: 'Cross-cutting', tagColor: 'bg-blue-50 text-blue-700' },
              { name: 'Vite', role: 'Bundler and dev server', tag: 'Frontend', tagColor: 'bg-cyan-50 text-cyan-700' },
              { name: 'Tailwind CSS', role: 'Utility styles', tag: 'Frontend', tagColor: 'bg-cyan-50 text-cyan-700' },
              { name: 'Express.js', role: 'REST API', tag: 'Backend', tagColor: 'bg-gray-100 text-gray-600' },
              { name: 'Better Auth', role: '2FA Authentication', tag: 'Backend', tagColor: 'bg-gray-100 text-gray-600' },
              { name: 'Prisma ORM', role: 'Typed data access', tag: 'Backend', tagColor: 'bg-gray-100 text-gray-600' },
              { name: 'PostgreSQL', role: 'Relational database', tag: 'Data', tagColor: 'bg-purple-50 text-purple-700' },
              { name: 'NGINX', role: 'Reverse proxy and TLS', tag: 'Infra', tagColor: 'bg-green-50 text-green-700' },
              { name: 'Docker Compose', role: 'Local orchestration', tag: 'Infra', tagColor: 'bg-green-50 text-green-700' },
              { name: 'Node.js LTS', role: 'Server runtime', tag: 'Backend', tagColor: 'bg-gray-100 text-gray-600' },
              { name: 'Prisma Migrate', role: 'Migration control', tag: 'Data', tagColor: 'bg-purple-50 text-purple-700' },
            ].map((tech) => (
              <div
                key={tech.name}
                className="flex flex-col justify-between p-3 border border-gray-100 rounded-xl hover:border-gray-200 hover:shadow-sm transition-all"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">{tech.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">{tech.role}</p>
                </div>
                <span className={`mt-2 self-start text-xs font-medium px-2 py-0.5 rounded-full ${tech.tagColor}`}>
                  {tech.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer info ── */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-400">
            DMZPanel · Secure architecture with network segmentation · React + Express + PostgreSQL + NGINX
          </p>
        </div>

      </div>
    </div>
  );
};

export default Home;
