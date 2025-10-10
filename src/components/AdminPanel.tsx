import React, { useState, useEffect } from 'react';
import { ref, set, get, onValue, off } from 'firebase/database';
import { database } from '../firebase';
import { Settings, Save, RefreshCw } from 'lucide-react';

interface DeviceRestrictions {
  maxAccountsPerDevice: number;
  enabled: boolean;
  lastUpdated: string;
  updatedBy: string;
}

interface AppConfig {
  logoUrl: string;
  appName: string;
  sliderImages: any[];
  supportUrl: string;
  tutorialVideoId: string;
  referralCommissionRate?: number;
}

interface AdminPanelProps {
  transactions: any[];
  onUpdateTransaction: (transactionId: string, updates: any) => void;
  walletConfig: any;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ }) => {
  const [, setDeviceRestrictions] = useState<DeviceRestrictions>({
    maxAccountsPerDevice: 2,
    enabled: true,
    lastUpdated: new Date().toISOString(),
    updatedBy: 'admin'
  });
  const [, setAppConfig] = useState<AppConfig | null>(null);
  const [maxAccounts, setMaxAccounts] = useState(2);
  const [restrictionsEnabled, setRestrictionsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const adminFirebase = {
    getDeviceRestrictions: async (): Promise<DeviceRestrictions> => {
      try {
        const restrictionsRef = ref(database, 'deviceRestrictions');
        const snapshot = await get(restrictionsRef);
        if (snapshot.exists()) return snapshot.val();
        const defaultRestrictions: DeviceRestrictions = {
          maxAccountsPerDevice: 2,
          enabled: true,
          lastUpdated: new Date().toISOString(),
          updatedBy: 'system'
        };
        await set(restrictionsRef, defaultRestrictions);
        return defaultRestrictions;
      } catch (error) {
        console.error('Error getting device restrictions:', error);
        throw error;
      }
    },

    updateDeviceRestrictions: async (updates: Partial<DeviceRestrictions>): Promise<boolean> => {
      try {
        const restrictionsRef = ref(database, 'deviceRestrictions');
        const snapshot = await get(restrictionsRef);
        const currentRestrictions = snapshot.exists() ? snapshot.val() : {};
        const updatedRestrictions = {
          ...currentRestrictions,
          ...updates,
          lastUpdated: new Date().toISOString(),
          updatedBy: 'admin'
        };
        await set(restrictionsRef, updatedRestrictions);
        return true;
      } catch (error) {
        console.error('Error updating device restrictions:', error);
        return false;
      }
    },

    getAppConfig: async (): Promise<AppConfig> => {
      try {
        const configRef = ref(database, 'appConfig');
        const snapshot = await get(configRef);
        if (snapshot.exists()) return snapshot.val();
        const defaultConfig: AppConfig = {
          logoUrl: "",
          appName: "PRIME V1",
          sliderImages: [],
          supportUrl: "https://t.me/YourChannelName",
          tutorialVideoId: "dQw4w9WgXcQ",
          referralCommissionRate: 10
        };
        await set(configRef, defaultConfig);
        return defaultConfig;
      } catch (error) {
        console.error('Error getting app config:', error);
        throw error;
      }
    },
  };

  useEffect(() => {
    loadDeviceRestrictions();
    loadAppConfig();

    const restrictionsRef = ref(database, 'deviceRestrictions');
    const unsubscribe = onValue(restrictionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const restrictions = snapshot.val();
        setDeviceRestrictions(restrictions);
        setMaxAccounts(restrictions.maxAccountsPerDevice || 2);
        setRestrictionsEnabled(restrictions.enabled !== false);
        console.log('Device restrictions updated in realtime:', restrictions);
      }
    });

    return () => {
      off(restrictionsRef, 'value', unsubscribe);
    };
  }, []);

  const loadDeviceRestrictions = async () => {
    try {
      setIsLoading(true);
      const restrictions = await adminFirebase.getDeviceRestrictions();
      setDeviceRestrictions(restrictions);
      setMaxAccounts(restrictions.maxAccountsPerDevice);
      setRestrictionsEnabled(restrictions.enabled);
    } catch (error) {
      console.error('Error loading device restrictions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAppConfig = async () => {
    try {
      const config = await adminFirebase.getAppConfig();
      setAppConfig(config);
    } catch (error) {
      console.error('Error loading app config:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaveStatus('saving');
      const success = await adminFirebase.updateDeviceRestrictions({
        maxAccountsPerDevice: maxAccounts,
        enabled: restrictionsEnabled
      });
      if (success) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
        alert(`Device restrictions updated successfully!\n\nMax Accounts: ${maxAccounts}\nEnabled: ${restrictionsEnabled ? 'Yes' : 'No'}`);
      } else {
        setSaveStatus('error');
        alert('Failed to update device restrictions. Please try again.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
      alert('Error saving settings.');
    }
  };

  const handleResetToDefault = async () => {
    if (!confirm('Are you sure you want to reset device restrictions to default values?')) return;
    try {
      setSaveStatus('saving');
      const success = await adminFirebase.updateDeviceRestrictions({
        maxAccountsPerDevice: 2,
        enabled: true
      });
      if (success) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
        alert('Device restrictions reset to default values successfully!');
      } else {
        setSaveStatus('error');
        alert('Failed to reset device restrictions.');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      setSaveStatus('error');
      alert('Error resetting settings.');
    }
  };

  const renderAccountLimitsTab = () => (
    <div className="space-y-6">
      {/* Configuration Section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Settings className="w-5 h-5 mr-2 text-blue-400" />
            Device Restrictions Configuration
          </h3>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            saveStatus === 'success' ? 'bg-green-500/20 text-green-400' :
            saveStatus === 'error' ? 'bg-red-500/20 text-red-400' :
            saveStatus === 'saving' ? 'bg-blue-500/20 text-blue-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {saveStatus === 'success' ? 'Saved!' :
             saveStatus === 'error' ? 'Error!' :
             saveStatus === 'saving' ? 'Saving...' : 'Ready'}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Maximum Accounts Per Device
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="number"
                min="1"
                max="10"
                value={maxAccounts}
                onChange={(e) => setMaxAccounts(parseInt(e.target.value) || 1)}
                disabled={!restrictionsEnabled}
                className="w-28 text-center text-xl font-bold text-white bg-gray-800 border border-gray-600 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-gray-400">accounts per device</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Current setting: {maxAccounts} account{maxAccounts !== 1 ? 's' : ''} per device
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleSaveSettings}
              disabled={saveStatus === 'saving' || isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              {saveStatus === 'saving' ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{saveStatus === 'saving' ? 'Saving Changes...' : 'Save Restrictions'}</span>
            </button>

            <button
              onClick={handleResetToDefault}
              disabled={saveStatus === 'saving'}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-gray-400">Device Restrictions Management</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-400/30 rounded-2xl px-4 py-2">
            <div className="text-blue-300 text-sm">Live Updates</div>
            <div className="text-white font-semibold">Active</div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-2" />
              <p className="text-gray-400">Loading device restrictions...</p>
            </div>
          ) : (
            renderAccountLimitsTab()
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
