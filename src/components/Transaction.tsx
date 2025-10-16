import React, { useState } from 'react';
import Coins from '../icons/Coins.tsx';
import { ArrowLeft } from 'lucide-react';

interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  method?: string;
  accountNumber?: string;
  createdAt: string;
}

interface UserData {
  telegramId: number;
  username: string;
  firstName: string;
  lastName: string;
  profilePhoto?: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  joinDate: string;
  adsWatchedToday: number;
  tasksCompleted: Record<string, number>;
  lastAdWatch?: string;
  referredBy?: string;
}

interface WalletConfig {
  currency: string;
  currencySymbol: string;
  currencyDecimals: number;
  defaultMinWithdrawal: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

interface TransactionProps {
  userData: UserData | null;
  transactions: Transaction[];
  onBack: () => void;
  walletConfig: WalletConfig;
}

const Transaction: React.FC<TransactionProps> = ({ userData, transactions, onBack, walletConfig }) => {
  const [filter, setFilter] = useState<'all' | 'earn' | 'withdrawal'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 3;

  // Function to format numbers with 5 digit precision
  const formatAmount = (amount: number): string => {
    if (amount === 0) return '0.00000';
    
    // Convert to fixed 5 decimal places
    return amount.toFixed(5);
  };

  // Function specifically for balance display with 5 digits
  const formatBalanceAmount = (amount: number): string => {
    if (amount === 0) return '0.00000';
    
    // Ensure exactly 5 digits after decimal
    return amount.toFixed(5);
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (filter === 'all') return true;
    if (filter === 'earn') {
      return (
        transaction.type === 'earn' ||
        transaction.type === 'reward' ||
        transaction.type === 'referral_commission'
      );
    }
    if (filter === 'withdrawal') {
      return transaction.type === 'withdrawal';
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / perPage);
  const startIndex = (currentPage - 1) * perPage;
  const currentTransactions = filteredTransactions.slice(startIndex, startIndex + perPage);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const getTransactionIcon = (type: string) => {
    const isEarn = type === 'earn' || type === 'reward' || type === 'referral_commission';

    return (
      <div className={`p-2 rounded-3xl mr-3 ${isEarn ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
        <Coins className={`w-5 h-5 ${isEarn ? 'text-green-400' : 'text-red-400'}`} />
      </div>
    );
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'earn':
        return 'Ad Reward';
      case 'reward':
        return 'Task Reward';
      case 'referral_commission':
        return 'Referral Commission';
      case 'withdrawal':
        return 'Withdrawal';
      default:
        return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-blue-300';
    }
  };

  return (
    <div className="px-4 mt-6">
      {/* Header */}
      <div className="flex items-center mb-6 cursor-pointer" onClick={onBack}>
        <ArrowLeft className="w-5 h-5 text-white mr-2" />
        <span className="text-white font-bold text-lg">Transaction History</span>
      </div>

      {/* Balance Summary */}
      <div className="bg-[#0a1a2b] rounded-3xl p-4 mb-4 border border-[#014983]/30">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-blue-300 text-sm">Total Earned</p>
            <p className="text-green-400 font-bold text-lg">
              {walletConfig.currency} {userData?.totalEarned ? formatBalanceAmount(userData.totalEarned) : '0.00000'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-blue-300 text-sm">Total Withdrawn</p>
            <p className="text-red-400 font-bold text-lg">
              {walletConfig.currency} {userData?.totalWithdrawn ? formatBalanceAmount(userData.totalWithdrawn) : '0.00000'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex justify-between mb-4 bg-[#0a1a2b] rounded-3xl p-1 border border-[#014983]/30">
        <button
          className={`flex-1 py-2 rounded-3xl text-sm font-medium transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-300 hover:text-white'
            }`}
          onClick={() => {
            setFilter('all');
            setCurrentPage(1);
          }}
        >
          All
        </button>
        <button
          className={`flex-1 py-2 rounded-3xl text-sm font-medium transition-all ${filter === 'earn' ? 'bg-green-600 text-white shadow-lg' : 'text-green-300 hover:text-white'
            }`}
          onClick={() => {
            setFilter('earn');
            setCurrentPage(1);
          }}
        >
          Earnings
        </button>
        <button
          className={`flex-1 py-2 rounded-3xl text-sm font-medium transition-all ${filter === 'withdrawal'
              ? 'bg-red-600 text-white shadow-lg'
              : 'text-red-300 hover:text-white'
            }`}
          onClick={() => {
            setFilter('withdrawal');
            setCurrentPage(1);
          }}
        >
          Withdrawals
        </button>
      </div>

      {/* Transactions List */}
      <div className="bg-[#0a1a2b] rounded-3xl p-4 border border-[#014983]/30">
        {currentTransactions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-blue-300 text-lg mb-2">No transactions found</div>
            <p className="text-blue-200 text-sm">
              {filter === 'all'
                ? "You haven't made any transactions yet"
                : `No ${filter} transactions found`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentTransactions.map(transaction => {
              const date = new Date(transaction.createdAt);
              const isEarn =
                transaction.type === 'earn' ||
                transaction.type === 'reward' ||
                transaction.type === 'referral_commission';

              return (
                <div
                  key={transaction.id}
                  className="bg-[#0f1c34] rounded-3xl p-4 border border-[#014983]/20 hover:border-[#014983]/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      {getTransactionIcon(transaction.type)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white">
                            {getTransactionTypeLabel(transaction.type)}
                          </p>
                          <span
                            className={`font-bold ${isEarn ? 'text-green-400' : 'text-red-400'}`}
                          >
                            {isEarn ? '+' : '-'}{formatAmount(transaction.amount)}{walletConfig.currencySymbol} 
                          </span>
                        </div>
                        <p className="text-xs text-blue-300 mt-1">{transaction.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-blue-200">
                            {date.toLocaleDateString()} •{' '}
                            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <span
                            className={`text-xs font-medium ${getStatusColor(transaction.status)}`}
                          >
                            {transaction.status.charAt(0).toUpperCase() +
                              transaction.status.slice(1)}
                          </span>
                        </div>
                        {transaction.method && (
                          <div className="flex items-center mt-1">
                            <span className="text-xs text-blue-200">
                              Method: {transaction.method}
                            </span>
                            {transaction.accountNumber && (
                              <span className="text-xs text-blue-200 ml-2">
                                • {transaction.accountNumber}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-4 space-x-4">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm rounded-lg bg-[#0f1c34] text-blue-300 disabled:opacity-40 hover:text-white"
            >
              Prev
            </button>
            <span className="text-blue-300 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm rounded-lg bg-[#0f1c34] text-blue-300 disabled:opacity-40 hover:text-white"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transaction;
