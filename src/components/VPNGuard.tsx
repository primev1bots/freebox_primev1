import React, { useState, useEffect } from 'react';
import { Shield, Wifi, WifiOff, RefreshCw, Globe } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, off } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCH4vpSVmGkjcgC4KiS_7JkD-uuFQFOqyw",
  authDomain: "freebox-primev1.firebaseapp.com",
  databaseURL: "https://freebox-primev1-default-rtdb.firebaseio.com",
  projectId: "freebox-primev1",
  storageBucket: "freebox-primev1.firebasestorage.app",
  messagingSenderId: "227315554911",
  appId: "1:227315554911:web:bae79fadb6100170ae19ea",
  measurementId: "G-3JZGRY5KGH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

interface VPNConfig {
  vpnRequired: boolean;
  allowedCountries: string[];
}

const VPNGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [vpnConfig, setVpnConfig] = useState<VPNConfig>({
    vpnRequired: true,
    allowedCountries: []
  });

  useEffect(() => {
    // Listen for VPN configuration changes
    const vpnConfigRef = ref(database, 'vpnConfig');
    
    const unsubscribe = onValue(vpnConfigRef, (snapshot) => {
      const config = snapshot.val();
      if (config) {
        setVpnConfig(config);
      }
    });

    return () => {
      off(vpnConfigRef, 'value', unsubscribe);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    
    // If VPN is not required, allow access immediately
    if (!vpnConfig.vpnRequired) {
      setAccessAllowed(true);
      return;
    }

    const timer = setTimeout(() => {
      if (mounted) {
        checkVPN();
      }
    }, 1000);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [vpnConfig.vpnRequired]);

  const checkVPN = async () => {
    // If VPN is not required, allow access
    if (!vpnConfig.vpnRequired) {
      setAccessAllowed(true);
      return;
    }

    setIsRetrying(true);
    try {
      const services = [
        "https://ipapi.co/json/",
        "https://ipwhois.app/json/",
        "https://api.ip.sb/geoip"
      ];

      let data = null;
      for (const service of services) {
        try {
          const response = await fetch(service, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
          });
          if (response.ok) {
            data = await response.json();
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!data) {
        throw new Error('Could not fetch location data');
      }

      const country = data.country || data.country_name || data.country_name || 'Unknown';
      const countryCode = data.country_code || data.country_code2 || '';

      // Check against allowed countries from Firebase
      const isAllowed = vpnConfig.allowedCountries.some(allowed => 
        country.toLowerCase().includes(allowed.toLowerCase()) ||
        countryCode.toLowerCase().includes(allowed.toLowerCase())
      );

      setAccessAllowed(isAllowed);

    } catch (error) {
      console.error('VPN check failed:', error);
      setAccessAllowed(false);
    } finally {
      setIsRetrying(false);
    }
  };

  // If VPN is not required, show children immediately
  if (!vpnConfig.vpnRequired) {
    return <>{children}</>;
  }

  if (accessAllowed === null) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a1a2b] to-[#0f2235] flex items-center justify-center z-50 p-4">
        <div className="bg-[#0a1a2b]/90 backdrop-blur-lg rounded-3xl border-2 border-blue-500/30 p-8 text-center max-w-md w-full shadow-2xl shadow-blue-500/10">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-3">
            Security Check
          </h2>
          <p className="text-blue-200 mb-6 text-sm leading-relaxed">
            Verifying your location and connection security
          </p>
          
          <div className="flex justify-center items-center space-x-3 bg-blue-500/10 rounded-2xl p-4 border border-blue-500/20">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-blue-300 text-sm font-medium">Network scanning...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!accessAllowed) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a1a2b] to-[#0f2235] flex items-center justify-center z-50 p-4">
        <div className="bg-[#0a1a2b]/90 backdrop-blur-lg rounded-3xl border-2 border-red-500/30 p-8 text-center max-w-md w-full shadow-2xl shadow-red-500/10">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
              <WifiOff className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-400 rounded-full flex items-center justify-center animate-pulse">
              <span className="text-white text-xs font-bold">!</span>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent mb-3">
            Access Restricted
          </h2>
          <p className="text-blue-200 text-sm leading-relaxed mb-2">
            This task requires a VPN connection from
          </p>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4">
            <p className="text-blue-200 text-sm leading-relaxed">
              <span className="font-bold text-cyan-400">
                {vpnConfig.allowedCountries
                  .filter((country, index, self) => 
                    country.length > 2 && self.indexOf(country) === index
                  )
                  .slice(0, 3)
                  .join(', ')}
                {vpnConfig.allowedCountries.length > 3 ? '...' : ''}
              </span>
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={checkVPN}
              disabled={isRetrying}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-blue-500/25 disabled:shadow-none"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Rechecking...
                </>
              ) : (
                <>
                  <Wifi className="w-5 h-5" />
                  Retry Connection
                </>
              )}
            </button>
            
            <div className="flex items-center justify-center gap-2 text-xs text-blue-400">
              <Shield className="w-3 h-3" />
              <span>Secure connection required</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default VPNGuard;
