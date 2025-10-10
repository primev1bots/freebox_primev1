import React from 'react';
import { motion } from 'framer-motion';
import { User, RefreshCw, Shield } from 'lucide-react';

interface SplashScreenProps {
  mainAccount?: {
    username: string;
    userId: number;
  };
  maxAccountsPerDevice?: number;
  onRetry: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ 
  mainAccount,
  onRetry 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent"></div>
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, type: 'spring', stiffness: 100 }}
        className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-blue-500/30 p-8 max-w-md w-full text-white text-center shadow-2xl shadow-blue-500/10"
      >
        {/* Header Icon */}
        <motion.div
          initial={{ y: -20, scale: 0.8 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="flex justify-center mb-6"
        >
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center border border-blue-400/40 shadow-lg shadow-blue-500/20">
              <Shield className="w-12 h-12 text-white" />
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent"
        >
          Account Limit Reached
        </motion.h1>

        {/* Main Account Info */}
        {mainAccount && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-blue-500/10 border border-blue-400/40 rounded-2xl p-5 mb-6 backdrop-blur-sm"
          >
            <div className="flex items-center justify-center mb-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-400/30 mr-3">
                <User className="w-5 h-5 text-blue-300" />
              </div>
              <span className="text-blue-300 font-semibold text-lg">Your Main Account</span>
            </div>
            <div className="text-sm text-blue-200 space-y-1">
              <p className="flex justify-between">
                <span className="text-blue-300">Username:</span>
                <span className="font-mono bg-blue-500/10 px-2 py-1 rounded-2xl">@{mainAccount.username}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-blue-300">User ID:</span>
                <span className="font-mono bg-blue-500/10 px-2 py-1 rounded-2xl">{mainAccount.userId}</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Rules */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-gray-800/40 border border-gray-600/40 rounded-2xl p-4 mb-6"
        >
          <h3 className="text-gray-300 font-semibold mb-2 text-sm">Account Rules</h3>
          <ul className="text-xs text-gray-400 text-left space-y-1">
            <li>• Max 2 accounts per device</li>
            <li>• First account becomes main account</li>
            <li>• Use your main account for best experience</li>
            <li>• Contact support for help</li>
          </ul>
        </motion.div>

        {/* Retry Button */}
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          onClick={onRetry}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3"
        >
          <RefreshCw className="w-5 h-5" />
          <span className="text-lg">Retry with Main Account</span>
        </motion.button>

        {/* Footer */}
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-sm text-gray-400 mt-5 flex items-center justify-center"
        >
          <Shield className="w-4 h-4 mr-2" />
          For assistance, contact support
        </motion.p>
      </motion.div>
    </div>
  );
};

export default SplashScreen;
