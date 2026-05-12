import { useState, useEffect } from 'react';

interface SystemSetting {
  id: string;
  settingKey: string;
  isEnabled: boolean;
  providerConfig: any;
  updatedAt: string;
  createdAt: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || '';

const SettingsTab = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/admin/settings`, {
        headers: {
          'x-admin-secret': ADMIN_SECRET
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSettings(data.filter((s: SystemSetting) => s.settingKey.startsWith('auth_')));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = async (setting: SystemSetting) => {
    setUpdating(setting.id);
    try {
      const response = await fetch(`${API_BASE}/api/admin/settings/${setting.settingKey}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET
        },
        body: JSON.stringify({
          isEnabled: !setting.isEnabled
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update setting: ${response.statusText}`);
      }
      
      // Refresh settings after update
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update setting');
      console.error('Error updating setting:', err);
    } finally {
      setUpdating(null);
    }
  };

  const formatSettingName = (key: string): string => {
    // Convert auth_google_enabled to "Google"
    return key
      .replace('auth_', '')
      .replace('_enabled', '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchSettings}
          className="mt-2 text-red-600 underline hover:text-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Authentication Providers</h3>
          <p className="text-sm text-gray-600 mt-1">
            Enable or disable authentication providers for your application
          </p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {settings.map((setting) => (
            <div
              key={setting.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1">
                <h4 className="text-base font-medium text-gray-900">
                  {formatSettingName(setting.settingKey)}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  Key: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{setting.settingKey}</code>
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className={`text-sm font-medium ${setting.isEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                  {setting.isEnabled ? 'Enabled' : 'Disabled'}
                </span>
                
                <button
                  onClick={() => handleToggle(setting)}
                  disabled={updating === setting.id}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    setting.isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  } ${updating === setting.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      setting.isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
          
          {settings.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              No authentication provider settings found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
