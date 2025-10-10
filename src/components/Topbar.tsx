import React, { useState, useEffect } from 'react';
import { FaWallet } from 'react-icons/fa';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

interface TopbarProps {
  userData: {
    balance?: number;
  } | null;
  setShowWallet: (show: boolean) => void;
}

interface AppConfig {
  logoUrl: string;
  appName: string;
}

interface WalletConfig {
  currency: string;
  currencySymbol: string;
  defaultMinWithdrawal: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

const Topbar: React.FC<TopbarProps> = ({ userData, setShowWallet }) => {
  const [appConfig, setAppConfig] = useState<AppConfig>({
    logoUrl: "https://res.cloudinary.com/deu1ngeov/image/upload/v1758400527/slide3_lds1l1.jpg",
    appName: "PRIME V1"
  });

  const [walletConfig, setWalletConfig] = useState<WalletConfig>({
    currency: 'USDT',
    currencySymbol: '$',
    defaultMinWithdrawal: 10,
    maintenanceMode: false,
    maintenanceMessage: 'Wallet is under maintenance. Please try again later.'
  });

  useEffect(() => {
    // Listen for app configuration changes from Firebase
    const configRef = ref(database, 'appConfig');
    const walletConfigRef = ref(database, 'walletConfig');
    
    const unsubscribeAppConfig = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAppConfig(prevConfig => ({
          ...prevConfig,
          ...data
        }));
      }
    });

    const unsubscribeWalletConfig = onValue(walletConfigRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setWalletConfig(prevConfig => ({
          ...prevConfig,
          ...data
        }));
      } else {
        // Set default wallet config if not exists
        setWalletConfig({
          currency: 'USDT',
          currencySymbol: '$',
          defaultMinWithdrawal: 10,
          maintenanceMode: false,
          maintenanceMessage: 'Wallet is under maintenance. Please try again later.'
        });
      }
    });

    return () => {
      unsubscribeAppConfig();
      unsubscribeWalletConfig();
    };
  }, []);

  return (
    <div className="px-4 z-10 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="rounded-3xl bg-[#0a1a2b] border border-[#014983]/30">
            <img
              src={appConfig.logoUrl || "https://res.cloudinary.com/deu1ngeov/image/upload/v1758400527/slide3_lds1l1.jpg"}
              alt="logo"
              className="w-10 h-10 object-cover rounded-full"
            />
          </div>
          <p className="text-sm text-blue-400">{appConfig.appName}</p>
        </div>

        <div
          className="flex items-center border-2 border-[#014983]/40 rounded-full px-4 py-[2px] bg-[#0a1a2b] cursor-pointer"
          onClick={() => setShowWallet(true)}
        >
          <FaWallet className="text-blue-400 text-2xl mb-1" />
          <div className="h-[32px] w-[2px] bg-[#014983]/40 mx-2"></div>
          <div className="flex-1 text-center">
            <p className="text-xs text-blue-300 font-medium">Balance</p>
            <div className="flex items-center justify-center space-x-1">
              <p className="text-sm text-green-500">
                {walletConfig.currency} {(userData?.balance || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Topbar;