import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, Trophy, Award, Star, ArrowLeft } from 'lucide-react';
import { getDatabase, ref, onValue, off, DataSnapshot } from 'firebase/database';

interface LeaderboardUser {
  telegramId: number;
  username: string;
  firstName: string;
  lastName: string;
  profilePhoto?: string;
  totalEarned: number;
  totalWithdrawn: number;
  balance: number;
  referredCount: number;
  rank: number;
}

interface LeaderBoardProps {
  onBack: () => void;
  currentUserId?: number;
}

const LeaderBoard: React.FC<LeaderBoardProps> = ({ onBack, currentUserId }) => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setError] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 4;

  const fetchLeaderboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const database = getDatabase();
      const usersRef = ref(database, 'users');

      onValue(
        usersRef,
        async (snapshot) => {
          if (snapshot.exists()) {
            const usersData = snapshot.val();

            const userPromises = Object.keys(usersData).map(async (userId) => {
              const user = usersData[userId];
              if (user && user.telegramId) {
                try {
                  const referralsRef = ref(database, `referrals/${userId}`);
                  const referralSnapshot: DataSnapshot = await new Promise((resolve) => {
                    onValue(referralsRef, resolve, { onlyOnce: true });
                  });

                  let referredCount = 0;
                  if (referralSnapshot.exists()) {
                    const referralData = referralSnapshot.val();
                    referredCount = referralData.referredCount || 0;
                  }

                  return {
                    telegramId: user.telegramId,
                    username: user.username || 'unknown',
                    firstName: user.firstName || 'User',
                    lastName: user.lastName || '',
                    profilePhoto: user.profilePhoto,
                    totalEarned: user.totalEarned || 0,
                    totalWithdrawn: user.totalWithdrawn || 0,
                    balance: user.balance || 0,
                    referredCount,
                    rank: 0,
                  };
                } catch {
                  return {
                    telegramId: user.telegramId,
                    username: user.username || 'unknown',
                    firstName: user.firstName || 'User',
                    lastName: user.lastName || '',
                    profilePhoto: user.profilePhoto,
                    totalEarned: user.totalEarned || 0,
                    totalWithdrawn: user.totalWithdrawn || 0,
                    balance: user.balance || 0,
                    referredCount: 0,
                    rank: 0,
                  };
                }
              }
              return null;
            });

            const resolvedUsers = await Promise.all(userPromises);
            const validUsers = resolvedUsers.filter((user) => user !== null) as LeaderboardUser[];

            const sortedUsers = validUsers
              .sort((a, b) => (b.totalEarned || 0) - (a.totalEarned || 0))
              .map((user, index) => ({ ...user, rank: index + 1 }));

            setLeaderboardData(sortedUsers);
            setIsLoading(false);
          } else {
            setLeaderboardData([]);
            setIsLoading(false);
          }
        },
        (error) => {
          console.error('Error fetching leaderboard data:', error);
          setError('Failed to load leaderboard data');
          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error('Error in fetchLeaderboardData:', error);
      setError('Failed to load leaderboard data');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
    const database = getDatabase();
    const usersRef = ref(database, 'users');
    return () => off(usersRef);
  }, []);

  const getDisplayValue = (user: LeaderboardUser) => `$${(user.totalEarned || 0).toFixed(2)}`;

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          icon: <Crown className="w-6 h-6 text-white" />,
          bgColor: 'from-yellow-400 to-yellow-600',
          borderColor: 'border-yellow-400',
          textColor: 'text-yellow-400',
          glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]',
        };
      case 2:
        return {
          icon: <Trophy className="w-5 h-5 text-white" />,
          bgColor: 'from-gray-400 to-gray-600',
          borderColor: 'border-gray-400',
          textColor: 'text-gray-300',
          glow: 'shadow-[0_0_15px_rgba(156,163,175,0.3)]',
        };
      case 3:
        return {
          icon: <Award className="w-5 h-5 text-white" />,
          bgColor: 'from-amber-600 to-amber-800',
          borderColor: 'border-amber-600',
          textColor: 'text-amber-600',
          glow: 'shadow-[0_0_15px_rgba(217,119,6,0.3)]',
        };
      default:
        return {
          icon: <Star className="w-4 h-4 text-white" />,
          bgColor: 'from-blue-500 to-blue-700',
          borderColor: 'border-blue-500',
          textColor: 'text-blue-400',
          glow: '',
        };
    }
  };

  const totalPages = Math.ceil(leaderboardData.length / usersPerPage);
  const paginatedData = leaderboardData.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentUserRank = leaderboardData.find((u) => u.telegramId === currentUserId);

  return (
    <div className="px-4 mt-6">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-white hover:text-blue-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Earnings Leaderboard</h1>
        <p className="text-blue-300">Top earners based on total earnings</p>
      </div>

      {/* Current User Rank */}
      {currentUserRank && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4 mb-6 border border-blue-400 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">#{currentUserRank.rank}</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Your Rank</h3>
                <p className="text-white/80 text-sm">
                  {getDisplayValue(currentUserRank)} • {currentUserRank.referredCount} referrals
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-lg">{getDisplayValue(currentUserRank)}</p>
              <p className="text-white/80 text-sm">Rank #{currentUserRank.rank}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Leaderboard List */}
      <div className="bg-[#0a1a2b] rounded-3xl border border-[#014983]/30 p-4">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center p-3 bg-[#0f1c34] rounded-2xl">
                <div className="w-8 h-8 bg-gray-600 rounded-full mr-3" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-600 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-600 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : leaderboardData.length === 0 ? (
          <div className="text-center py-8 text-blue-300">No Users Found</div>
        ) : (
          <div className="space-y-3">
            {paginatedData.map((user, index) => {
              const badge = getRankBadge(user.rank);
              const isCurrentUser = user.telegramId === currentUserId;
              return (
                <motion.div
                  key={user.telegramId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center justify-between p-3 bg-[#0f1c34] rounded-2xl border ${
                    isCurrentUser
                      ? 'border-blue-400 ring-2 ring-blue-400 ring-opacity-30'
                      : 'border-[#014983]/20'
                  }`}
                >
                  <div className="flex items-center">
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-r ${badge.bgColor} flex items-center justify-center mr-3`}
                      >
                        {badge.icon}
                      </div>
                      <div className="absolute -top-1 -left-1 w-5 h-5 bg-white rounded-full flex items-center justify-center text-black text-xs font-bold">
                        {user.rank}
                      </div>
                    </div>
                    <div>
                      <h3 className={`font-medium ${isCurrentUser ? 'text-blue-300' : 'text-white'}`}>
                        {user.firstName} {user.lastName}{' '}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs bg-blue-500 px-2 py-1 rounded-full text-white">
                            You
                          </span>
                        )}
                      </h3>
                      <p className="text-blue-300 text-sm">@{user.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${isCurrentUser ? 'text-blue-300' : 'text-white'}`}>
                      {getDisplayValue(user)}
                    </div>
                    <div className="text-blue-300 text-sm">{user.referredCount} referrals</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
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
  );
};

export default LeaderBoard;
