import { useState } from 'react';
import SettingsTab from '../components/SettingsTab';
import LogsTab from '../components/LogsTab';
import DatabaseTab from '../components/DatabaseTab';

type Tab = 'settings' | 'logs' | 'database' | 'roles';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'logs',
    label: 'Audit Logs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'database',
    label: 'Database',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
  {
    id: 'roles',
    label: 'User Roles',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

// ── User Roles tab (inline, replaces the old standalone page) ─────────────────

const PLACEHOLDER_ROLES = [
  { id: '1', name: 'Admin User', description: 'Full system access', endpoints: 12, users: 2 },
  { id: '2', name: 'Manager', description: 'Read and write access to core resources', endpoints: 7, users: 5 },
];

const PLACEHOLDER_ENDPOINTS = [
  { method: 'GET',  path: '/api/counter',           roles: ['Admin User', 'Manager'] },
  { method: 'POST', path: '/api/counter/increment',  roles: ['Admin User', 'Manager'] },
  { method: 'GET',  path: '/api/admin/users',        roles: ['Admin User'] },
  { method: 'POST', path: '/api/admin/users',        roles: ['Admin User'] },
  { method: 'GET',  path: '/api/admin/roles',        roles: ['Admin User'] },
];

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-blue-100 text-blue-700',
  POST:   'bg-green-100 text-green-700',
  PUT:    'bg-yellow-100 text-yellow-700',
  PATCH:  'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
};

const UserRolesTab = () => (
  <div className="space-y-8">
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
      <span className="font-semibold">Placeholder view —</span> Full RBAC management (create/edit roles,
      map endpoints, assign users) will be implemented in the next iteration.
    </div>

    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Roles</h2>
        <button disabled
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white opacity-50 cursor-not-allowed">
          + New Role
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDER_ROLES.map((role) => (
          <div key={role.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{role.name}</h3>
                <p className="mt-0.5 text-sm text-gray-500">{role.description}</p>
              </div>
              <button disabled className="text-xs text-gray-400 cursor-not-allowed">Edit</button>
            </div>
            <div className="mt-4 flex gap-4 text-sm text-gray-600">
              <span><span className="font-medium text-gray-900">{role.endpoints}</span> endpoints</span>
              <span><span className="font-medium text-gray-900">{role.users}</span> users</span>
            </div>
          </div>
        ))}
      </div>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Endpoint Mappings</h2>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Method</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Endpoint</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Allowed Roles</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {PLACEHOLDER_ENDPOINTS.map((ep) => (
              <tr key={`${ep.method}-${ep.path}`} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${METHOD_COLORS[ep.method] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ep.method}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-gray-800">{ep.path}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {ep.roles.map((r) => (
                      <span key={r} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{r}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button disabled className="text-xs text-gray-400 cursor-not-allowed">Configure</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">User Assignment</h2>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-center text-gray-400 text-sm">
        <p>User-to-role assignment UI will be available here.</p>
        <p className="mt-1">Admins will be able to search users and assign or revoke roles.</p>
      </div>
    </section>
  </div>
);

// ── Main dashboard component ──────────────────────────────────────────────────

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<Tab>('settings');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Manage system settings, audit logs, database, and user roles.</p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'settings'  && <SettingsTab />}
      {activeTab === 'logs'      && <LogsTab />}
      {activeTab === 'database'  && <DatabaseTab />}
      {activeTab === 'roles'     && <UserRolesTab />}
    </div>
  );
};

export default AdminDashboard;
