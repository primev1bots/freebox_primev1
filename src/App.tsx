import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { FaCoins, FaTasks, FaAd, FaUserFriends, FaCalendarAlt, FaMoneyBillWave, FaHeadset, FaTelegramPlane, FaTrophy, FaImages } from 'react-icons/fa';
import YouTube from 'react-youtube';
import { motion } from "framer-motion";
import { Youtube, Wallet, ArrowLeft, RefreshCw } from 'lucide-react';
import { ref, set, get, update, push, query, orderByChild, equalTo, onValue, off } from 'firebase/database';
import './App.css';
import Navbar from './components/Navbar';
import ProfileCard from './components/Profile';
import ReferPage from './components/Refer';
import Earn from './components/Earn';
import TransactionComponent from './components/Transaction';
import Topbar from './components/Topbar';
import AdminPanel from './components/AdminPanel';
import LeaderBoard from './components/LeaderBoard';
import SplashScreen from './components/Splashscreen';
import { database } from './firebase';

declare global {
  interface Window {
    showGiga?: () => Promise<void>;
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            username: string;
            first_name: string;
            last_name: string;
            photo_url?: string;
          };
        };
        ready: () => void;
        expand: () => void;
      };
    };
  }
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
  deviceId?: string;
  isMainAccount?: boolean;
}

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

interface Task {
  id: string;
  name: string;
  description: string;
  reward: number;
  category: string;
  totalRequired: number;
  completed?: number;
  progress?: number;
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

interface AppConfig {
  logoUrl: string;
  appName: string;
  sliderImages: SliderImage[];
  supportUrl: string;
  tutorialVideoId: string;
  referralCommissionRate?: number;
}

interface SliderImage {
  id: string;
  url: string;
  alt: string;
  order: number;
  createdAt: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  logo: string;
  status: 'active' | 'inactive';
  minWithdrawal: number;
  createdAt: string;
  updatedAt: string;
}

interface WalletConfig {
  currency: string;
  currencySymbol: string;
  currencyDecimals: number;
  defaultMinWithdrawal: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

interface DeviceAccountInfo {
  deviceId: string;
  accounts: Array<{
    telegramId: number;
    username: string;
    firstName: string;
    lastName: string;
    joinDate: string;
    isMainAccount: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface DeviceRestrictions {
  maxAccountsPerDevice: number;
  enabled: boolean;
  lastUpdated: string;
  updatedBy: string;
}

// Device ID generation utility
const generateDeviceId = (): string => {
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.hardwareConcurrency?.toString(),
    screen.width?.toString(),
    screen.height?.toString(),
    navigator.platform
  ].filter(Boolean).join('|');

  let hash = 0;
  for (let i = 0; i < components.length; i++) {
    const char = components.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return `device_${Math.abs(hash).toString(36)}`;
};

// Firebase Utility Functions
const firebaseRequest = {
  getDeviceId: (): string => {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = generateDeviceId();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  },

  getDeviceAccounts: async (deviceId: string): Promise<DeviceAccountInfo | null> => {
    try {
      const deviceRef = ref(database, `devices/${deviceId}`);
      const snapshot = await get(deviceRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Error getting device accounts:', error);
      return null;
    }
  },

  updateDeviceAccounts: async (deviceId: string, userData: UserData, isMainAccount: boolean = false): Promise<boolean> => {
    try {
      const deviceRef = ref(database, `devices/${deviceId}`);
      const snapshot = await get(deviceRef);

      let deviceData: DeviceAccountInfo;
      const now = new Date().toISOString();

      if (snapshot.exists()) {
        deviceData = snapshot.val();

        const existingUserIndex = deviceData.accounts.findIndex(acc => acc.telegramId === userData.telegramId);

        if (existingUserIndex === -1) {
          deviceData.accounts.push({
            telegramId: userData.telegramId,
            username: userData.username,
            firstName: userData.firstName,
            lastName: userData.lastName,
            joinDate: userData.joinDate,
            isMainAccount: isMainAccount
          });
        } else {
          deviceData.accounts[existingUserIndex] = {
            ...deviceData.accounts[existingUserIndex],
            username: userData.username,
            firstName: userData.firstName,
            lastName: userData.lastName,
            isMainAccount: isMainAccount
          };
        }

        deviceData.updatedAt = now;
      } else {
        deviceData = {
          deviceId: deviceId,
          accounts: [{
            telegramId: userData.telegramId,
            username: userData.username,
            firstName: userData.firstName,
            lastName: userData.lastName,
            joinDate: userData.joinDate,
            isMainAccount: isMainAccount
          }],
          createdAt: now,
          updatedAt: now
        };
      }

      await set(deviceRef, deviceData);
      return true;
    } catch (error) {
      console.error('Error updating device accounts:', error);
      return false;
    }
  },

  removeAccountFromDevice: async (deviceId: string, telegramId: number): Promise<boolean> => {
    try {
      const deviceRef = ref(database, `devices/${deviceId}`);
      const snapshot = await get(deviceRef);

      if (snapshot.exists()) {
        const deviceData = snapshot.val();
        deviceData.accounts = deviceData.accounts.filter((acc: any) => acc.telegramId !== telegramId);
        deviceData.updatedAt = new Date().toISOString();

        await set(deviceRef, deviceData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing account from device:', error);
      return false;
    }
  },

  getDeviceRestrictions: async (): Promise<DeviceRestrictions> => {
    try {
      const restrictionsRef = ref(database, 'deviceRestrictions');
      const snapshot = await get(restrictionsRef);

      if (snapshot.exists()) {
        return snapshot.val();
      } else {
        // Create default device restrictions with fixed 2 accounts per device
        const defaultRestrictions: DeviceRestrictions = {
          maxAccountsPerDevice: 2, // Fixed to 2 accounts per device
          enabled: true,
          lastUpdated: new Date().toISOString(),
          updatedBy: 'system'
        };
        await set(restrictionsRef, defaultRestrictions);
        return defaultRestrictions;
      }
    } catch (error) {
      console.error('Error getting device restrictions:', error);
      // Return fixed default of 2 if there's an error
      return {
        maxAccountsPerDevice: 2,
        enabled: true,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'system'
      };
    }
  },

  getMaxAccountsPerDevice: async (): Promise<number> => {
    try {
      const restrictions = await firebaseRequest.getDeviceRestrictions();
      return restrictions.maxAccountsPerDevice;
    } catch (error) {
      console.error('Error getting max accounts per device:', error);
      return 2; // Fixed fallback to 2
    }
  },

  getUser: async (telegramId: number): Promise<UserData | null> => {
    try {
      const userRef = ref(database, `users/${telegramId}`);
      const snapshot = await get(userRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  createUser: async (userData: UserData): Promise<boolean> => {
    try {
      await set(ref(database, `users/${userData.telegramId}`), userData);
      return true;
    } catch (error) {
      console.error('Error creating user:', error);
      return false;
    }
  },

  updateUser: async (telegramId: number, updates: Partial<UserData>): Promise<boolean> => {
    try {
      await update(ref(database, `users/${telegramId}`), updates);
      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      return false;
    }
  },

  addTransaction: async (transaction: Omit<Transaction, 'id'>): Promise<string> => {
    try {
      const transactionsRef = ref(database, 'transactions');
      const newTransactionRef = push(transactionsRef);
      const transactionId = newTransactionRef.key!;

      await set(newTransactionRef, {
        ...transaction,
        id: transactionId
      });

      return transactionId;
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  },

  getUserTransactions: async (userId: string): Promise<Transaction[]> => {
    try {
      const transactionsRef = ref(database, 'transactions');
      const userTransactionsQuery = query(
        transactionsRef,
        orderByChild('userId'),
        equalTo(userId)
      );

      const snapshot = await get(userTransactionsQuery);
      if (!snapshot.exists()) return [];

      const transactions: Transaction[] = [];
      snapshot.forEach((childSnapshot) => {
        transactions.push(childSnapshot.val());
      });

      return transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error getting transactions:', error);
      return [];
    }
  },

  getTasks: async (): Promise<Task[]> => {
    try {
      const tasksRef = ref(database, 'tasks');
      const snapshot = await get(tasksRef);
      if (!snapshot.exists()) return [];

      const tasks: Task[] = [];
      snapshot.forEach((childSnapshot) => {
        const taskData = childSnapshot.val();
        tasks.push({
          id: childSnapshot.key!,
          name: taskData.name,
          description: taskData.description,
          reward: taskData.reward,
          category: taskData.category,
          totalRequired: taskData.totalRequired,
          completed: taskData.completed || 0,
          progress: taskData.progress || 0
        });
      });

      return tasks;
    } catch (error) {
      console.error('Error getting tasks:', error);
      return [];
    }
  },

  initializeDefaultTasks: async (): Promise<void> => {
    try {
      const tasksRef = ref(database, 'tasks');
      const snapshot = await get(tasksRef);

      if (!snapshot.exists() || Object.keys(snapshot.val() || {}).length === 0) {
        console.log('No default tasks to initialize.');
      }
    } catch (error) {
      console.error('Error initializing tasks:', error);
    }
  },

  updateTaskProgress: async (telegramId: number, taskId: string, progress: number): Promise<boolean> => {
    try {
      const userTasksRef = ref(database, `users/${telegramId}/tasksCompleted/${taskId}`);
      await set(userTasksRef, progress);
      return true;
    } catch (error) {
      console.error('Error updating task progress:', error);
      return false;
    }
  },

  getReferralData: async (telegramId: number): Promise<ReferralData> => {
    try {
      const referralRef = ref(database, `referrals/${telegramId}`);
      const snapshot = await get(referralRef);

      if (snapshot.exists()) {
        return snapshot.val();
      } else {
        const defaultData: ReferralData = {
          referralCode: telegramId.toString(),
          referredCount: 0,
          referralEarnings: 0,
          referredUsers: {}
        };
        await set(referralRef, defaultData);
        return defaultData;
      }
    } catch (error) {
      console.error('Error getting referral data:', error);
      return {
        referralCode: telegramId.toString(),
        referredCount: 0,
        referralEarnings: 0,
        referredUsers: {}
      };
    }
  },

  updateReferralData: async (telegramId: number, updates: Partial<ReferralData>): Promise<boolean> => {
    try {
      await update(ref(database, `referrals/${telegramId}`), updates);
      return true;
    } catch (error) {
      console.error('Error updating referral data:', error);
      return false;
    }
  },

  addReferredUser: async (referrerId: number, referredUserId: number, _referredUserData: UserData): Promise<boolean> => {
    try {
      const referralRef = ref(database, `referrals/${referrerId}`);
      const snapshot = await get(referralRef);

      let referralData: ReferralData;
      if (snapshot.exists()) {
        referralData = snapshot.val();
      } else {
        referralData = {
          referralCode: referrerId.toString(),
          referredCount: 0,
          referralEarnings: 0,
          referredUsers: {}
        };
      }

      if (!referralData.referredUsers[referredUserId]) {
        referralData.referredUsers[referredUserId] = {
          joinedAt: new Date().toISOString(),
          totalEarned: 0,
          commissionEarned: 0
        };
        referralData.referredCount = Object.keys(referralData.referredUsers).length;

        await set(referralRef, referralData);

        await update(ref(database, `users/${referredUserId}`), {
          referredBy: referrerId.toString()
        });

        console.log(`User ${referredUserId} added as referral of ${referrerId}`);
      }

      return true;
    } catch (error) {
      console.error('Error adding referred user:', error);
      return false;
    }
  },

  getCommissionRate: async (): Promise<number> => {
    try {
      const configRef = ref(database, 'appConfig');
      const snapshot = await get(configRef);
      if (snapshot.exists()) {
        const config = snapshot.val();
        return config.referralCommissionRate || 20;
      }
      return 10;
    } catch (error) {
      console.error('Error getting commission rate:', error);
      return 10;
    }
  },

  addReferralCommission: async (referredUserId: number, earnedAmount: number): Promise<boolean> => {
    try {
      console.log(`Processing referral commission for user ${referredUserId}, amount: ${earnedAmount}`);

      const commissionRate = await firebaseRequest.getCommissionRate();
      console.log(`Using commission rate: ${commissionRate}%`);

      const referredUserRef = ref(database, `users/${referredUserId}`);
      const referredUserSnapshot = await get(referredUserRef);

      if (!referredUserSnapshot.exists()) {
        console.log('Referred user not found');
        return false;
      }

      const referredUser = referredUserSnapshot.val() as UserData;
      const referrerId = referredUser.referredBy;

      if (!referrerId) {
        console.log('No referrer found for this user');
        return false;
      }

      console.log(`Referrer found: ${referrerId}`);

      const commission = earnedAmount * (commissionRate / 100);
      console.log(`Commission amount: ${commission} (${commissionRate}% of ${earnedAmount})`);

      const referrerRef = ref(database, `users/${referrerId}`);
      const referrerSnapshot = await get(referrerRef);

      if (referrerSnapshot.exists()) {
        const referrer = referrerSnapshot.val() as UserData;
        const newBalance = (referrer.balance || 0) + commission;
        const newTotalEarned = (referrer.totalEarned || 0) + commission;

        await update(referrerRef, {
          balance: newBalance,
          totalEarned: newTotalEarned
        });

        console.log(`Updated referrer ${referrerId} balance: ${newBalance}`);

        const referralRef = ref(database, `referrals/${referrerId}`);
        const referralSnapshot = await get(referralRef);

        if (referralSnapshot.exists()) {
          const referralData = referralSnapshot.val() as ReferralData;

          if (referralData.referredUsers && referralData.referredUsers[referredUserId]) {
            referralData.referredUsers[referredUserId].totalEarned += earnedAmount;
            referralData.referredUsers[referredUserId].commissionEarned += commission;
          } else {
            if (!referralData.referredUsers) {
              referralData.referredUsers = {};
            }
            referralData.referredUsers[referredUserId] = {
              joinedAt: new Date().toISOString(),
              totalEarned: earnedAmount,
              commissionEarned: commission
            };
          }

          referralData.referralEarnings = (referralData.referralEarnings || 0) + commission;
          referralData.referredCount = Object.keys(referralData.referredUsers).length;

          await set(referralRef, referralData);
          console.log(`Updated referral data for referrer ${referrerId}`);
        }

        await firebaseRequest.addTransaction({
          userId: referrerId.toString(),
          type: 'referral_commission',
          amount: commission,
          description: `${commissionRate}% commission from referral ${referredUser.firstName || referredUser.username}`,
          status: 'completed',
          createdAt: new Date().toISOString()
        });

        console.log(`Commission of $${commission.toFixed(2)} added to referrer ${referrerId}`);
        return true;
      } else {
        console.log('Referrer user not found in database');
        return false;
      }
    } catch (error) {
      console.error('Error adding referral commission:', error);
      return false;
    }
  },

  getAppConfig: async (): Promise<AppConfig> => {
    try {
      const configRef = ref(database, 'appConfig');
      const snapshot = await get(configRef);

      if (snapshot.exists()) {
        return snapshot.val();
      } else {
        const defaultConfig: AppConfig = {
          logoUrl: "",
          appName: "PRIME V1",
          sliderImages: [
            {
              id: '1',
              url: "https://res.cloudinary.com/dqr6abuqg/image/upload/v1758400508/slide1_x9p8bh.jpg",
              alt: "Reward",
              order: 1,
              createdAt: new Date().toISOString()
            },
            {
              id: '2',
              url: "https://res.cloudinary.com/dqr6abuqg/image/upload/v1758400519/slide2_cu4l80.jpg",
              alt: "Referral",
              order: 2,
              createdAt: new Date().toISOString()
            },
            {
              id: '3',
              url: "https://res.cloudinary.com/dqr6abuqg/image/upload/v1758400527/slide3_lds1l1.jpg",
              alt: "Withdraw",
              order: 3,
              createdAt: new Date().toISOString()
            }
          ],
          supportUrl: "https://t.me/YourChannelName",
          tutorialVideoId: "dQw4w9WgXcQ",
          referralCommissionRate: 10
        };
        await set(configRef, defaultConfig);
        return defaultConfig;
      }
    } catch (error) {
      console.error('Error getting app config:', error);
      return {
        logoUrl: "",
        appName: "PRIME V1",
        sliderImages: [
          {
            id: '1',
            url: "https://res.cloudinary.com/dqr6abuqg/image/upload/v1758400508/slide1_x9p8bh.jpg",
            alt: "Reward",
            order: 1,
            createdAt: new Date().toISOString()
          },
          {
            id: '2',
            url: "https://res.cloudinary.com/dqr6abuqg/image/upload/v1758400519/slide2_cu4l80.jpg",
            alt: "Referral",
            order: 2,
            createdAt: new Date().toISOString()
          },
          {
            id: '3',
            url: "https://res.cloudinary.com/dqr6abuqg/image/upload/v1758400527/slide3_lds1l1.jpg",
            alt: "Withdraw",
            order: 3,
            createdAt: new Date().toISOString()
          }
        ],
        supportUrl: "https://t.me/YourChannelName",
        tutorialVideoId: "dQw4w9WgXcQ",
        referralCommissionRate: 10
      };
    }
  },

  updateSliderImages: async (sliderImages: SliderImage[]): Promise<boolean> => {
    try {
      const configRef = ref(database, 'appConfig/sliderImages');
      await set(configRef, sliderImages);
      return true;
    } catch (error) {
      console.error('Error updating slider images:', error);
      return false;
    }
  },

  updateAppConfig: async (updates: Partial<AppConfig>): Promise<boolean> => {
    try {
      const configRef = ref(database, 'appConfig');
      const snapshot = await get(configRef);
      const currentConfig = snapshot.exists() ? snapshot.val() : {};

      await set(configRef, { ...currentConfig, ...updates });
      return true;
    } catch (error) {
      console.error('Error updating app config:', error);
      return false;
    }
  },

  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    try {
      const methodsRef = ref(database, 'paymentMethods');
      const snapshot = await get(methodsRef);

      if (snapshot.exists()) {
        const methodsData = snapshot.val();
        const methodsArray: PaymentMethod[] = Object.keys(methodsData).map(key => ({
          id: key,
          ...methodsData[key]
        }));
        return methodsArray.filter(method => method.status === 'active');
      }
      return [];
    } catch (error) {
      console.error('Error getting payment methods:', error);
      return [];
    }
  },

  getWalletConfig: async (): Promise<WalletConfig> => {
    try {
      const configRef = ref(database, 'walletConfig');
      const snapshot = await get(configRef);

      if (snapshot.exists()) {
        return snapshot.val();
      } else {
        const defaultConfig: WalletConfig = {
          currency: 'USDT',
          currencySymbol: '',
          currencyDecimals: 8,
          defaultMinWithdrawal: 10,
          maintenanceMode: false,
          maintenanceMessage: 'Wallet is under maintenance. Please try again later.'
        };
        await set(configRef, defaultConfig);
        return defaultConfig;
      }
    } catch (error) {
      console.error('Error getting wallet config:', error);
      return {
        currency: 'USDT',
        currencySymbol: '',
        currencyDecimals: 8,
        defaultMinWithdrawal: 10,
        maintenanceMode: false,
        maintenanceMessage: 'Wallet is under maintenance. Please try again later.'
      };
    }
  }
};

// Enhanced Source Protection Component
const EnhancedSourceProtection: React.FC = () => {
  useEffect(() => {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const consoleWarning = () => {
      console.clear();
      console.log('%c🚫 ACCESS DENIED 🚫', 'color: red; font-size: 40px; font-weight: bold;');
      console.log('%c⚠️ UNAUTHORIZED ACCESS TO SOURCE CODE IS PROHIBITED', 'color: red; font-size: 16px; font-weight: bold;');
    };

    const showSecurityAlert = (_action: string) => {
      const existingModal = document.getElementById('security-alert-modal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'security-alert-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        backdrop-filter: blur(10px);
        animation: fadeIn 0.3s ease-out;
      `;
      modal.innerHTML = `
        <div class="modal-container" style="
          max-width: 90%;
          max-height: 90%;
          display: flex;
          flex-direction: column;
          align-items: center;
          backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 30px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
          position: relative;
        ">
          <div class="video-container" style="
            width: 100%;
            display: flex;
            justify-content: center;
            margin-bottom: 25px;
          ">
            <video 
              src="https://res.cloudinary.com/deu1ngeov/video/upload/v1759513441/my_efphp0.mp4" 
              autoplay
              loop
              playsinline
              style="
                width: 100%;
                max-width: 800px;
                height: auto;
                border-radius: 15px;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
                background: #000;
              "
            ></video>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (!isMobile) {
        e.preventDefault();
        showSecurityAlert('Right-click Context Menu');
        return false;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isMobile) {
        if (e.keyCode === 123 || // F12
          (e.ctrlKey && e.shiftKey && [73, 67, 74].includes(e.keyCode)) || // Ctrl+Shift+I/C/J
          (e.ctrlKey && [85, 83, 80].includes(e.keyCode)) // Ctrl+U/S/P
        ) {
          e.preventDefault();
          showSecurityAlert('Blocked Shortcut Detected');
          return false;
        }
      }
    };

    const handleSelectStart = (e: Event) => {
      if (!isMobile) {
        e.preventDefault();
        return false;
      }
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    const detectDevTools = () => {
      let devtools = false;
      const threshold = 160;
      const checkDevTools = () => {
        if (window.outerHeight - window.innerHeight > threshold ||
          window.outerWidth - window.innerWidth > threshold
        ) {
          if (!devtools) {
            devtools = true;
            consoleWarning();
            showSecurityAlert('Developer Tools Detected');
          }
        } else devtools = false;
      };
      setInterval(checkDevTools, 500);
    };

    const detectDebugger = () => {
      const start = performance.now();
      debugger;
      const end = performance.now();
      if (end - start > 100) {
        consoleWarning();
        showSecurityAlert('Debugger Detected');
      }
    };

    const blurContent = () => {
      const interval = setInterval(() => {
        if (window.outerHeight - window.innerHeight > 160 ||
          window.outerWidth - window.innerWidth > 160
        ) {
          document.body.style.filter = 'blur(5px)';
          document.body.style.pointerEvents = 'none';
        } else {
          document.body.style.filter = 'none';
          document.body.style.pointerEvents = 'auto';
        }
      }, 100);
      return () => clearInterval(interval);
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);

    consoleWarning();
    detectDevTools();
    const clearBlur = blurContent();
    const debuggerInterval = setInterval(detectDebugger, 1000);

    document.querySelectorAll('img').forEach(img => {
      img.draggable = false;
      img.ondragstart = () => false;
    });

    const style = document.createElement('style');
    style.textContent = `
      * {
        ${isMobile ? 'user-select: text !important;' : `
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        `}
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }

      img {
        pointer-events: none !important;
        -webkit-user-drag: none !important;
        -moz-user-drag: none !important;
        user-drag: none !important;
      }

      #security-alert-modal {
        animation: fadeIn 0.3s ease-in;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      clearInterval(debuggerInterval);
      clearBlur();
      document.head.removeChild(style);
      const existingModal = document.getElementById('security-alert-modal');
      if (existingModal) existingModal.remove();
    };
  }, []);

  return null;
};


// Main App Component
const App: React.FC = () => {
  return (
    <Router>
      <div className="bg-[#050505] flex justify-center">
        <div className="w-full bg-[#050505] text-white h-screen font-bold flex flex-col max-w-xl overflow-hidden">
          <EnhancedSourceProtection />
          <Routes>
            <Route path="/admin" element={<AdminRoute />} />
            <Route path="/*" element={<MainApp />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

// Separate component for admin route - NO SPLASH SCREEN
const AdminRoute: React.FC = () => {
  const [walletConfig, setWalletConfig] = useState<WalletConfig>({
    currency: 'USDT',
    currencySymbol: '',
    currencyDecimals: 8,
    defaultMinWithdrawal: 10,
    maintenanceMode: false,
    maintenanceMessage: 'Wallet is under maintenance. Please try again later.'
  });

  // Load wallet config for admin panel
  useEffect(() => {
    const loadWalletConfig = async () => {
      try {
        const config = await firebaseRequest.getWalletConfig();
        setWalletConfig(config);
      } catch (error) {
        console.error('Error loading wallet config for admin:', error);
      }
    };

    loadWalletConfig();
  }, []);

  return (
    <AdminPanel
      transactions={[]}
      onUpdateTransaction={function (transactionId: string, updates: Partial<Transaction>): void {
        console.log('Updating transaction:', transactionId, updates);
      }}
      walletConfig={walletConfig}
    />
  );
};

// Separate component for main app with splash screen logic ONLY for multi-accounts
const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [showWallet, setShowWallet] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showDailyTasks] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [telegramUser, setTelegramUser] = useState<any>(null);
  const [appConfig, setAppConfig] = useState<AppConfig>({
    logoUrl: "",
    appName: "PRIME V1",
    sliderImages: [],
    supportUrl: "https://t.me/YourChannelName",
    tutorialVideoId: "dQw4w9WgXcQ",
    referralCommissionRate: 10
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [walletConfig, setWalletConfig] = useState<WalletConfig>({
    currency: 'USDT',
    currencySymbol: '',
    currencyDecimals: 8,
    defaultMinWithdrawal: 10,
    maintenanceMode: false,
    maintenanceMessage: 'Wallet is under maintenance. Please try again later.'
  });
  const [isMobileAllowed, setIsMobileAllowed] = useState<boolean | null>(null);
  const [showSplashScreen, setShowSplashScreen] = useState<boolean>(false);
  const [splashScreenData, setSplashScreenData] = useState<{
    show: boolean;
    message: string;
    mainAccount?: {
      username: string;
      userId: number;
    };
  }>({
    show: false,
    message: ''
  });
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [maxAccountsPerDevice, setMaxAccountsPerDevice] = useState<number>(2); // Fixed to 2 accounts per device

  const location = useLocation();
  const slideInterval = useRef<NodeJS.Timeout | null>(null);

  // Refs to track Firebase listeners
  const userListenerRef = useRef<any>(null);
  const transactionsListenerRef = useRef<any>(null);
  const tasksListenerRef = useRef<any>(null);
  const referralListenerRef = useRef<any>(null);
  const configListenerRef = useRef<any>(null);
  const paymentMethodsListenerRef = useRef<any>(null);
  const walletConfigListenerRef = useRef<any>(null);
  const deviceRestrictionsListenerRef = useRef<any>(null);

  // Check device compatibility first
  useEffect(() => {
    const checkDevice = () => {
      const tg = (window as any).Telegram?.WebApp;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (tg && (tg.platform === "android" || tg.platform === "ios") && isMobile) {
        setIsMobileAllowed(true);
      } else {
        setIsMobileAllowed(false);
        setSplashScreenData({
          show: true,
          message: "This app is only available on mobile devices through Telegram."
        });
        setShowSplashScreen(true);
        setIsInitializing(false);
      }
    };

    setTimeout(checkDevice, 100);
  }, []);

  // Setup realtime listeners for all data including device restrictions
  const setupRealtimeListeners = (telegramId: number) => {
    cleanupListeners();

    // Device restrictions listener - fixed to 2 accounts
    const restrictionsRef = ref(database, 'deviceRestrictions');
    deviceRestrictionsListenerRef.current = onValue(restrictionsRef, (snapshot) => {
      if (snapshot.exists()) {
        setMaxAccountsPerDevice(2); // Always set to 2 regardless of database value
        console.log('Device restrictions loaded, max accounts fixed to 2');
      }
    });

    const userRef = ref(database, `users/${telegramId}`);
    userListenerRef.current = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.val();
        setUserData(userData);
        console.log('User data updated:', userData);
      }
    });

    const transactionsRef = ref(database, 'transactions');
    const userTransactionsQuery = query(
      transactionsRef,
      orderByChild('userId'),
      equalTo(telegramId.toString())
    );
    transactionsListenerRef.current = onValue(userTransactionsQuery, (snapshot) => {
      if (snapshot.exists()) {
        const transactionsData: Transaction[] = [];
        snapshot.forEach((childSnapshot) => {
          transactionsData.push(childSnapshot.val());
        });
        const sortedTransactions = transactionsData.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setTransactions(sortedTransactions);
        console.log('Transactions updated:', sortedTransactions.length);
      } else {
        setTransactions([]);
      }
    });

    const tasksRef = ref(database, 'tasks');
    tasksListenerRef.current = onValue(tasksRef, (snapshot) => {
      if (snapshot.exists()) {
        const tasksData: Task[] = [];
        snapshot.forEach((childSnapshot) => {
          const taskData = childSnapshot.val();
          tasksData.push({
            id: childSnapshot.key!,
            name: taskData.name,
            description: taskData.description,
            reward: taskData.reward,
            category: taskData.category,
            totalRequired: taskData.totalRequired,
            completed: taskData.completed || 0,
            progress: taskData.progress || 0
          });
        });
        setTasks(tasksData);
        console.log('Tasks updated:', tasksData.length);
      } else {
        setTasks([]);
      }
    });

    const referralRef = ref(database, `referrals/${telegramId}`);
    referralListenerRef.current = onValue(referralRef, (snapshot) => {
      if (snapshot.exists()) {
        const refData = snapshot.val();
        setReferralData(refData);
        console.log('Referral data updated:', refData);
      } else {
        const defaultData: ReferralData = {
          referralCode: telegramId.toString(),
          referredCount: 0,
          referralEarnings: 0,
          referredUsers: {}
        };
        setReferralData(defaultData);
      }
    });

    const configRef = ref(database, 'appConfig');
    configListenerRef.current = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const configData = snapshot.val();
        setAppConfig(configData);
        console.log('App config updated:', configData);
      } else {
        const defaultConfig: AppConfig = {
          logoUrl: "",
          appName: "PRIME V1",
          sliderImages: [
            {
              id: '1',
              url: "https://res.cloudinary.com/dqr6abuqg/image/upload/v1758400508/slide1_x9p8bh.jpg",
              alt: "Reward",
              order: 1,
              createdAt: new Date().toISOString()
            },
            {
              id: '2',
              url: "https://res.cloudinary.com/dqr6abuqg/image/upload/v1758400519/slide2_cu4l80.jpg",
              alt: "Referral",
              order: 2,
              createdAt: new Date().toISOString()
            },
            {
              id: '3',
              url: "https://res.cloudinary.com/dqr6abuqg/image/upload/v1758400527/slide3_lds1l1.jpg",
              alt: "Withdraw",
              order: 3,
              createdAt: new Date().toISOString()
            }
          ],
          supportUrl: "https://t.me/YourChannelName",
          tutorialVideoId: "dQw4w9WgXcQ",
          referralCommissionRate: 10
        };
        setAppConfig(defaultConfig);
      }
    });

    const paymentMethodsRef = ref(database, 'paymentMethods');
    paymentMethodsListenerRef.current = onValue(paymentMethodsRef, (snapshot) => {
      if (snapshot.exists()) {
        const methodsData = snapshot.val();
        const methodsArray: PaymentMethod[] = Object.keys(methodsData).map(key => ({
          id: key,
          ...methodsData[key]
        }));
        const activeMethods = methodsArray.filter(method => method.status === 'active');
        setPaymentMethods(activeMethods);
        console.log('Payment methods updated:', activeMethods.length);
      } else {
        setPaymentMethods([]);
      }
    });

    const walletConfigRef = ref(database, 'walletConfig');
    walletConfigListenerRef.current = onValue(walletConfigRef, (snapshot) => {
      if (snapshot.exists()) {
        const configData = snapshot.val();
        setWalletConfig(configData);
        console.log('Wallet config updated:', configData);
      } else {
        const defaultConfig: WalletConfig = {
          currency: 'USDT',
          currencySymbol: '',
          currencyDecimals: 8,
          defaultMinWithdrawal: 10,
          maintenanceMode: false,
          maintenanceMessage: 'Wallet is under maintenance. Please try again later.'
        };
        setWalletConfig(defaultConfig);
      }
    });
  };

  // Clean up all listeners
  const cleanupListeners = () => {
    if (userListenerRef.current) {
      off(userListenerRef.current);
      userListenerRef.current = null;
    }
    if (transactionsListenerRef.current) {
      off(transactionsListenerRef.current);
      transactionsListenerRef.current = null;
    }
    if (tasksListenerRef.current) {
      off(tasksListenerRef.current);
      tasksListenerRef.current = null;
    }
    if (referralListenerRef.current) {
      off(referralListenerRef.current);
      referralListenerRef.current = null;
    }
    if (configListenerRef.current) {
      off(configListenerRef.current);
      configListenerRef.current = null;
    }
    if (paymentMethodsListenerRef.current) {
      off(paymentMethodsListenerRef.current);
      paymentMethodsListenerRef.current = null;
    }
    if (walletConfigListenerRef.current) {
      off(walletConfigListenerRef.current);
      walletConfigListenerRef.current = null;
    }
    if (deviceRestrictionsListenerRef.current) {
      off(deviceRestrictionsListenerRef.current);
      deviceRestrictionsListenerRef.current = null;
    }
  };

  // Check device account limits - ONLY shows splash screen for multi-accounts beyond 2
  const checkDeviceAccountLimits = async (tgUser: any): Promise<{
    allowed: boolean;
    message: string;
    mainAccount?: {
      username: string;
      userId: number;
    };
  }> => {
    try {
      const deviceId = firebaseRequest.getDeviceId();
      const deviceAccounts = await firebaseRequest.getDeviceAccounts(deviceId);

      if (!deviceAccounts) {
        return { allowed: true, message: '' };
      }

      // Check if current user already exists in device accounts
      const existingUser = deviceAccounts.accounts.find(acc => acc.telegramId === tgUser.id);

      if (existingUser) {
        return { allowed: true, message: '' };
      }

      // Check if device has reached account limit - Fixed to 2 accounts
      if (deviceAccounts.accounts.length >= 2) { // Hardcoded to 2
        const mainAccount = deviceAccounts.accounts.find(acc => acc.isMainAccount) || deviceAccounts.accounts[0];
        return {
          allowed: false,
          message: `Multi-account detected! You are not allowed to use more than 2 accounts on this device.`,
          mainAccount: {
            username: mainAccount.username,
            userId: mainAccount.telegramId
          }
        };
      }

      return { allowed: true, message: '' };
    } catch (error) {
      console.error('Error checking device account limits:', error);
      return { allowed: true, message: '' };
    }
  };

  useEffect(() => {
    // Skip splash screen logic if we're on admin route
    if (location.pathname === '/admin') {
      setShowSplashScreen(false);
      setIsInitializing(false);
      return;
    }

    // Only proceed if mobile is allowed
    if (isMobileAllowed === true) {
      const initializeAppData = async () => {
        setIsInitializing(true);
        const urlParams = new URLSearchParams(window.location.search);
        const referralCode = urlParams.get('ref');

        // Set max accounts to 2 regardless of database
        setMaxAccountsPerDevice(2);

        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();

          const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
          if (tgUser) {
            setTelegramUser(tgUser);

            // Check device account limits first - ONLY show splash screen for multi-accounts beyond 2
            const limitCheck = await checkDeviceAccountLimits(tgUser);

            if (!limitCheck.allowed) {
              setSplashScreenData({
                show: true,
                message: limitCheck.message,
                mainAccount: limitCheck.mainAccount
              });
              setShowSplashScreen(true);
              setIsInitializing(false);
              return;
            }

            // If allowed, proceed with authentication
            await authenticateUser(tgUser, referralCode);
            setShowSplashScreen(false);
            setIsInitializing(false);
          } else {
            // Mock user for development
            const mockUser = {
              id: 123456,
              username: 'testuser',
              first_name: 'Test',
              last_name: 'User',
              photo_url: 'https://via.placeholder.com/100'
            };
            setTelegramUser(mockUser);

            const limitCheck = await checkDeviceAccountLimits(mockUser);

            if (!limitCheck.allowed) {
              setSplashScreenData({
                show: true,
                message: limitCheck.message,
                mainAccount: limitCheck.mainAccount
              });
              setShowSplashScreen(true);
              setIsInitializing(false);
              return;
            }

            await authenticateUser(mockUser, referralCode);
            setShowSplashScreen(false);
            setIsInitializing(false);
          }
        } else {
          // Mock user for development
          const mockUser = {
            id: 123456,
            username: 'testuser',
            first_name: 'Test',
            last_name: 'User',
            photo_url: 'https://via.placeholder.com/100'
          };
          setTelegramUser(mockUser);

          const limitCheck = await checkDeviceAccountLimits(mockUser);

          if (!limitCheck.allowed) {
            setSplashScreenData({
              show: true,
              message: limitCheck.message,
              mainAccount: limitCheck.mainAccount
            });
            setShowSplashScreen(true);
            setIsInitializing(false);
            return;
          }

          await authenticateUser(mockUser, referralCode);
          setShowSplashScreen(false);
          setIsInitializing(false);
        }
      };

      initializeAppData();
    }

    return () => {
      cleanupListeners();
    };
  }, [isMobileAllowed, location.pathname]);

  const authenticateUser = async (tgUser: any, referralCode: string | null = null) => {
    try {
      await firebaseRequest.initializeDefaultTasks();

      const existingUser = await firebaseRequest.getUser(tgUser.id);
      const deviceId = firebaseRequest.getDeviceId();

      if (existingUser) {
        setUserData(existingUser);
        setupRealtimeListeners(tgUser.id);
        console.log('Existing user authenticated:', tgUser.id);

        const isMainAccount = existingUser.isMainAccount || false;
        await firebaseRequest.updateDeviceAccounts(deviceId, existingUser, isMainAccount);
      } else {
        const newUser: UserData = {
          telegramId: tgUser.id,
          username: tgUser.username || 'unknown',
          firstName: tgUser.first_name || 'User',
          lastName: tgUser.last_name || '',
          profilePhoto: tgUser.photo_url,
          balance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          joinDate: new Date().toISOString(),
          adsWatchedToday: 0,
          tasksCompleted: {},
          referredBy: referralCode || undefined,
          deviceId: deviceId,
          isMainAccount: false
        };

        if (referralCode) {
          const referrerId = parseInt(referralCode);
          if (!isNaN(referrerId)) {
            await firebaseRequest.addReferredUser(referrerId, tgUser.id, newUser);
            console.log(`User ${tgUser.id} added as referral of ${referrerId}`);
          }
        }

        await firebaseRequest.createUser(newUser);
        setUserData(newUser);
        setupRealtimeListeners(tgUser.id);
        console.log('New user created:', tgUser.id);

        const deviceAccounts = await firebaseRequest.getDeviceAccounts(deviceId);
        const isMainAccount = !deviceAccounts || deviceAccounts.accounts.length === 0;

        if (isMainAccount) {
          await firebaseRequest.updateUser(tgUser.id, { isMainAccount: true });
          newUser.isMainAccount = true;
        }

        await firebaseRequest.updateDeviceAccounts(deviceId, newUser, isMainAccount);
      }
    } catch (error) {
      console.error('Authentication error:', error);
    }
  };

  const completeTask = async (taskId: string) => {
    if (!userData) {
      alert('User data not loaded. Please try again.');
      return false;
    }

    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        alert('Task not found.');
        return false;
      }

      const currentProgress = userData.tasksCompleted?.[taskId] || 0;
      const newProgress = currentProgress + 1;
      const reward = task.reward;

      if (currentProgress >= task.totalRequired) {
        alert('Task already completed!');
        return false;
      }

      await firebaseRequest.updateTaskProgress(userData.telegramId, taskId, newProgress);

      const newBalance = userData.balance + reward;
      const newTotalEarned = userData.totalEarned + reward;

      await firebaseRequest.updateUser(userData.telegramId, {
        balance: newBalance,
        totalEarned: newTotalEarned,
        tasksCompleted: {
          ...userData.tasksCompleted,
          [taskId]: newProgress
        }
      });

      await firebaseRequest.addTransaction({
        userId: userData.telegramId.toString(),
        type: 'reward',
        amount: reward,
        description: `Completed task: ${task.name}`,
        status: 'completed',
        createdAt: new Date().toISOString()
      });

      if (userData.referredBy) {
        const commissionSuccess = await firebaseRequest.addReferralCommission(userData.telegramId, reward);
        if (commissionSuccess) {
          console.log('Referral commission added successfully');
        } else {
          console.log('Failed to add referral commission');
        }
      }

      return true;
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Error completing task. Please try again.');
      return false;
    }
  };

  const processWithdrawal = async () => {
    if (!selectedMethod || !accountNumber || !amount || !userData) {
      alert('Please fill all fields correctly.');
      return false;
    }

    const withdrawalAmount = parseFloat(amount);
    const minWithdrawal = selectedMethod.minWithdrawal || walletConfig.defaultMinWithdrawal;

    if (isNaN(withdrawalAmount) || withdrawalAmount < minWithdrawal || withdrawalAmount > userData.balance) {
      alert(`Invalid amount. Minimum withdrawal for ${selectedMethod.name} is ${walletConfig.currencySymbol} ${minWithdrawal} ${walletConfig.currency} and cannot exceed your balance.`);
      return false;
    }

    if (walletConfig.maintenanceMode) {
      alert(walletConfig.maintenanceMessage);
      return false;
    }

    try {
      const newBalance = userData.balance - withdrawalAmount;
      const newTotalWithdrawn = userData.totalWithdrawn + withdrawalAmount;

      await firebaseRequest.updateUser(userData.telegramId, {
        balance: newBalance,
        totalWithdrawn: newTotalWithdrawn
      });

      await firebaseRequest.addTransaction({
        userId: userData.telegramId.toString(),
        type: 'withdrawal',
        amount: withdrawalAmount,
        description: `Withdrawal via ${selectedMethod.name}`,
        status: 'pending',
        method: selectedMethod.name,
        accountNumber: accountNumber,
        createdAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      return false;
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    const success = await processWithdrawal();

    if (success) {
      setAccountNumber("");
      setAmount("");
      setSelectedMethod(null);
      alert("Withdrawal request submitted successfully!");
    } else {
      alert("Withdrawal failed. Please check your inputs and try again.");
    }
    setIsLoading(false);
  };

  const onReady = (event: any) => {
    event.target.playVideo();
  };


  useEffect(() => {
    if (activeTab === 'home' && appConfig.sliderImages.length > 0) {
      startSlideShow();
    }
    return () => {
      if (slideInterval.current) {
        clearInterval(slideInterval.current);
      }
    };
  }, [activeTab, appConfig.sliderImages]);

  const startSlideShow = () => {
    if (slideInterval.current) {
      clearInterval(slideInterval.current);
    }

    if (appConfig.sliderImages.length > 1) {
      slideInterval.current = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % appConfig.sliderImages.length);
      }, 3000);
    }
  };

  const handleSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
  };

  const renderContent = () => {
    // Show loading state while initializing
    if (isInitializing && !showSplashScreen) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-2" />
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      );
    }

    if (showWallet) {
      return (
        <div className="px-4 mt-6">
          <div className="flex items-center mb-6 cursor-pointer" onClick={() => setShowWallet(false)}>
            <ArrowLeft className="w-5 h-5 text-white mr-2" />
            <span className="text-white">Back</span>
          </div>

          <div className="bg-[#0a1a2b] rounded-3xl border border-[#014983]/30 p-4 text-white">
            <div className="bg-gradient-to-r from-[#0a1a2b] to-[#001f3f] p-5 rounded-3xl flex items-center gap-4 mb-4 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-[#014983]/20">
              <div className="bg-[#014983] w-14 h-14 rounded-full flex items-center justify-center shadow-inner">
                <Wallet className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Wallet Balance</h2>
                <p className="text-green-400 font-bold text-lg">{walletConfig.currencySymbol} {userData?.balance?.toFixed(2) || '0.00'}</p>
              </div>
            </div>

            <div className="max-w-sm mx-auto">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-blue-300 mb-4">Select Payment Method</h3>

                <div className="relative">
                  <div className="flex overflow-x-auto pb-2 hide-scrollbar snap-x snap-mandatory space-x-2">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        className={`relative h-20 w-32 flex-shrink-0 rounded-2xl transition-all overflow-hidden group snap-center ${selectedMethod?.id === method.id
                          ? 'border-[#3b82f6] ring-1 ring-[#3b82f6] scale-95'
                          : 'border-[#014983]/30 hover:border-[#3b82f6]/30 hover:scale-95'
                          }`}
                        onClick={() => handleSelect(method)}
                        onMouseEnter={() => !selectedMethod && handleSelect(method)}
                        onMouseLeave={() => !selectedMethod && setSelectedMethod(null)}
                      >
                        <img
                          src={method.logo}
                          alt={method.name}
                          className="w-full h-full object-cover absolute inset-0 transition-transform group-hover:scale-110"
                        />

                        <div className={`absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity ${selectedMethod?.id === method.id ? 'opacity-100' : ''
                          }`}></div>

                        <div className="absolute bottom-1 right-1 bg-black/70 px-2 py-1 rounded text-xs transition-transform group-hover:translate-y-0 translate-y-6">
                          {method.name}
                        </div>

                        {selectedMethod?.id === method.id && (
                          <div className="absolute top-1 right-1 bg-[#3b82f6] rounded-full p-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {paymentMethods.length >= 4 && (
                    <div className="flex justify-center mt-2 space-x-1">
                      {paymentMethods.map((_, index) => (
                        <div key={index} className="w-1.5 h-1.5 rounded-full bg-[#014983]/30"></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedMethod && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-3 p-4 bg-[#0a1a2b] rounded-3xl border border-[#014983]/30"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-sm text-blue-300">Selected method:</div>
                    <div className="flex items-center gap-1 bg-[#014983] px-2 py-1 rounded-md">
                      <img src={selectedMethod.logo} alt={selectedMethod.name} className="w-4 h-4 object-contain" />
                      <span className="text-white font-medium text-sm">{selectedMethod.name}</span>
                    </div>
                  </div>

                  <div className="text-xs text-blue-300 bg-[#014983]/20 p-2 rounded-lg">
                    Minimum withdrawal: {walletConfig.currencySymbol} {selectedMethod.minWithdrawal} {walletConfig.currency}
                  </div>

                  <input
                    type="text"
                    placeholder={`Enter ${selectedMethod.name} Account Number`}
                    className="w-full p-3 rounded-3xl border border-[#014983]/30 bg-[#0a1a2b] text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />

                  <input
                    type="number"
                    placeholder="Enter Amount"
                    className="w-full p-3 rounded-3xl border border-[#014983]/30 bg-[#0a1a2b] text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={selectedMethod.minWithdrawal}
                  />

                  <button
                    onClick={handleSubmit}
                    disabled={isLoading || !accountNumber || !amount || parseFloat(amount) < selectedMethod.minWithdrawal || parseFloat(amount) > (userData?.balance || 0)}
                    className={`w-full text-white py-3 rounded-3xl font-bold transition-colors mt-2 flex items-center justify-center ${isLoading || !accountNumber || !amount || parseFloat(amount) < selectedMethod.minWithdrawal || parseFloat(amount) > (userData?.balance || 0)
                      ? 'bg-blue-700 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      `Submit with ${selectedMethod.name}`
                    )}
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (showLeaderboard) {
      return (
        <LeaderBoard
          onBack={() => setShowLeaderboard(false)}
          currentUserId={userData?.telegramId}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <div className="px-4 mt-6">
            <div className="bg-[#0a1a2b] rounded-3xl p-4 mb-4 border border-[#014983]/30 flex items-center justify-between">
              <ProfileCard userData={userData} />
            </div>

            {appConfig.sliderImages.length > 0 ? (
              <div className="p-0 relative rounded-3xl border border-[#014983]/60">
                <div
                  className="flex duration-500 ease-in-out w-full"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {appConfig.sliderImages.map((slide) => (
                    <div
                      key={slide.id}
                      className="flex-shrink-0 w-full h-40 rounded-3xl flex items-center justify-center overflow-hidden"
                    >
                      <img
                        src={slide.url}
                        alt={slide.alt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>

                {appConfig.sliderImages.length > 1 && (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-2">
                    {appConfig.sliderImages.map((_, index) => (
                      <button
                        key={index}
                        className={`w-2 h-2 rounded-full transition-all ${index === currentSlide ? 'bg-white' : 'bg-white/50'
                          }`}
                        onClick={() => setCurrentSlide(index)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-0 relative rounded-3xl border border-[#014983]/60 overflow-hidden h-40 flex items-center justify-center bg-[#0a1a2b]">
                <div className="text-center text-blue-300">
                  <FaImages className="text-4xl mb-2 mx-auto" />
                  <p>No slider images configured</p>
                </div>
              </div>
            )}

            <div
              className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-3xl p-4 mt-4 border border-yellow-400 shadow-lg cursor-pointer hover:scale-[1.02] transition-transform duration-300"
              onClick={() => setShowLeaderboard(true)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FaTrophy className="text-white text-2xl mr-3" />
                  <div>
                    <h3 className="text-white font-bold text-lg">Leaderboard</h3>
                    <p className="text-white/90 text-sm">See top performers and earn rewards</p>
                  </div>
                </div>
                <div className="bg-white/20 rounded-full p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 mb-6">
              <div className="bg-[#0a1a2b] rounded-3xl px-4 py-4 relative border border-[#014983]/30 flex flex-col items-center">
                <FaCoins className="text-green-400 text-2xl mb-1" />
                <p className="text-[14px] text-center text-green-200">Total Earned</p>
                <p className="text-sm font-bold text-white mt-1">{walletConfig.currencySymbol} {userData?.totalEarned?.toFixed(2) || '0.00'}</p>
              </div>

              <div className="bg-[#0a1a2b] rounded-3xl px-4 py-4 relative border border-[#014983]/30 flex flex-col items-center">
                <FaTasks className="text-yellow-400 text-2xl mb-1" />
                <p className="text-[14px] text-center text-yellow-200">Completed Tasks</p>
                <p className="text-sm font-bold text-white mt-1">{Object.values(userData?.tasksCompleted || {}).filter(v => v > 0).length}</p>
              </div>

              <div className="bg-[#0a1a2b] rounded-3xl px-4 py-4 relative border border-[#014983]/30 flex flex-col items-center">
                <FaUserFriends className="text-purple-400 text-2xl mb-1" />
                <p className="text-[14px] text-center text-purple-200">Total Refer</p>
                <p className="text-sm font-bold text-white mt-1">{referralData?.referredCount || 0}</p>
              </div>

              <div className="bg-[#0a1a2b] rounded-3xl px-4 py-4 relative border border-[#014983]/30 flex flex-col items-center">
                <FaAd className="text-red-400 text-2xl mb-1" />
                <p className="text-[14px] text-center text-red-200">Total Ads Show</p>
                <p className="text-sm font-bold text-white mt-1">{userData?.adsWatchedToday || 0}</p>
              </div>
            </div>
          </div>
        );

      case 'earn':
        return (
          <Earn
            userData={userData}
            tasks={tasks}
            onCompleteTask={completeTask}
            onBack={() => { }}
          />
        );

      case 'referrals':
        return <ReferPage userId={telegramUser?.id?.toString() || ''} userData={userData} referralData={referralData} />;

      case 'history':
        return (
          <TransactionComponent
            userData={userData}
            transactions={transactions}
            onBack={() => setActiveTab('home')}
            walletConfig={walletConfig}
          />
        );

      case 'profile':
        return (
          <div className="px-4 mt-6 space-y-2">
            <div className="bg-[#0a1a2b] rounded-3xl p-2 mb-4 border border-[#014983]/30 flex items-center justify-between">
              <ProfileCard userData={userData} />

              <button
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-5 py-3 rounded-3xl shadow-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-3xl"
                onClick={() => setShowWallet(true)}
              >
                <Wallet className="w-5 h-5" />
                Wallet
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gradient-to-tr from-[#0f1c34] to-[#0a1a2b] rounded-3xl px-5 py-5 border border-blue-700/40 flex flex-col items-center shadow-md hover:shadow-xl transition">
                <FaCalendarAlt className="text-blue-400 text-3xl mb-2" />
                <p className="text-sm text-blue-200 font-medium">Join Date</p>
                <p className="text-lg font-bold text-white mt-1">
                  {userData?.joinDate
                    ? new Date(userData.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Jan 15, 2022'}
                </p>
              </div>

              <div className="bg-gradient-to-tr from-[#0f1c34] to-[#0a1a2b] rounded-3xl px-5 py-5 border border-blue-700/40 flex flex-col items-center shadow-md hover:shadow-xl transition">
                <FaMoneyBillWave className="text-green-400 text-3xl mb-2" />
                <p className="text-sm text-green-200 font-medium">Total Withdrawn</p>
                <p className="text-lg font-bold text-white mt-1">
                  {walletConfig.currency} {userData?.totalWithdrawn?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>

            <div className="rounded-3xl p-1 mb-2 border border-blue-700/40 bg-gradient-to-br from-[#0f1c34] to-[#0a1a2b] shadow-lg hover:shadow-2xl transition">
              <h3 className="font-bold p-1 mb-0 text-white flex items-center gap-2 text-lg">
                <Youtube className="text-red-500" />
                Tutorial
              </h3>

              <div className="w-full aspect-video rounded-xl overflow-hidden">
                <YouTube
                  videoId={appConfig.tutorialVideoId || "dQw4w9WgXcQ"}
                  onReady={onReady}
                  opts={{
                    width: "100%",
                    height: "100%",
                    playerVars: {
                      autoplay: 0,
                      rel: 0,
                      modestbranding: 1,
                    },
                  }}
                  className="w-full h-full"
                />
              </div>
            </div>

            <div className="rounded-3xl p-5 border border-red-500/40 bg-gradient-to-br from-[#1c0f1c] to-[#2b0a1a] shadow-md hover:shadow-xl transition flex items-center justify-between gap-4">
              <FaHeadset className="text-red-400 text-3xl" />

              <div className="flex-1">
                <h4 className="text-sm font-bold text-white">Contact Support</h4>
                <p className="text-xs text-gray-300 mt-1">
                  {appConfig.supportUrl ? 'Get help via Telegram' : 'Support channel not configured'}
                </p>
              </div>

              <a
                href={appConfig.supportUrl || "https://t.me/YourChannelName"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-3xl shadow-md transition"
              >
                <FaTelegramPlane className="w-5 h-5" />
                Telegram
              </a>
            </div>

            {/* Developed By Line */}
            <p className="text-center text-xs text-gray-400 mt-4">
              <a
                href="https://t.me/altaslab" // Replace with your Telegram channel
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 hover:text-blue-400 transition-colors"
              >
                <FaTelegramPlane className="w-4 h-4" />
                Developed By Atlas Lab BD
              </a>
            </p>
          </div>
        );


      default:
        return <div className="px-4 mt-6">Page not found</div>;
    }
  };

  // Show splash screen ONLY for multi-accounts or device not allowed
  if (showSplashScreen) {
    return (
      <SplashScreen
        mainAccount={splashScreenData.mainAccount}
        maxAccountsPerDevice={maxAccountsPerDevice}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050505]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading app...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Topbar userData={userData} setShowWallet={setShowWallet} />

      <div className="flex-grow mt-4 bg-gradient-to-b from-[#014983] to-[#012748] rounded-t-[48px] relative top-glow z-0">
        <div className="absolute top-[2px] left-0 right-0 bottom-0 bg-[#050505] rounded-t-[46px] overflow-y-auto pb-20 no-scrollbar">
          {renderContent()}
        </div>
      </div>

      {!showWallet && !showDailyTasks && !showLeaderboard && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setShowWallet={setShowWallet}
          balance={userData?.balance || 0}
          showWallet={showWallet}
          showDailyTasks={showDailyTasks}
        />
      )}
    </>
  );
};

export default App;
