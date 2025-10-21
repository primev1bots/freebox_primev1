import React from 'react';
import { getDatabase, ref, onValue, update, get, set, push } from 'firebase/database';

// ==== Types ====
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

type Provider = 'adexora' | 'gigapub' | 'onclicka' | 'auruads' | 'libtl' | 'adextra';

interface Ad {
  id: number;
  title: string;
  description: string;
  watched: number;
  dailyLimit: number;
  hourlyLimit: number;
  provider: Provider;
  waitTime: number;
  cooldown: number;
  reward: number;
  enabled: boolean;
  appId: string; // other providers use this; AdExtra uses script from index.html
  lastWatched?: Date;
}

interface AdsDashboardProps {
  userData?: UserData | null;
  walletConfig?: { currency: string; currencySymbol: string };
}

// ==== Globals (from providers' scripts & index.html) ====
declare global {
  interface Window {
    // callback-based AdExtra defined in index.html
    p_adextra?: (onSuccess: () => void, onError: () => void) => void;

    // other providers (optional)
    showAdexora?: () => Promise<void>;
    showGiga?: () => Promise<void>;
    showAd?: () => Promise<void>;
    showAuruads?: () => Promise<void>;
    initCdTma?: any;

    // libtl dynamic function name pattern show_<zoneId>
    [k: string]: any;
  }
}

const AdsDashboard: React.FC<AdsDashboardProps> = ({
  userData,
  walletConfig = { currency: 'USDT', currencySymbol: '' },
}) => {
  // ==== Local state ====
  const [ads, setAds] = React.useState<Ad[]>([
    { id: 1, title: 'Ads Task 1', description: '', watched: 0, dailyLimit: 5, hourlyLimit: 2, provider: 'adexora', waitTime: 5, cooldown: 60, reward: 0.5, enabled: true, appId: '387' },
    { id: 2, title: 'Ads Task 2', description: '', watched: 0, dailyLimit: 5, hourlyLimit: 2, provider: 'gigapub', waitTime: 5, cooldown: 60, reward: 0.5, enabled: true, appId: '1872' },
    { id: 3, title: 'Ads Task 3', description: '', watched: 0, dailyLimit: 5, hourlyLimit: 2, provider: 'onclicka', waitTime: 5, cooldown: 60, reward: 0.5, enabled: true, appId: '6090192' },
    { id: 4, title: 'Ads Task 4', description: '', watched: 0, dailyLimit: 5, hourlyLimit: 2, provider: 'auruads', waitTime: 5, cooldown: 60, reward: 0.5, enabled: true, appId: '7479' },
    { id: 5, title: 'Ads Task 5', description: '', watched: 0, dailyLimit: 5, hourlyLimit: 2, provider: 'libtl', waitTime: 5, cooldown: 60, reward: 0.5, enabled: true, appId: '9878570' },
    // Task 6 = AdExtra (script already loaded in index.html)
    { id: 6, title: 'Ads Task 6', description: '', watched: 0, dailyLimit: 5, hourlyLimit: 2, provider: 'adextra', waitTime: 5, cooldown: 60, reward: 0.5, enabled: true, appId: 'STATIC_FROM_INDEX_HTML' },
  ]);

  const [isWatchingAd, setIsWatchingAd] = React.useState<number | null>(null);
  const [scriptLoaded, setScriptLoaded] = React.useState<Record<Provider, boolean>>({
    adexora: false,
    gigapub: false,
    onclicka: false,
    auruads: false,
    libtl: false,
    adextra: true, // AdExtra comes from index.html; don't gate on dynamic loading
  });
  const [scriptsInitialized, setScriptsInitialized] = React.useState<Record<Provider, boolean>>({
    adexora: false,
    gigapub: false,
    onclicka: false,
    auruads: false,
    libtl: false,
    adextra: true,
  });
  const [cooldowns, setCooldowns] = React.useState<Record<string, number>>({});
  const [lastWatched, setLastWatched] = React.useState<Record<string, Date>>({});
  const [userMessages, setUserMessages] = React.useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [concurrentLock, setConcurrentLock] = React.useState<boolean>(false);
  const [timeUntilReset, setTimeUntilReset] = React.useState<string>('24:00:00');

  const database = getDatabase();

  // ==== Utils ====
  const showMessage = (type: 'success' | 'error' | 'info', message: string) => {
    setUserMessages({ type, message });
    setTimeout(() => setUserMessages(null), 4000);
  };

  const getBangladeshTime = (): Date => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 3600000 * 6);
  };
  const formatDate = (date: Date): string => date.toISOString().split('T')[0];

  // ==== Firebase helpers ====
  const firebaseRequest = {
    updateUser: async (telegramId: number, updates: Partial<UserData>): Promise<boolean> => {
      try {
        await update(ref(database, `users/${telegramId}`), updates);
        return true;
      } catch (e) {
        console.error('Error updating user:', e);
        return false;
      }
    },
    addTransaction: async (transaction: any): Promise<string> => {
      const transactionsRef = ref(database, 'transactions');
      const newRef = push(transactionsRef);
      const id = newRef.key!;
      await set(newRef, { ...transaction, id });
      return id;
    },
    addReferralCommission: async (referredUserId: number, earnedAmount: number): Promise<boolean> => {
      try {
        const commissionRate = 10;
        const referredUserRef = ref(database, `users/${referredUserId}`);
        const referredUserSnapshot = await get(referredUserRef);
        if (!referredUserSnapshot.exists()) return false;

        const referredUser = referredUserSnapshot.val() as UserData;
        const referrerId = referredUser.referredBy;
        if (!referrerId) return false;

        const commission = earnedAmount * (commissionRate / 100);
        const referrerRef = ref(database, `users/${referrerId}`);
        const referrerSnapshot = await get(referrerRef);
        if (!referrerSnapshot.exists()) return false;

        const referrer = referrerSnapshot.val() as UserData;
        const newBalance = (referrer.balance || 0) + commission;
        const newTotalEarned = (referrer.totalEarned || 0) + commission;
        await update(referrerRef, { balance: newBalance, totalEarned: newTotalEarned });

        const referralRef = ref(database, `referrals/${referrerId}`);
        const referralSnapshot = await get(referralRef);
        if (referralSnapshot.exists()) {
          const data = referralSnapshot.val() as any;
          if (!data.referredUsers) data.referredUsers = {};
          if (data.referredUsers[referredUserId]) {
            data.referredUsers[referredUserId].totalEarned += earnedAmount;
            data.referredUsers[referredUserId].commissionEarned += commission;
          } else {
            data.referredUsers[referredUserId] = {
              joinedAt: new Date().toISOString(),
              totalEarned: earnedAmount,
              commissionEarned: commission,
            };
          }
          data.referralEarnings = (data.referralEarnings || 0) + commission;
          data.referredCount = Object.keys(data.referredUsers).length;
          await set(referralRef, data);
        }

        await firebaseRequest.addTransaction({
          userId: referrerId.toString(),
          type: 'referral_commission',
          amount: commission,
          description: `${commissionRate}% commission from referral ${referredUser.firstName || referredUser.username}`,
          status: 'completed',
          createdAt: new Date().toISOString(),
        });

        return true;
      } catch (e) {
        console.error('Error adding referral commission:', e);
        return false;
      }
    },
  };

  // ==== Daily reset @ 6AM BD ====
  const checkAndPerformDailyReset = React.useCallback(async () => {
    try {
      const bdTime = getBangladeshTime();
      const today = formatDate(bdTime);
      const resetRef = ref(database, 'system/lastResetDate');
      const snapshot = await get(resetRef);
      const lastReset = snapshot.val();
      const currentHour = bdTime.getHours();
      const shouldReset = currentHour >= 6 && lastReset !== today;

      if (shouldReset) {
        await set(resetRef, today);
        const usersAdsRef = ref(database, 'userAds');
        const usersSnapshot = await get(usersAdsRef);
        if (usersSnapshot.exists()) {
          const usersData = usersSnapshot.val();
          const updates: any = {};
          Object.keys(usersData).forEach((uid) => {
            Object.keys(usersData[uid]).forEach((provider) => {
              updates[`userAds/${uid}/${provider}/watchedToday`] = 0;
              updates[`userAds/${uid}/${provider}/lastReset`] = new Date().toISOString();
            });
          });
          if (Object.keys(updates).length > 0) await update(ref(database), updates);
        }
      }
    } catch (e) {
      console.error('Daily reset check failed:', e);
    }
  }, [database]);

  React.useEffect(() => {
    const updateResetTime = () => {
      const bdTime = getBangladeshTime();
      const resetTime = new Date(bdTime);
      resetTime.setHours(6, 0, 0, 0);
      if (bdTime.getTime() >= resetTime.getTime()) resetTime.setDate(resetTime.getDate() + 1);

      const diff = resetTime.getTime() - bdTime.getTime();
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeUntilReset(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    checkAndPerformDailyReset();
    updateResetTime();
    const t = setInterval(updateResetTime, 1000);
    const r = setInterval(checkAndPerformDailyReset, 60000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [checkAndPerformDailyReset]);

  // ==== Load ads config from Firebase (rewards/limits) ====
  React.useEffect(() => {
    const adsRef = ref(database, 'ads');
    const unsubscribe = onValue(adsRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const adsData: Record<string, any> = snapshot.val();
      setAds((prev) =>
        prev.map((ad) => {
          const cfg = adsData[ad.provider];
          if (!cfg) return ad;
          return {
            ...ad,
            reward: cfg.reward ?? ad.reward,
            dailyLimit: cfg.dailyLimit ?? ad.dailyLimit,
            hourlyLimit: cfg.hourlyLimit ?? ad.hourlyLimit,
            cooldown: cfg.cooldown ?? ad.cooldown,
            enabled: cfg.enabled !== false,
            waitTime: cfg.waitTime ?? ad.waitTime,
            appId: cfg.appId ?? ad.appId,
            description: `${walletConfig.currency} ${cfg.reward ?? ad.reward} per ad`,
          };
        })
      );
      // reset script init flags for 1â€“5 after config changes
      setScriptsInitialized((prev) => ({
        ...prev,
        adexora: false,
        gigapub: false,
        onclicka: false,
        auruads: false,
        libtl: false,
      }));
    });
    return () => unsubscribe();
  }, [database, walletConfig.currency]);

  // ==== Load user's ad watch history ====
  React.useEffect(() => {
    if (!userData?.telegramId) return;
    const userAdsRef = ref(database, `userAds/${userData.telegramId}`);
    const unsubscribe = onValue(userAdsRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const userAdsData = snapshot.val();
      const newLastWatched: Record<string, Date> = {};
      const bdTime = getBangladeshTime();
      const today = formatDate(bdTime);

      setAds((prev) =>
        prev.map((ad) => {
          const pData = userAdsData[ad.provider];
          if (pData?.lastWatched) newLastWatched[ad.provider] = new Date(pData.lastWatched);

          let watchedToday = pData?.watchedToday || 0;
          const lastReset = pData?.lastReset;
          if (lastReset && formatDate(new Date(lastReset)) !== today) watchedToday = 0;

          return { ...ad, watched: watchedToday, lastWatched: pData?.lastWatched ? new Date(pData.lastWatched) : undefined };
        })
      );
      setLastWatched(newLastWatched);
    });
    return () => unsubscribe();
  }, [database, userData?.telegramId]);

  // ==== Cooldown ticker ====
  React.useEffect(() => {
    const iv = setInterval(() => {
      const next: Record<string, number> = {};
      Object.keys(lastWatched).forEach((provider) => {
        const ad = ads.find((a) => a.provider === provider);
        if (ad && lastWatched[provider]) {
          const elapsed = (Date.now() - lastWatched[provider].getTime()) / 1000;
          if (elapsed < ad.cooldown) next[provider] = Math.ceil(ad.cooldown - elapsed);
        }
      });
      setCooldowns(next);
    }, 1000);
    return () => clearInterval(iv);
  }, [lastWatched, ads]);

  // ==== Provider scripts (dynamic) â€” for providers 1â€“5 only ====
  React.useEffect(() => {
    const initScripts = () => {
      ads.forEach((ad) => {
        if (!ad.enabled || scriptsInitialized[ad.provider]) return;
        switch (ad.provider) {
          case 'adexora': {
            if (!document.getElementById('adexora-script')) {
              const s = document.createElement('script');
              s.id = 'adexora-script';
              s.src = `https://adexora.com/cdn/ads.js?id=${ad.appId}`;
              s.async = true;
              s.onload = () => {
                setScriptLoaded((p) => ({ ...p, adexora: typeof window.showAdexora === 'function' }));
                setScriptsInitialized((p) => ({ ...p, adexora: true }));
              };
              s.onerror = () => setScriptsInitialized((p) => ({ ...p, adexora: true }));
              document.head.appendChild(s);
            } else {
              setScriptLoaded((p) => ({ ...p, adexora: true }));
              setScriptsInitialized((p) => ({ ...p, adexora: true }));
            }
            break;
          }
          case 'gigapub': {
            if (!document.getElementById('gigapub-script')) {
              const s = document.createElement('script');
              s.id = 'gigapub-script';
              s.src = `https://ad.gigapub.tech/script?id=${ad.appId}`;
              s.async = true;
              s.onload = () => {
                setScriptLoaded((p) => ({ ...p, gigapub: typeof window.showGiga === 'function' }));
                setScriptsInitialized((p) => ({ ...p, gigapub: true }));
              };
              s.onerror = () => setScriptsInitialized((p) => ({ ...p, gigapub: true }));
              document.head.appendChild(s);
            } else {
              setScriptLoaded((p) => ({ ...p, gigapub: true }));
              setScriptsInitialized((p) => ({ ...p, gigapub: true }));
            }
            break;
          }
          case 'onclicka': {
            if (!document.getElementById('onclicka-script')) {
              const s = document.createElement('script');
              s.id = 'onclicka-script';
              s.src = 'https://js.onclckvd.com/in-stream-ad-admanager/tma.js';
              s.async = true;
              s.onload = async () => {
                try {
                  if (window.initCdTma) {
                    const show = await window.initCdTma({ id: ad.appId });
                    window.showAd = show;
                    setScriptLoaded((p) => ({ ...p, onclicka: typeof window.showAd === 'function' }));
                  }
                } catch (e) {
                  console.error('Onclicka init failed', e);
                } finally {
                  setScriptsInitialized((p) => ({ ...p, onclicka: true }));
                }
              };
              s.onerror = () => setScriptsInitialized((p) => ({ ...p, onclicka: true }));
              document.head.appendChild(s);
            } else {
              setScriptLoaded((p) => ({ ...p, onclicka: true }));
              setScriptsInitialized((p) => ({ ...p, onclicka: true }));
            }
            break;
          }
          case 'auruads': {
            if (!document.getElementById('auruads-script')) {
              const s = document.createElement('script');
              s.id = 'auruads-script';
              s.src = `https://auruads.com/cdn/ads.js?app_uid=${ad.appId}`;
              s.async = true;
              s.onload = () => {
                setScriptLoaded((p) => ({ ...p, auruads: typeof window.showAuruads === 'function' }));
                setScriptsInitialized((p) => ({ ...p, auruads: true }));
              };
              s.onerror = () => setScriptsInitialized((p) => ({ ...p, auruads: true }));
              document.head.appendChild(s);
            } else {
              setScriptLoaded((p) => ({ ...p, auruads: true }));
              setScriptsInitialized((p) => ({ ...p, auruads: true }));
            }
            break;
          }
          case 'libtl': {
            if (!document.getElementById('libtl-script')) {
              const s = document.createElement('script');
              s.id = 'libtl-script';
              s.src = '//libtl.com/sdk.js';
              s.setAttribute('data-zone', ad.appId);
              s.setAttribute('data-sdk', `show_${ad.appId}`);
              s.async = true;
              s.onload = () => {
                const ok = typeof window[`show_${ad.appId}`] === 'function';
                setScriptLoaded((p) => ({ ...p, libtl: ok }));
                setScriptsInitialized((p) => ({ ...p, libtl: true }));
              };
              s.onerror = () => setScriptsInitialized((p) => ({ ...p, libtl: true }));
              document.head.appendChild(s);
            } else {
              setScriptLoaded((p) => ({ ...p, libtl: true }));
              setScriptsInitialized((p) => ({ ...p, libtl: true }));
            }
            break;
          }
          case 'adextra': {
            // AdExtra is expected to be included in index.html and exposes window.p_adextra
            setScriptLoaded((p) => ({ ...p, adextra: typeof window.p_adextra === 'function' || p.adextra }));
            setScriptsInitialized((p) => ({ ...p, adextra: true }));
            break;
          }
        }
      });
    };
    initScripts();
    return () => {
      // cleanup dynamic provider scripts (keep index.html AdExtra)
      ['adexora-script', 'gigapub-script', 'onclicka-script', 'auruads-script', 'libtl-script'].forEach((id) => {
        const n = document.getElementById(id);
        if (n) n.remove();
      });
    };
  }, [ads, scriptsInitialized]);

  // ==== Earning + persistence ====
  const updateUserAdWatch = async (adId: number) => {
    if (!userData?.telegramId) return;
    const ad = ads.find((a) => a.id === adId);
    if (!ad) return;

    const userAdRef = ref(database, `userAds/${userData.telegramId}/${ad.provider}`);
    const now = new Date().toISOString();
    await update(userAdRef, {
      watchedToday: (ad.watched || 0) + 1,
      lastWatched: now,
      lastUpdated: now,
    });
  };

  const recordAdWatch = async (adId: number): Promise<number> => {
    if (!userData) {
      showMessage('error', 'User not loaded. Try again.');
      return 0;
    }
    const ad = ads.find((a) => a.id === adId);
    if (!ad) return 0;

    try {
      const now = new Date();
      const lastWatch = userData.lastAdWatch ? new Date(userData.lastAdWatch) : null;
      let newAdsWatchedToday = userData.adsWatchedToday || 0;
      if (lastWatch && lastWatch.toDateString() !== now.toDateString()) newAdsWatchedToday = 0;

      const reward = ad.reward;
      const newBalance = userData.balance + reward;
      const newTotalEarned = userData.totalEarned + reward;
      const newAdsCount = newAdsWatchedToday + 1;

      await firebaseRequest.updateUser(userData.telegramId, {
        balance: newBalance,
        totalEarned: newTotalEarned,
        adsWatchedToday: newAdsCount,
        lastAdWatch: now.toISOString(),
      });

      await firebaseRequest.addTransaction({
        userId: userData.telegramId.toString(),
        type: 'earn',
        amount: reward,
        description: 'Watched advertisement',
        status: 'completed',
        createdAt: now.toISOString(),
      });

      if (userData.referredBy) {
        await firebaseRequest.addReferralCommission(userData.telegramId, reward);
      }

      return reward;
    } catch (e) {
      console.error('recordAdWatch error:', e);
      showMessage('error', 'Error recording reward.');
      return 0;
    }
  };

  const handleAdCompletion = async (adId: number) => {
    await updateUserAdWatch(adId);
    const earned = await recordAdWatch(adId);
    if (earned > 0) showMessage('success', `Ad completed! You earned ${walletConfig.currencySymbol} ${earned}`);
  };

  const formatTime = (sec: number): string => (sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`);

  // ==== AdExtra (callback-based) ====
  const runAdExtra = async (adId: number, ad: Ad) => {
    if (typeof window.p_adextra !== 'function') {
      showMessage('info', 'AdExtra initializingâ€¦ please try again in a moment');
      setConcurrentLock(false);
      setIsWatchingAd(null);
      return;
    }
    const timeoutMs = Math.max(15000, ad.waitTime * 1000 + 5000);

    const release = () => {
      setConcurrentLock(false);
      setIsWatchingAd(null);
    };
    const onSuccess = async () => {
      await handleAdCompletion(adId);
      setAds((prev) => prev.map((a) => (a.id === adId ? { ...a, watched: a.watched + 1 } : a)));
      setLastWatched((prev) => ({ ...prev, [ad.provider]: new Date() }));
      release();
    };
    const onError = () => {
      showMessage('error', 'Ad failed or was skipped. Try again.');
      release();
    };

    const to = setTimeout(() => {
      console.warn('AdExtra timed out without callback');
      onError();
    }, timeoutMs);

    const wrappedSuccess = () => {
      clearTimeout(to);
      onSuccess();
    };
    const wrappedError = () => {
      clearTimeout(to);
      onError();
    };

    window.p_adextra(wrappedSuccess, wrappedError);
  };

  // ==== Main showAd ====
  const showAd = async (adId: number) => {
    if (concurrentLock) {
      showMessage('info', 'Please complete the current ad first');
      return;
    }
    const ad = ads.find((a) => a.id === adId);
    if (!ad) {
      showMessage('error', 'Ad not found');
      return;
    }
    if (!ad.enabled) {
      showMessage('error', 'This ad provider is temporarily unavailable');
      return;
    }

    // AdExtra should not wait for dynamic scriptLoaded â€” it comes from index.html
    if (ad.provider !== 'adextra' && !scriptLoaded[ad.provider]) {
      showMessage('info', 'Ad provider is loading... Please wait a moment');
      return;
    }

    const now = new Date();
    if (ad.dailyLimit > 0 && ad.watched >= ad.dailyLimit) {
      showMessage('info', 'Daily limit reached. Come back tomorrow!');
      return;
    }
    if (lastWatched[ad.provider]) {
      const elapsed = (now.getTime() - lastWatched[ad.provider].getTime()) / 1000;
      if (elapsed < ad.cooldown) {
        const waitLeft = Math.ceil(ad.cooldown - elapsed);
        showMessage('info', `Please wait ${formatTime(waitLeft)} before next ad`);
        return;
      }
    }

    setConcurrentLock(true);
    setIsWatchingAd(adId);
    showMessage('info', 'Preparing adâ€¦');

    try {
      if (ad.provider === 'adextra') {
        await runAdExtra(adId, ad);
        return; // callbacks will release lock
      }

      const minWaitTime = ad.waitTime;
      const start = Date.now();
      let adCompleted = false;

      if (ad.provider === 'adexora' && window.showAdexora) {
        await window.showAdexora(); adCompleted = true;
      } else if (ad.provider === 'gigapub' && window.showGiga) {
        await window.showGiga(); adCompleted = true;
      } else if (ad.provider === 'onclicka' && window.showAd) {
        await window.showAd(); adCompleted = true;
      } else if (ad.provider === 'auruads' && window.showAuruads) {
        await window.showAuruads(); adCompleted = true;
      } else if (ad.provider === 'libtl') {
        const fn = window[`show_${ad.appId}` as keyof Window] as (() => Promise<void>) | undefined;
        if (fn) { await fn(); adCompleted = true; }
        else { throw new Error('Libtl ad function not available'); }
      } else {
        throw new Error('Ad provider function not available');
      }

      if (adCompleted) {
        const elapsed = (Date.now() - start) / 1000;
        if (elapsed >= minWaitTime) {
          await handleAdCompletion(adId);
          setAds((prev) => prev.map((a) => (a.id === adId ? { ...a, watched: a.watched + 1 } : a)));
          setLastWatched((prev) => ({ ...prev, [ad.provider]: now }));
        } else {
          throw new Error(`Please watch the ad completely (minimum ${minWaitTime} seconds)`);
        }
      }
    } catch (e) {
      console.error('Ad error:', e);
      showMessage('error', 'Ad was not completed.');
    } finally {
      if (ad?.provider !== 'adextra') {
        setConcurrentLock(false);
        setIsWatchingAd(null);
      }
    }
  };

  const isAdDisabled = (ad: Ad) => {
    if (!ad.enabled) return true;
    if (ad.dailyLimit > 0 && ad.watched >= ad.dailyLimit) return true;
    if (cooldowns[ad.provider]) return true;
    if (ad.provider !== 'adextra' && !scriptLoaded[ad.provider]) return true;
    if (concurrentLock && isWatchingAd !== ad.id) return true;
    return false;
  };

  const getButtonText = (ad: Ad) => {
    if (!ad.enabled) return 'Temporarily Disabled';
    if (ad.dailyLimit > 0 && ad.watched >= ad.dailyLimit) return 'Daily Limit Reached';
    if (cooldowns[ad.provider]) return `Wait ${formatTime(cooldowns[ad.provider])}`;
    if (ad.provider !== 'adextra' && !scriptLoaded[ad.provider]) return 'Loading...';
    if (concurrentLock && isWatchingAd !== ad.id) return 'Another Ad in Progress';
    if (isWatchingAd === ad.id) return 'Watching Ad...';
    return 'Watch Now';
  };

  // ==== UI ====
  return (
    <div className="grid grid-cols-2 gap-2">
      {userMessages && (
        <div
          className={`col-span-2 p-3 rounded-2xl mb-2 text-center font-bold ${
            userMessages.type === 'success'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : userMessages.type === 'error'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}
        >
          {userMessages.message}
        </div>
      )}

      <div className="col-span-2 bg-[#0a1a2b] rounded-3xl p-3 border border-[#014983]/40 shadow-lg mb-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-blue-300">Daily reset in:</span>
          <span className="text-green-400 font-bold">{timeUntilReset}</span>
          <span className="text-blue-300">Reset: 6 AM (BD Time)</span>
        </div>
      </div>

      {ads.map((ad) => (
        <div key={ad.id} className="bg-[#0a1a2b] rounded-3xl p-2 border border-[#014983]/40 shadow-lg">
          <div className="flex items-center mb-2">
            <div className="bg-gradient-to-tr from-purple-500 via-pink-500 to-indigo-500 p-3 rounded-2xl shadow-md mr-4 flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{ad.title}</h3>
              <p className="text-[12px] text-blue-300 mt-1">{ad.description}</p>
            </div>
          </div>

          <div className="w-full bg-[#014983]/20 rounded-full h-4 mb-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((ad.watched / ad.dailyLimit) * 100, 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-sm text-blue-300 font-medium mb-5">
            <span>
              {ad.watched} / {ad.dailyLimit} watched
            </span>
            <span className="text-green-400">wait: {ad.waitTime}s</span>
          </div>

          <div className="flex justify-center">
            <button
              className="w-11/12 bg-gradient-to-r from-purple-500 via-blue-500 to-blue-500 hover:from-blue-600 hover:via-blue-600 hover:to-blue-600 text-white py-2 rounded-3xl text-sm font-bold shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => showAd(ad.id)}
              disabled={isAdDisabled(ad) || isWatchingAd === ad.id}
            >
              {isWatchingAd === ad.id ? 'Watching Ad...' : getButtonText(ad)}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdsDashboard;
