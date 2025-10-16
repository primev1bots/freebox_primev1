import React from 'react';
import { getDatabase, ref, onValue, update, get, set } from 'firebase/database';

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

interface Ad {
  id: number;
  title: string;
  description: string;
  watched: number;
  dailyLimit: number;
  hourlyLimit: number;
  provider: 'adexora' | 'gigapub' | 'onclicka' | 'auruads' | 'libtl' | 'adextra';
  waitTime: number;
  cooldown: number;
  reward: number;
  enabled: boolean;
  appId: string;
  lastWatched?: Date;
}

interface AdsDashboardProps {
  onAdComplete: (adId: number, reward: number) => Promise<void>;
  userData?: UserData | null;
}

declare global {
  interface Window {
    showAdexora?: () => Promise<void>;
    showGiga?: () => Promise<void>;
    showAd?: () => Promise<void>;
    showAuruads?: () => Promise<void>;
    show_9878570?: () => Promise<void>;
    p_adextra?: (onSuccess: () => void, onError: () => void) => void;
    initCdTma?: any;
  }
}

const AdsDashboard: React.FC<AdsDashboardProps> = ({ onAdComplete, userData }) => {
  const [ads, setAds] = React.useState<Ad[]>([]);
  const [isWatchingAd, setIsWatchingAd] = React.useState<number | null>(null);
  const [scriptLoaded, setScriptLoaded] = React.useState<Record<string, boolean>>({
    adexora: false,
    gigapub: false,
    onclicka: false,
    auruads: false,
    libtl: false,
    adextra: false,
  });
  const [cooldowns, setCooldowns] = React.useState<Record<string, number>>({});
  const [lastWatched, setLastWatched] = React.useState<Record<string, Date>>({});
  const [scriptsInitialized, setScriptsInitialized] = React.useState<Record<string, boolean>>({
    adexora: false,
    gigapub: false,
    onclicka: false,
    auruads: false,
    libtl: false,
    adextra: false,
  });
  const [, setUserMessages] = React.useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);
  const [concurrentLock, setConcurrentLock] = React.useState<boolean>(false);
  const [timeUntilReset, setTimeUntilReset] = React.useState<string>('24:00:00');
  const [, setLastResetDate] = React.useState<string>('');

  const database = getDatabase();

  // Default ads configuration
  const defaultAds: Ad[] = [
    { 
      id: 1, 
      title: "Ads Task 1", 
      description: "Earn $0.50 per ad", 
      watched: 0, 
      dailyLimit: 5, 
      hourlyLimit: 2, 
      provider: 'adexora', 
      waitTime: 5, 
      cooldown: 60, 
      reward: 0.5, 
      enabled: true,
      appId: '387'
    },
    { 
      id: 2, 
      title: "Ads Task 2", 
      description: "Earn $0.50 per ad", 
      watched: 0, 
      dailyLimit: 5, 
      hourlyLimit: 2, 
      provider: 'gigapub', 
      waitTime: 5, 
      cooldown: 60, 
      reward: 0.5, 
      enabled: true,
      appId: '1872'
    },
    { 
      id: 3, 
      title: "Ads Task 3", 
      description: "Earn $0.50 per ad", 
      watched: 0, 
      dailyLimit: 5, 
      hourlyLimit: 2, 
      provider: 'onclicka', 
      waitTime: 5, 
      cooldown: 60, 
      reward: 0.5, 
      enabled: true,
      appId: '6090192'
    },
    { 
      id: 4, 
      title: "Ads Task 4", 
      description: "Earn $0.50 per ad", 
      watched: 0, 
      dailyLimit: 5, 
      hourlyLimit: 2, 
      provider: 'auruads', 
      waitTime: 5, 
      cooldown: 60, 
      reward: 0.5, 
      enabled: true,
      appId: '7479'
    },
    { 
      id: 5, 
      title: "Ads Task 5", 
      description: "Earn $0.50 per ad", 
      watched: 0, 
      dailyLimit: 5, 
      hourlyLimit: 2, 
      provider: 'libtl', 
      waitTime: 5, 
      cooldown: 60, 
      reward: 0.5, 
      enabled: true,
      appId: '9878570'
    },
    { 
      id: 6, 
      title: "Ads Task 6", 
      description: "Earn $0.50 per ad", 
      watched: 0, 
      dailyLimit: 5, 
      hourlyLimit: 2, 
      provider: 'adextra', 
      waitTime: 5, 
      cooldown: 60, 
      reward: 0.5, 
      enabled: true,
      appId: 'c573986974ab6f6b9e52bb47e7a296e25a2db758'
    },
  ];

  // Get Bangladesh time (UTC+6)
  const getBangladeshTime = (): Date => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 6)); // UTC+6 for Bangladesh
  };

  // Format date as YYYY-MM-DD for comparison
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Check and perform daily reset if needed
  const checkAndPerformDailyReset = React.useCallback(async () => {
    try {
      const bdTime = getBangladeshTime();
      const today = formatDate(bdTime);
      
      // Get last reset date from Firebase
      const resetRef = ref(database, 'system/lastResetDate');
      const snapshot = await get(resetRef);
      const lastReset = snapshot.val();

      // If it's 6 AM or after and we haven't reset today, perform reset
      const currentHour = bdTime.getHours();
      const shouldReset = currentHour >= 6 && lastReset !== today;

      if (shouldReset) {
        console.log('Performing daily reset for all users...');
        
        // Update last reset date
        await set(resetRef, today);
        
        // Reset all users' watched ads
        const usersAdsRef = ref(database, 'userAds');
        const usersSnapshot = await get(usersAdsRef);
        
        if (usersSnapshot.exists()) {
          const usersData = usersSnapshot.val();
          const updates: any = {};
          
          // Reset watchedToday for all users and all providers
          Object.keys(usersData).forEach(userId => {
            Object.keys(usersData[userId]).forEach(provider => {
              updates[`userAds/${userId}/${provider}/watchedToday`] = 0;
              updates[`userAds/${userId}/${provider}/lastReset`] = new Date().toISOString();
            });
          });
          
          // Perform batch update
          if (Object.keys(updates).length > 0) {
            await update(ref(database), updates);
            console.log('Daily reset completed for all users');
          }
        }
        
        setLastResetDate(today);
      } else if (lastReset) {
        setLastResetDate(lastReset);
      }
    } catch (error) {
      console.error('Error during daily reset check:', error);
    }
  }, [database]);

  // Calculate time until next reset (6 AM Bangladesh time)
  React.useEffect(() => {
    const updateResetTime = () => {
      const bdTime = getBangladeshTime();
      const resetTime = new Date(bdTime);
      
      // Set reset time to 6 AM Bangladesh time
      resetTime.setHours(6, 0, 0, 0);
      
      // If it's already past 6 AM today, set to 6 AM tomorrow
      if (bdTime.getTime() >= resetTime.getTime()) {
        resetTime.setDate(resetTime.getDate() + 1);
      }
      
      const diff = resetTime.getTime() - bdTime.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeUntilReset(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    // Initial check for reset
    checkAndPerformDailyReset();
    
    // Update reset time every second
    updateResetTime();
    const interval = setInterval(updateResetTime, 1000);
    
    // Check for reset every minute (in case the app was open during reset time)
    const resetCheckInterval = setInterval(checkAndPerformDailyReset, 60000);
    
    return () => {
      clearInterval(interval);
      clearInterval(resetCheckInterval);
    };
  }, [checkAndPerformDailyReset]);

  // Show user-friendly messages
  const showMessage = (type: 'success' | 'error' | 'info', message: string) => {
    setUserMessages({ type, message });
    setTimeout(() => setUserMessages(null), 4000);
  };

  // Load ads configuration from Firebase - FIXED VERSION
  React.useEffect(() => {
    const adsRef = ref(database, 'ads');
    const unsubscribe = onValue(adsRef, (snapshot) => {
      if (snapshot.exists()) {
        const adsData: Record<string, any> = snapshot.val();
        console.log('Loaded ads config from Firebase:', adsData);
        
        // Create updated ads array based on Firebase config
        const updatedAds = defaultAds.map(ad => {
          const adConfig = adsData[ad.provider];
          if (adConfig) {
            const updatedAd = {
              ...ad,
              reward: adConfig.reward ?? ad.reward,
              dailyLimit: adConfig.dailyLimit ?? ad.dailyLimit,
              hourlyLimit: adConfig.hourlyLimit ?? ad.hourlyLimit,
              cooldown: adConfig.cooldown ?? ad.cooldown,
              enabled: adConfig.enabled !== false,
              waitTime: adConfig.waitTime ?? ad.waitTime,
              appId: adConfig.appId ?? ad.appId,
              description: `Earn $${(adConfig.reward ?? ad.reward).toFixed(2)} per ad`
            };
            console.log(`Updated ad ${ad.provider}:`, updatedAd);
            return updatedAd;
          }
          return ad;
        });
        
        setAds(updatedAds);
        
        // Reset script initialization state to reload scripts with new config
        setScriptsInitialized({
          adexora: false,
          gigapub: false,
          onclicka: false,
          auruads: false,
          libtl: false,
          adextra: false,
        });
      } else {
        // If no Firebase config, use defaults
        console.log('No Firebase ads config found, using defaults');
        setAds(defaultAds);
      }
    });

    return () => unsubscribe();
  }, [database]);

  // Load user's ad watch history with reset check
  React.useEffect(() => {
    if (userData?.telegramId) {
      const userAdsRef = ref(database, `userAds/${userData.telegramId}`);
      const unsubscribe = onValue(userAdsRef, (snapshot) => {
        if (snapshot.exists()) {
          const userAdsData = snapshot.val();
          const newLastWatched: Record<string, Date> = {};
          const bdTime = getBangladeshTime();
          const today = formatDate(bdTime);
          
          setAds(prevAds => prevAds.map(ad => {
            const providerData = userAdsData[ad.provider];
            if (providerData?.lastWatched) {
              newLastWatched[ad.provider] = new Date(providerData.lastWatched);
            }
            
            // Check if we need to reset locally (fallback)
            let watchedToday = providerData?.watchedToday || 0;
            const lastReset = providerData?.lastReset;
            
            if (lastReset && formatDate(new Date(lastReset)) !== today) {
              watchedToday = 0;
            }
            
            return {
              ...ad,
              watched: watchedToday,
              lastWatched: providerData?.lastWatched ? new Date(providerData.lastWatched) : undefined
            };
          }));
          
          setLastWatched(newLastWatched);
        }
      });

      return () => unsubscribe();
    }
  }, [database, userData?.telegramId]);

  // Load ad provider scripts with dynamic App IDs - FIXED VERSION
  React.useEffect(() => {
    const initializeScripts = () => {
      ads.forEach(ad => {
        if (!ad.enabled || scriptsInitialized[ad.provider]) return;

        console.log(`Initializing script for ${ad.provider} with appId: ${ad.appId}`);

        switch (ad.provider) {
          case 'adexora':
            if (!document.getElementById('adexora-script')) {
              const script = document.createElement('script');
              script.id = 'adexora-script';
              script.src = `https://adexora.com/cdn/ads.js?id=${ad.appId}`;
              script.async = true;
              script.onload = () => {
                setScriptLoaded(prev => ({ ...prev, adexora: typeof window.showAdexora === 'function' }));
                setScriptsInitialized(prev => ({ ...prev, adexora: true }));
                showMessage('info', 'Adexora ads are ready!');
              };
              script.onerror = () => {
                console.error('Failed to load Adexora script');
                setScriptsInitialized(prev => ({ ...prev, adexora: true }));
                showMessage('error', 'Failed to load Adexora ads');
              };
              document.head.appendChild(script);
            } else {
              setScriptLoaded(prev => ({ ...prev, adexora: true }));
              setScriptsInitialized(prev => ({ ...prev, adexora: true }));
            }
            break;

          case 'gigapub':
            if (!document.getElementById('gigapub-script')) {
              const script = document.createElement('script');
              script.id = 'gigapub-script';
              script.src = `https://ad.gigapub.tech/script?id=${ad.appId}`;
              script.async = true;
              script.onload = () => {
                setScriptLoaded(prev => ({ ...prev, gigapub: typeof window.showGiga === 'function' }));
                setScriptsInitialized(prev => ({ ...prev, gigapub: true }));
                showMessage('info', 'Gigapub ads are ready!');
              };
              script.onerror = () => {
                console.error('Failed to load Gigapub script');
                setScriptsInitialized(prev => ({ ...prev, gigapub: true }));
                showMessage('error', 'Failed to load Gigapub ads');
              };
              document.head.appendChild(script);
            } else {
              setScriptLoaded(prev => ({ ...prev, gigapub: true }));
              setScriptsInitialized(prev => ({ ...prev, gigapub: true }));
            }
            break;

          case 'onclicka':
            if (!document.getElementById('onclicka-script')) {
              const script = document.createElement('script');
              script.id = 'onclicka-script';
              script.src = 'https://js.onclckvd.com/in-stream-ad-admanager/tma.js';
              script.async = true;
              script.onload = () => {
                if (window.initCdTma) {
                  window.initCdTma({ id: ad.appId })
                    .then((show: (() => Promise<void>) | undefined) => {
                      window.showAd = show;
                      setScriptLoaded(prev => ({ ...prev, onclicka: true }));
                      setScriptsInitialized(prev => ({ ...prev, onclicka: true }));
                      showMessage('info', 'Onclicka ads are ready!');
                    })
                    .catch((error: any) => {
                      console.error('Failed to initialize Onclicka:', error);
                      setScriptsInitialized(prev => ({ ...prev, onclicka: true }));
                      showMessage('error', 'Failed to load Onclicka ads');
                    });
                } else {
                  setScriptsInitialized(prev => ({ ...prev, onclicka: true }));
                }
              };
              script.onerror = () => {
                console.error('Failed to load Onclicka script');
                setScriptsInitialized(prev => ({ ...prev, onclicka: true }));
                showMessage('error', 'Failed to load Onclicka ads');
              };
              document.head.appendChild(script);
            } else {
              setScriptLoaded(prev => ({ ...prev, onclicka: true }));
              setScriptsInitialized(prev => ({ ...prev, onclicka: true }));
            }
            break;

          case 'auruads':
            if (!document.getElementById('auruads-script')) {
              const script = document.createElement('script');
              script.id = 'auruads-script';
              script.src = `https://auruads.com/cdn/ads.js?app_uid=${ad.appId}`;
              script.async = true;
              script.onload = () => {
                setScriptLoaded(prev => ({ ...prev, auruads: typeof window.showAuruads === 'function' }));
                setScriptsInitialized(prev => ({ ...prev, auruads: true }));
                showMessage('info', 'Auruads are ready!');
              };
              script.onerror = () => {
                console.error('Failed to load Auruads script');
                setScriptsInitialized(prev => ({ ...prev, auruads: true }));
                showMessage('error', 'Failed to load Auruads');
              };
              document.head.appendChild(script);
            } else {
              setScriptLoaded(prev => ({ ...prev, auruads: true }));
              setScriptsInitialized(prev => ({ ...prev, auruads: true }));
            }
            break;

          case 'libtl':
            if (!document.getElementById('libtl-script')) {
              const script = document.createElement('script');
              script.id = 'libtl-script';
              script.src = '//libtl.com/sdk.js';
              script.setAttribute('data-zone', ad.appId);
              script.setAttribute('data-sdk', `show_${ad.appId}`);
              script.async = true;
              script.onload = () => {
                setScriptLoaded(prev => ({ ...prev, libtl: typeof window[`show_${ad.appId}` as keyof Window] === 'function' }));
                setScriptsInitialized(prev => ({ ...prev, libtl: true }));
                showMessage('info', 'Libtl ads are ready!');
              };
              script.onerror = () => {
                console.error('Failed to load Libtl script');
                setScriptsInitialized(prev => ({ ...prev, libtl: true }));
                showMessage('error', 'Failed to load Libtl ads');
              };
              document.head.appendChild(script);
            } else {
              setScriptLoaded(prev => ({ ...prev, libtl: true }));
              setScriptsInitialized(prev => ({ ...prev, libtl: true }));
            }
            break;

          case 'adextra':
            if (!document.getElementById('adextra-script')) {
              const script = document.createElement('script');
              script.id = 'adextra-script';
              script.src = `https://partner.adextra.io/jt/${ad.appId}.js`;
              script.async = true;
              script.onload = () => {
                setScriptLoaded(prev => ({ ...prev, adextra: typeof window.p_adextra === 'function' }));
                setScriptsInitialized(prev => ({ ...prev, adextra: true }));
                showMessage('info', 'AdExtra premium ads are ready!');
              };
              script.onerror = () => {
                console.error('Failed to load AdExtra script');
                setScriptsInitialized(prev => ({ ...prev, adextra: true }));
                showMessage('error', 'Failed to load AdExtra ads');
              };
              document.head.appendChild(script);
            } else {
              setScriptLoaded(prev => ({ ...prev, adextra: true }));
              setScriptsInitialized(prev => ({ ...prev, adextra: true }));
            }
            break;
        }
      });
    };

    if (ads.length > 0) {
      initializeScripts();
    }
  }, [ads, scriptsInitialized]);

  // Clean up scripts when component unmounts
  React.useEffect(() => {
    return () => {
      ['adexora-script', 'gigapub-script', 'onclicka-script', 'auruads-script', 'libtl-script', 'adextra-script'].forEach(id => {
        const script = document.getElementById(id);
        if (script) {
          script.remove();
        }
      });
    };
  }, []);

  // Cooldown timer with better formatting
  React.useEffect(() => {
    const interval = setInterval(() => {
      const newCooldowns: Record<string, number> = {};
      Object.keys(lastWatched).forEach(provider => {
        const ad = ads.find(a => a.provider === provider);
        if (ad && lastWatched[provider]) {
          const timeSinceLast = (Date.now() - lastWatched[provider].getTime()) / 1000;
          if (timeSinceLast < ad.cooldown) {
            newCooldowns[provider] = Math.ceil(ad.cooldown - timeSinceLast);
          }
        }
      });
      setCooldowns(newCooldowns);
    }, 1000);

    return () => clearInterval(interval);
  }, [lastWatched, ads]);

  // Update user watch in Firebase
  const updateUserAdWatch = async (adId: number) => {
    if (!userData?.telegramId) return;

    const ad = ads.find(a => a.id === adId);
    if (!ad) return;

    const userAdRef = ref(database, `userAds/${userData.telegramId}/${ad.provider}`);
    const now = new Date().toISOString();

    await update(userAdRef, {
      watchedToday: (ad.watched || 0) + 1,
      lastWatched: now,
      lastUpdated: now
    });
  };

  const handleAdCompletion = async (adId: number, reward: number) => {
    await updateUserAdWatch(adId);
    await onAdComplete(adId, reward);
    showMessage('success', `+$${reward.toFixed(2)} earned! Balance updated.`);
  };

  // Format time for user display
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // AdExtra specific handlers
  const createAdExtraHandlers = (adId: number, ad: Ad) => {
    const onSuccess = () => {
      console.log('AdExtra: Ad completed successfully');
      handleAdCompletion(adId, ad.reward);
      setAds(prev => prev.map(a => 
        a.id === adId ? { ...a, watched: a.watched + 1 } : a
      ));
      setLastWatched(prev => ({ ...prev, [ad.provider]: new Date() }));
      setConcurrentLock(false);
      setIsWatchingAd(null);
    };

    const onError = () => {
      console.log('AdExtra: Ad failed to load or was skipped');
      showMessage('error', 'Ad failed to load. Please try again.');
      setConcurrentLock(false);
      setIsWatchingAd(null);
    };

    return { onSuccess, onError };
  };

  // Show ad with comprehensive checks and concurrency handling
  const showAd = async (adId: number) => {
    // Concurrency lock to prevent multiple simultaneous ad watches
    if (concurrentLock) {
      showMessage('info', 'Please complete the current ad first');
      return;
    }

    const ad = ads.find(a => a.id === adId);
    if (!ad) {
      showMessage('error', 'Ad not found');
      return;
    }

    if (!ad.enabled) {
      showMessage('error', 'This ad provider is temporarily unavailable');
      return;
    }

    if (!scriptLoaded[ad.provider]) {
      showMessage('info', 'Ad provider is loading... Please wait a moment');
      return;
    }

    const now = new Date();

    // Daily limit check
    if (ad.dailyLimit > 0 && ad.watched >= ad.dailyLimit) {
      showMessage('info', 'Daily limit reached. Come back tomorrow for more ads!');
      return;
    }

    // Cooldown check
    if (lastWatched[ad.provider]) {
      const timeSinceLast = (now.getTime() - lastWatched[ad.provider].getTime()) / 1000;
      if (timeSinceLast < ad.cooldown) {
        const waitLeft = Math.ceil(ad.cooldown - timeSinceLast);
        showMessage('info', `Please wait ${formatTime(waitLeft)} before watching another ad`);
        return;
      }
    }

    // Set concurrent lock
    setConcurrentLock(true);
    setIsWatchingAd(adId);

    try {
      const minWaitTime = ad.waitTime;
      const start = Date.now();

      let adCompleted = false;
      
      // Show preparation message
      showMessage('info', 'Preparing ad... Please wait');

      // Execute ad provider function
      if (ad.provider === 'adexora' && window.showAdexora) {
        await window.showAdexora();
        adCompleted = true;
      } else if (ad.provider === 'gigapub' && window.showGiga) {
        await window.showGiga();
        adCompleted = true;
      } else if (ad.provider === 'onclicka' && window.showAd) {
        await window.showAd();
        adCompleted = true;
      } else if (ad.provider === 'auruads' && window.showAuruads) {
        await window.showAuruads();
        adCompleted = true;
      } else if (ad.provider === 'libtl') {
        const showFunction = window[`show_${ad.appId}` as keyof Window] as (() => Promise<void>) | undefined;
        if (showFunction) {
          await showFunction();
          adCompleted = true;
        } else {
          throw new Error('Libtl ad function not available');
        }
      } else if (ad.provider === 'adextra' && window.p_adextra) {
        // AdExtra uses callback-based approach instead of Promise
        const { onSuccess, onError } = createAdExtraHandlers(adId, ad);
        window.p_adextra(onSuccess, onError);
        // For AdExtra, we don't set adCompleted here since it uses callbacks
        return; // Return early since AdExtra handles completion via callbacks
      } else {
        throw new Error('Ad provider function not available');
      }

      if (adCompleted) {
        const elapsed = (Date.now() - start) / 1000;
        
        // Verify user watched for minimum required time
        if (elapsed >= minWaitTime) {
          await handleAdCompletion(adId, ad.reward);
          setAds(prev => prev.map(a => 
            a.id === adId ? { ...a, watched: a.watched + 1 } : a
          ));
          setLastWatched(prev => ({ ...prev, [ad.provider]: now }));
        } else {
          throw new Error(`Please watch the ad completely (minimum ${minWaitTime} seconds)`);
        }
      }
    } catch (error) {
      console.error('Ad skipped or failed:', error);
      showMessage('error', 'Ad was not completed. Please watch the full ad without skipping.');
    } finally {
      // Always release the lock (except for AdExtra which uses callbacks)
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
    if (!scriptLoaded[ad.provider]) return true;
    if (concurrentLock && isWatchingAd !== ad.id) return true;
    return false;
  };

  const getButtonText = (ad: Ad) => {
    if (!ad.enabled) return "Temporarily Disabled";
    if (ad.dailyLimit > 0 && ad.watched >= ad.dailyLimit) return `Daily Limit Reached`;
    if (cooldowns[ad.provider]) return `Wait ${formatTime(cooldowns[ad.provider])}`;
    if (!scriptLoaded[ad.provider]) return "Loading...";
    if (concurrentLock && isWatchingAd !== ad.id) return "Another Ad in Progress";
    if (isWatchingAd === ad.id) return "Watching Ad...";
    return "Watch Now";
  };

  // Don't render until ads are loaded
  if (ads.length === 0) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-blue-300">Loading ads configuration...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Reset Timer Display */}
      <div className="col-span-2 bg-[#0a1a2b] rounded-3xl p-3 border border-[#014983]/40 shadow-lg mb-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-blue-300">Daily reset in:</span>
          <span className="text-green-400 font-bold">{timeUntilReset}</span>
          <span className="text-blue-300">Reset: 6 AM (BD Time)</span>
        </div>
      </div>

      {ads.map(ad => (
        <div key={ad.id} className="bg-[#0a1a2b] rounded-3xl p-2 border border-[#014983]/40 shadow-lg">
          {/* Header with Icon and Text */}
          <div className="flex items-center mb-2">
            <div className="bg-gradient-to-tr from-purple-500 via-pink-500 to-indigo-500 p-3 rounded-2xl shadow-md mr-4 flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{ad.title}</h3>
              <p className="text-[12px] text-blue-300 mt-1">{ad.description}</p>
              {!scriptLoaded[ad.provider] && <p className="text-[10px] text-yellow-500 mt-1">Loading ad service...</p>}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#014983]/20 rounded-full h-4 mb-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((ad.watched / ad.dailyLimit) * 100, 100)}%` }}
            ></div>
          </div>

          {/* Progress Text */}
          <div className="flex justify-between text-sm text-blue-300 font-medium mb-5">
            <span>{ad.watched} / {ad.dailyLimit} watched</span>
            <span className="text-green-400">wait: {ad.waitTime}s</span>
          </div>

          {/* Watch Button */}
          <div className="flex justify-center">
            <button
              className="w-11/12 bg-gradient-to-r from-purple-500 via-blue-500 to-blue-500 hover:from-blue-600 hover:via-blue-600 hover:to-blue-600 text-white py-2 rounded-3xl text-sm font-bold shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => showAd(ad.id)}
              disabled={isAdDisabled(ad) || isWatchingAd === ad.id}
            >
              {isWatchingAd === ad.id
                ? "Watching Ad..."
                : getButtonText(ad)}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdsDashboard;
