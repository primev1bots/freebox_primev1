import React from 'react';
import Coins from '../icons/Coins';
import Friends from '../icons/Friends';
import History from '../icons/History';
import Home from '../icons/Home';
import Profile from '../icons/Profile';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setShowWallet: (show: boolean) => void;
  balance: number;
  showWallet?: boolean;
  showDailyTasks?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  showWallet = false,
  showDailyTasks = false
}) => {
  if (showWallet || showDailyTasks) return null;

  const tabs = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'earn', label: 'Earn', Icon: Coins },
    { id: 'referrals', label: 'Referrals', Icon: Friends },
    { id: 'history', label: 'History', Icon: History },
    { id: 'profile', label: 'Profile', Icon: Profile },
  ];

  return (
    <div className="fixed bottom-2 left-1/2 transform -translate-x-1/2 w-[calc(100%-1rem)] max-w-xl h-[70px] bg-[#111111]/90 backdrop-blur-md flex justify-around items-center z-50 rounded-3xl text-xs border border-[#014983]/20">
      {tabs.map(({ id, label, Icon }) => (
        <div
          key={id}
          className={`flex-1 m-1 p-2 rounded-3xl cursor-pointer flex flex-col items-center justify-center transition-all duration-300 ease-out
            ${activeTab === id ? 'bg-[#014983] text-white' : 'text-blue-300 hover:bg-[#014983]/20'}`}
          onClick={() => setActiveTab(id)}
        >
          <Icon
            className={`w-8 h-8 mx-auto transition-transform duration-300 ${
              activeTab === id ? 'scale-110' : 'scale-100'
            }`}
          />
          <p
            className={`mt-1 overflow-hidden transition-all duration-300 ease-in-out
              ${activeTab === id ? 'opacity-100 max-h-6' : 'opacity-0 max-h-0'}`}
          >
            {label}
          </p>
        </div>
      ))}
    </div>
  );
};

export default Navbar;
