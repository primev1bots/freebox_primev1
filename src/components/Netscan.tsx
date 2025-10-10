// Netscan.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Wifi, WifiOff, Globe, AlertTriangle, CheckCircle } from 'lucide-react';

interface NetworkScanResult {
  ip: string;
  country: string;
  vpn: boolean;
  allowed: boolean;
  reason: string;
  asnInfo?: {
    autonomous_system_number?: number;
    autonomous_system_organization?: string;
  };
}

interface NetscanProps {
  onScanComplete?: (result: NetworkScanResult) => void;
  onContinue?: () => void;
}

const Netscan: React.FC<NetscanProps> = ({ onScanComplete, onContinue }) => {
  const [scanResult, setScanResult] = useState<NetworkScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    scanNetwork();
  }, []);

  useEffect(() => {
    if (scanResult && onScanComplete) onScanComplete(scanResult);
  }, [scanResult, onScanComplete]);

  const scanNetwork = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const progressInterval = setInterval(() => {
        setProgress(prev => (prev >= 90 ? 90 : prev + 10));
      }, 200);

      const response = await fetch('http://localhost:3000');
      clearInterval(progressInterval);

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data: NetworkScanResult = await response.json();
      setProgress(100);
      setScanResult(data);

      if (data.allowed && onContinue) {
        setTimeout(() => onContinue(), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      setScanResult({
        ip: 'Unknown',
        country: 'Unknown',
        vpn: false,
        allowed: false,
        reason: 'Scan failed, cannot continue'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    if (isLoading) return 'text-blue-400';
    if (error) return 'text-yellow-400';
    if (scanResult?.allowed) return 'text-green-400';
    return 'text-red-400';
  };

  const getStatusIcon = () => {
    if (isLoading) return <Wifi className="w-8 h-8 animate-pulse" />;
    if (error) return <AlertTriangle className="w-8 h-8" />;
    if (scanResult?.allowed) return <CheckCircle className="w-8 h-8" />;
    return <WifiOff className="w-8 h-8" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-8 max-w-md w-full text-white"
      >
        <div className="text-center mb-8">
          <motion.div initial={{ y: -20 }} animate={{ y: 0 }} className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-blue-400" />
              </div>
            </div>
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">Network Security Scan</h1>
          <p className="text-white/70">Checking your connection security...</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span>Scan Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
            />
          </div>
        </div>

        {/* Status & Results */}
        <div className="bg-black/30 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={getStatusColor()}>{getStatusIcon()}</div>
              <div>
                <h3 className="font-semibold">Connection Status</h3>
                <p className="text-sm text-white/70">
                  {isLoading ? 'Scanning network...' :
                   error ? 'Scan failed' :
                   scanResult?.allowed ? 'Secure connection' : 'Security issue detected'}
                </p>
              </div>
            </div>
          </div>

          {scanResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-white/70">IP Address:</span><span className="font-mono">{scanResult.ip}</span></div>
              <div className="flex justify-between"><span className="text-white/70">Country:</span><span className="flex items-center"><Globe className="w-4 h-4 mr-1" />{scanResult.country}</span></div>
              <div className="flex justify-between"><span className="text-white/70">VPN Detected:</span><span className={scanResult.vpn ? 'text-yellow-400' : 'text-green-400'}>{scanResult.vpn ? 'Yes' : 'No'}</span></div>
              <div className="flex justify-between"><span className="text-white/70">Status:</span><span className={scanResult.allowed ? 'text-green-400' : 'text-red-400'}>{scanResult.allowed ? 'Allowed' : 'Blocked'}</span></div>
              {scanResult.asnInfo && (
                <>
                  <div className="flex justify-between"><span className="text-white/70">ASN:</span><span>{scanResult.asnInfo.autonomous_system_number || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-white/70">Provider:</span><span className="text-right max-w-[200px] truncate">{scanResult.asnInfo.autonomous_system_organization || 'Unknown'}</span></div>
                </>
              )}
            </motion.div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex space-x-3">
          {!isLoading && !scanResult?.allowed && <button onClick={scanNetwork} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-4 rounded-2xl font-semibold transition-colors">Rescan</button>}
          {!isLoading && onContinue && <button onClick={onContinue} disabled={!scanResult?.allowed && !error} className={`flex-1 py-3 px-4 rounded-2xl font-semibold transition-colors ${scanResult?.allowed || error ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-500 text-gray-300 cursor-not-allowed'}`}>Continue</button>}
        </div>
      </motion.div>
    </div>
  );
};

export default Netscan;
