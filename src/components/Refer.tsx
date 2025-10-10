import React, { useState, useEffect, useRef } from 'react';
import { FaUserFriends, FaTelegramPlane, FaWhatsapp } from 'react-icons/fa';
import { database, ref, onValue, get } from '../firebase';

interface ReferUser {
  chat_id: string;
  first_name: string;
  profile_photo_url?: string;
  total_balance: number;
  joinedAt: string;
  commissionEarned: number;
}

interface ReferralData {
  referralCode: string;
  referredCount: number;
  referralEarnings: number;
  referredUsers: Record<string, {
    joinedAt: string;
    totalEarned: number;
    commissionEarned: number;
  }>;
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

interface AppConfig {
  logoUrl: string;
  appName: string;
  sliderImages: Array<{
    id: string;
    url: string;
    alt: string;
    order: number;
    createdAt: string;
  }>;
  supportUrl: string;
  tutorialVideoId: string;
  referralCommissionRate?: number;
}

// In ReferPage component
interface ReferPageProps {
  userId: string;
  referralData: ReferralData | null;
  userData?: UserData | null;
}

const ReferPage: React.FC<ReferPageProps> = ({ userId }) => {
  const [referrals, setReferrals] = useState<ReferUser[]>([]);
  const [referralStats, setReferralStats] = useState({ referredCount: 0, referralEarnings: 0 });
  const [, setUserData] = useState<UserData | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [commissionRate, setCommissionRate] = useState<number>(10); // Default to 10%
  const referralsPerPage = 5;
  
  // Use refs to track commission state without causing re-renders
  const commissionAddedRef = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);

  // Fetch user data
  useEffect(() => {
    const userRef = ref(database, `users/${userId}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setUserData(data);
        
        // Initialize commissionAddedRef with current balance to prevent adding commission on first load
        if (!hasInitializedRef.current) {
          commissionAddedRef.current = data.balance || 0;
          hasInitializedRef.current = true;
        }
      }
    });
    return () => unsubscribe();
  }, [userId]);

  // Fetch app config to get commission rate
  useEffect(() => {
    const configRef = ref(database, 'appConfig');
    const unsubscribe = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const config = snapshot.val() as AppConfig;
        setCommissionRate(config.referralCommissionRate || 10);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch referrals
  useEffect(() => {
    const referralsRef = ref(database, `referrals/${userId}`);
    const unsubscribe = onValue(referralsRef, async (snapshot) => {
      if (!snapshot.exists()) return;

      const referralData = snapshot.val() as ReferralData;
      const refs: ReferUser[] = [];

      setReferralStats({
        referredCount: referralData.referredCount || 0,
        referralEarnings: referralData.referralEarnings || 0
      });

      if (referralData.referredUsers) {
        for (const [referredUserId, referralInfo] of Object.entries(referralData.referredUsers)) {
          try {
            const userRef = ref(database, `users/${referredUserId}`);
            const userSnap = await get(userRef);
            if (userSnap.exists()) {
              const user = userSnap.val();
              refs.push({
                chat_id: referredUserId,
                first_name: user.firstName || user.username || 'Unknown User',
                profile_photo_url: user.profilePhoto,
                total_balance: user.balance || 0,
                joinedAt: referralInfo.joinedAt,
                commissionEarned: referralInfo.commissionEarned || 0
              });
            }
          } catch (err) {
            console.error('Error fetching referral user:', err);
          }
        }
      }

      setReferrals(refs.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()));
    });

    return () => unsubscribe();
  }, [userId]);

  // Calculate total commission (DISPLAY ONLY - not for adding to balance)
  const totalCommissionFromReferrals = referrals.reduce((total, referral) => {
    return total + (referral.commissionEarned || referral.total_balance * (commissionRate / 100));
  }, 0);

  const botUsername = "bnvktfffbot";
  const referralLink = `https://t.me/${botUsername}?start=${userId}`;
  const shareText = encodeURIComponent(`🚀 Join me and earn crypto rewards! Use my referral link: ${referralLink}`);

  const copyLink = () => navigator.clipboard.writeText(referralLink).then(() => alert("Referral link copied! 🎉"));
  const shareOnTelegram = () => window.open(`https://t.me/share/url?url=${referralLink}&text=${shareText}`, "_blank");
  const shareOnWhatsApp = () => window.open(`https://api.whatsapp.com/send?text=${shareText}`, "_blank");

  const filteredReferrals = referrals.filter(r => r.first_name.toLowerCase().includes(search.toLowerCase()));

  const indexOfLastReferral = currentPage * referralsPerPage;
  const indexOfFirstReferral = indexOfLastReferral - referralsPerPage;
  const currentReferrals = filteredReferrals.slice(indexOfFirstReferral, indexOfLastReferral);
  const totalPages = Math.ceil(filteredReferrals.length / referralsPerPage);

  const nextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
  const prevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };

  const getCommission = (referral: ReferUser) => referral.commissionEarned || referral.total_balance * (commissionRate / 100);

  return (
    <div className="px-4 mt-6 space-y-6">
      {/* Referral Summary Card */}
      <div className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-3xl p-6 text-center border border-blue-400/30 shadow-2xl">
        <FaUserFriends className="w-16 h-16 mx-auto text-blue-300 mb-4" />
        <h3 className="font-bold text-2xl mb-2 text-white">Invite Friends & Earn</h3>
        
        {/* Commission Rate Display */}
        <p className="text-sm text-blue-200 mb-4">Earn <span className="font-bold text-green-400">{commissionRate}% commission</span> on friends' earnings!</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-black/30 rounded-3xl p-5 shadow-lg flex flex-col items-center justify-center hover:scale-105 transition-transform">
            <p className="text-3xl font-extrabold text-white">{referralStats.referredCount}</p>
            <p className="text-[13px] text-white/80 mt-1">Total Referred</p>
          </div>

          <div className="bg-black/30 rounded-3xl p-5 shadow-lg flex flex-col items-center justify-center hover:scale-105 transition-transform">
            <p className="text-3xl font-extrabold text-white">
              ${totalCommissionFromReferrals.toFixed(2)}
            </p>
            <p className="text-[13px] text-white/80 mt-1">Total Commission</p>
          </div>
        </div>

        <div className="bg-black/40 rounded-3xl p-4 mb-4">
          <p className="text-xs text-blue-200 mb-2">Your Personal Referral Link</p>
          <div className="flex items-center justify-between bg-black/50 p-3 rounded-xl">
            <span className="text-blue-400 text-sm truncate flex-1">{referralLink}</span>
            <button onClick={copyLink} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm ml-2 transition-colors">Copy</button>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={shareOnTelegram} className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 rounded-3xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2">
            <FaTelegramPlane className="w-4 h-4" /> Telegram
          </button>

          <button onClick={shareOnWhatsApp} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-3xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2">
            <FaWhatsapp className="w-4 h-4" /> WhatsApp
          </button>
        </div>
      </div>

      {/* Referrals List */}
      <div className="bg-[#0a1a2b] rounded-3xl p-6 border border-[#014983]/40 shadow-lg">
        <h3 className="font-bold text-lg mb-4 text-white text-center">Your Referrals</h3>
        
        <input 
          type="text" 
          placeholder="Search referrals..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          className="w-full p-3 rounded-2xl border border-[#014983]/30 bg-[#0f2235] text-white focus:outline-none focus:ring-2 focus:ring-blue-600 mb-4" 
        />

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {currentReferrals.length === 0 ? (
            <div className="text-center py-8">
              <FaUserFriends className="w-12 h-12 text-blue-400 mx-auto mb-3" />
              <p className="text-blue-300">No referrals yet</p>
              <p className="text-sm text-blue-400 mt-1">Share your link to start earning!</p>
            </div>
          ) : (
            <>
              {currentReferrals.map(referral => (
                <div key={referral.chat_id} className="bg-[#0f2235] rounded-3xl p-4 flex items-center justify-between hover:bg-[#11263d] transition-colors">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={referral.profile_photo_url || "https://res.cloudinary.com/deu1ngeov/image/upload/v1758779824/Unknown_zbnrig.jpg"} 
                      alt="Profile" 
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{referral.first_name}</p>
                      <p className="text-xs text-blue-300">Joined: {new Date(referral.joinedAt).toLocaleDateString()}</p>
                      <p className="text-xs text-green-300">Balance: ${referral.total_balance.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 text-sm font-medium">+${getCommission(referral).toFixed(2)}</div>
                    <div className="text-xs text-blue-300">Your {commissionRate}%</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-3 space-x-3">
            <button onClick={prevPage} disabled={currentPage === 1} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">Prev</button>
            <span className="text-white">{currentPage} / {totalPages}</span>
            <button onClick={nextPage} disabled={currentPage === totalPages} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">Next</button>
          </div>
        )}
      </div>

      {/* How It Works Section */}
      <div className="bg-[#0a1a2b] rounded-3xl p-4 border border-[#014983]/40 shadow-lg">
        <h3 className="font-bold text-lg mb-4 text-white text-center">How It Works</h3>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-1">1</div>
            <div>
              <p className="text-white font-medium">Share your referral link</p>
              <p className="text-blue-300 text-sm">Send your unique link to friends</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-1">2</div>
            <div>
              <p className="text-white font-medium">Friends sign up</p>
              <p className="text-blue-300 text-sm">They join using your link</p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-1">3</div>
            <div>
              <p className="text-white font-medium">Earn {commissionRate}% commission</p>
              <p className="text-blue-300 text-sm">Get {commissionRate}% of everything they earn</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferPage;