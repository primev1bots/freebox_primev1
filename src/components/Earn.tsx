import React, { useState, useEffect } from 'react';
import { FaTasks, FaAd, FaCheckCircle } from 'react-icons/fa';
import AdsDashboard from './AdsDashboard';
import VPNGuard from './VPNGuard';
import DailyTasks from './DailyTasks';
import CountryWidget from './CountryWidget';

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

interface Task {
  id: string;
  name: string;
  description: string;
  reward: number;
  category: string;
  totalRequired: number;
  completed?: number;
  progress?: number;
  url?: string;
}

interface EarnProps {
  userData?: UserData | null;
  tasks: Task[];
  onCompleteTask: (taskId: string) => Promise<boolean>;
  onBack: () => void;
  walletConfig?: {
    currency: string;
    currencySymbol: string;
  };
}

const Earn: React.FC<EarnProps> = ({
  userData,
  tasks,
  onCompleteTask,
  walletConfig = { currency: 'USDT', currencySymbol: '' }
}) => {
  const [activeTab] = useState<'ads' | 'tasks'>('ads');
  const [showDailyTasks, setShowDailyTasks] = useState(false);
  const [completedTaskReward, setCompletedTaskReward] = useState<number | null>(null);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    todayEarnings: 0,
    completedTasks: 0,
    availableTasks: 0
  });

  // Calculate stats
  useEffect(() => {
    if (userData) {
      const completedTasksCount = Object.values(userData.tasksCompleted || {}).reduce((sum, count) => sum + count, 0);
      const todayEarnings = (userData.adsWatchedToday * 0.5) + (completedTasksCount * 2); // Example calculation

      setStats({
        totalEarnings: userData.totalEarned,
        todayEarnings,
        completedTasks: completedTasksCount,
        availableTasks: tasks.length
      });
    }
  }, [userData, tasks]);

  // Show completion alert when returning from daily tasks view
  const handleBackFromDailyTasks = () => {
    setShowDailyTasks(false);
    if (completedTaskReward !== null) {
      setTimeout(() => {
        setCompletedTaskReward(null);
      }, 100);
    }
  };

  const handleCompleteTask = async (taskId: string): Promise<boolean> => {
    const success = await onCompleteTask(taskId);
    if (success) {
      setCompletedTaskReward(tasks.find(t => t.id === taskId)?.reward || 0);
    }
    return success;
  };

  const QuickActions = () => (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {/* Daily Tasks Quick Action */}
      <div
        className="relative h-full"
        onClick={() => setShowDailyTasks(true)}
      >
        <div
          className="rounded-3xl px-4 py-4 w-full h-full border border-[#014983]/30 cursor-pointer hover:bg-[#0f2235] transition-colors"
        >
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-2 shadow-lg shadow-blue-900/40">
            <FaTasks className="text-white text-xl" />
          </div>
          <p className="text-[10px] text-center text-blue-200 font-medium tracking-wide">
            Daily Tasks: {tasks.length}
          </p>
        </div>
      </div>

      {/* Country Widget Quick Action */}
      <div className="rounded-3xl px-4 py-4 w-full h-full border border-[#014983]/30 cursor-pointer hover:bg-[#0f2235] transition-colors">
        <CountryWidget />
      </div>
    </div>
  );

  const AdsContent = () => (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
          <FaAd className="text-blue-400" />
          <span className="text-white bg-clip-text font-bold tracking-wide underline decoration-[#ffff]/80 underline-offset-4">
            Ads Network
          </span>
        </h3>
      </div>

      {/* AdsDashboard now handles all ad functionality internally */}
      <AdsDashboard userData={userData} walletConfig={walletConfig} />
    </div>
  );

  const TasksContent = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
          <FaTasks className="text-green-400" />
          <span>Available Tasks</span>
        </h3>
        <div className="text-green-300 text-sm">
          {stats.availableTasks} tasks
        </div>
      </div>

      {tasks.slice(0, 3).map((task) => (
        <div key={task.id} className="bg-white/5 rounded-2xl p-4 border border-white/10 hover:border-green-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-white font-semibold text-sm mb-1">{task.name}</h4>
              <p className="text-gray-400 text-xs mb-2">{task.description}</p>
              <div className="flex items-center space-x-4">
                <span className="text-green-400 text-sm font-bold">${task.reward.toFixed(2)}</span>
                <span className="text-blue-400 text-xs">● {task.category}</span>
              </div>
            </div>
            <button
              onClick={() => setShowDailyTasks(true)}
              className="bg-gradient-to-r from-green-500 to-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:scale-105 transition-transform"
            >
              Start
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() => setShowDailyTasks(true)}
        className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white py-3 rounded-2xl font-bold hover:scale-105 transition-transform flex items-center justify-center space-x-2"
      >
        <FaTasks />
        <span>View All Tasks</span>
      </button>
    </div>
  );

  const earnContent = showDailyTasks ? (
    <DailyTasks
      userData={userData}
      onCompleteTask={handleCompleteTask}
      onBack={handleBackFromDailyTasks}
    />
  ) : (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] px-4 py-6">
      <div className="max-w-md mx-auto">

        <QuickActions />

        {/* Main Content */}
        <div className="rounded-3xl">
          {activeTab === 'ads' ? <AdsContent /> : <TasksContent />}
        </div>

        {/* Completion Reward Alert */}
        {completedTaskReward !== null && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl animate-bounce">
            <div className="flex items-center space-x-3">
              <FaCheckCircle className="text-xl" />
              <div>
                <p className="font-bold">Task Completed!</p>
                <p className="text-sm">+${completedTaskReward.toFixed(2)} earned</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <VPNGuard>
      {earnContent}
    </VPNGuard>
  );
};

export default Earn;
