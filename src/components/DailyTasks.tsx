import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Wifi, WifiOff, Server, Users } from 'lucide-react';
import { FaTasks, FaTelegram } from 'react-icons/fa';
import { getDatabase, ref, onValue, runTransaction } from 'firebase/database';

interface Task {
  id: string;
  name: string;
  reward: number;
  category: string;
  totalRequired: number;
  completed?: number;
  url?: string;
  buttonText?: string;
  usersQuantity?: number;
  completedUsers?: number;
  telegramChannel?: string;
  checkMembership?: boolean;
  inviteLink?: string;
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
  tasksCompleted: Record<string, number>;
  referredBy?: string;
}

interface DailyTasksProps {
  userData?: UserData | null;
  onCompleteTask: (taskId: string) => Promise<boolean>;
  onBack: () => void;
}

const SERVER_CONFIG = {
  baseUrl: 'https://ads-ixjc.onrender.com',
  endpoints: {
    telegram: '/api/telegram/check-membership',
    connect: '/api/frontend/connect',
    health: '/api/health'
  }
};

const DailyTasks: React.FC<DailyTasksProps> = ({
  userData,
  onCompleteTask,
  onBack,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dailyTaskFilter, setDailyTaskFilter] = useState("All");
  const [pendingTask, setPendingTask] = useState<Task | null>(null);
  const [claimingTask, setClaimingTask] = useState<string | null>(null);
  const [startingTask, setStartingTask] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [serverStatus, setServerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [connectionId, setConnectionId] = useState<string>('');

  useEffect(() => {
    registerFrontendConnection();
  }, [userData]);

  useEffect(() => {
    const database = getDatabase();
    const tasksRef = ref(database, 'tasks');

    const unsubscribe = onValue(tasksRef, (snapshot) => {
      if (snapshot.exists()) {
        const tasksData: Task[] = [];
        snapshot.forEach((childSnapshot) => {
          const taskData = childSnapshot.val();
          const task: Task = {
            ...taskData,
            id: childSnapshot.key as string,
            usersQuantity: taskData.usersQuantity || 0,
            completedUsers: taskData.completedUsers || 0,
            telegramChannel: taskData.telegramChannel || '',
            checkMembership: taskData.checkMembership || false,
            inviteLink: taskData.inviteLink || ''
          };
          tasksData.push(task);
        });
        setTasks(tasksData);
      } else {
        setTasks([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const registerFrontendConnection = async () => {
    try {
      setServerStatus('connecting');
      const response = await fetch(`${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.endpoints.connect}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          userData: userData ? {
            telegramId: userData.telegramId,
            username: userData.username,
          } : null
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionId(data.connectionId);
        setServerStatus('connected');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Frontend connection failed:', error);
      setServerStatus('error');
    }
  };

  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.endpoints.health}`);
      if (response.ok) {
        setServerStatus('connected');
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setServerStatus('error');
      return false;
    }
  };

  const checkTelegramMembership = async (taskId: string): Promise<boolean> => {
    if (!userData) {
      setTaskErrors(prev => ({
        ...prev,
        [taskId]: "User not logged in"
      }));
      return false;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task?.telegramChannel) {
      setTaskErrors(prev => ({
        ...prev,
        [taskId]: "Telegram channel not configured"
      }));
      return false;
    }

    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      setTaskErrors(prev => ({
        ...prev,
        [taskId]: "Server is unavailable"
      }));
      return false;
    }

    try {
      const response = await fetch(`${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.endpoints.telegram}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.telegramId,
          username: userData.username,
          channel: task.telegramChannel,
          connectionId: connectionId,
          taskId: taskId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      return result.isMember;

    } catch (error: any) {
      setTaskErrors(prev => ({
        ...prev,
        [taskId]: `Verification failed: ${error.message}`
      }));
      return false;
    }
  };

  const filteredTasks =
    dailyTaskFilter === "All"
      ? tasks
      : tasks.filter((task) => task.category === dailyTaskFilter);

  const totalPages = Math.ceil(filteredTasks.length / 3);
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * 3,
    currentPage * 3
  );

  const getTaskAvailability = (task: Task) => {
    if (!userData) {
      return { canStart: false, reason: "User not logged in" };
    }

    const completed = userData.tasksCompleted?.[task.id] || 0;
    const isCompleted = completed >= task.totalRequired;
    const usersQuantity = task.usersQuantity || 0;
    const completedUsers = task.completedUsers || 0;

    // Check if task is disabled for all users (users quantity limit reached)
    if (usersQuantity > 0 && completedUsers >= usersQuantity) {
      return { canStart: false, reason: "This task is no longer available" };
    }

    if (isCompleted) {
      return { canStart: false, reason: "You've completed this task" };
    }

    return { canStart: true };
  };

  const incrementCompletedUsers = async (taskId: string): Promise<boolean> => {
    const database = getDatabase();
    const taskRef = ref(database, `tasks/${taskId}`);

    try {
      const result = await runTransaction(taskRef, (currentTask) => {
        if (!currentTask) return;

        const usersQuantity = currentTask.usersQuantity || 0;
        const completedUsers = currentTask.completedUsers || 0;

        // Only increment if we haven't reached the limit
        if (usersQuantity > 0 && completedUsers >= usersQuantity) {
          throw new Error("Task users quantity limit reached");
        }

        currentTask.completedUsers = (completedUsers || 0) + 1;
        return currentTask;
      });

      return result.committed;
    } catch (error) {
      console.error('Error incrementing completed users:', error);
      return false;
    }
  };

  const handleStartTask = async (task: Task) => {
    if (!userData) {
      alert("Please log in to start tasks");
      return;
    }

    if (task.category === "TG Tasks" && task.checkMembership) {
      const isHealthy = await checkServerHealth();
      if (!isHealthy) {
        setTaskErrors(prev => ({
          ...prev,
          [task.id]: "Server is currently unavailable"
        }));
        return;
      }
    }

    setStartingTask(task.id);
    setTaskErrors(prev => ({ ...prev, [task.id]: '' }));

    try {
      setPendingTask(task);

      if (task.category === "TG Tasks" && task.telegramChannel) {
        const telegramUrl = task.inviteLink || `https://t.me/${task.telegramChannel}`;
        window.open(telegramUrl, "_blank", "noopener,noreferrer");
        alert(`Join the channel: ${task.telegramChannel}\n\n1. Click the link to join\n2. Wait a few seconds after joining\n3. Come back and click "Verify & Claim"`);
      } else if (task.url) {
        window.open(task.url, "_blank", "noopener,noreferrer");
      } else {
        setTimeout(() => {
          handleClaimTask(task);
        }, 1000);
      }
    } catch (error) {
      setTaskErrors(prev => ({
        ...prev,
        [task.id]: "Error starting task"
      }));
    } finally {
      setStartingTask(null);
    }
  };

  const handleClaimTask = async (task: Task): Promise<void> => {
    if (!userData) return;

    setClaimingTask(task.id);
    setTaskErrors(prev => ({ ...prev, [task.id]: '' }));

    try {
      if (task.category === "TG Tasks" && task.telegramChannel && task.checkMembership) {
        const isMember = await checkTelegramMembership(task.id);

        if (!isMember) {
          setTaskErrors(prev => ({
            ...prev,
            [task.id]: "We couldn't verify that you joined the channel"
          }));
          setPendingTask(null);
          setClaimingTask(null);
          return;
        }
      }

      // Check if we can still complete this task (users quantity limit)
      const usersQuantity = task.usersQuantity || 0;
      const completedUsers = task.completedUsers || 0;

      if (usersQuantity > 0 && completedUsers >= usersQuantity) {
        setTaskErrors(prev => ({
          ...prev,
          [task.id]: "This task is no longer available"
        }));
        setPendingTask(null);
        setClaimingTask(null);
        return;
      }

      // Increment completed users count
      const userIncremented = await incrementCompletedUsers(task.id);

      if (!userIncremented) {
        setTaskErrors(prev => ({
          ...prev,
          [task.id]: "This task is no longer available"
        }));
        setPendingTask(null);
        setClaimingTask(null);
        return;
      }

      const success = await onCompleteTask(task.id);

      if (success) {
        setPendingTask(null);
        alert(`🎉 Task completed! You earned $${task.reward.toFixed(2)}`);
      } else {
        alert("Failed to complete task");
      }
    } catch (error) {
      alert("Error completing task");
    } finally {
      setClaimingTask(null);
    }
  };

  const handleCancelTask = async (task: Task) => {
    setPendingTask(null);
    setTaskErrors(prev => ({ ...prev, [task.id]: '' }));
  };

  const getTaskIcon = (category: string) => {
    if (category === "TG Tasks") {
      return <FaTelegram className="w-5 h-5 text-white-400" />;
    }
    return <FaTasks className="w-5 h-5 text-white-400" />;
  };

  const getServerStatusIcon = () => {
    switch (serverStatus) {
      case 'connected':
        return <Wifi className="w-5 h-5 text-green-400" />;
      case 'error':
        return <WifiOff className="w-5 h-5 text-red-400" />;
      default:
        return <Server className="w-5 h-5 text-yellow-400 animate-pulse" />;
    }
  };

  const handleRetryConnection = async () => {
    await registerFrontendConnection();
  };

  const isServerOnline = serverStatus === 'connected';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center mb-8">
            <div className="flex items-center cursor-pointer group" onClick={onBack}>
              <div className="bg-white/10 p-2 rounded-2xl group-hover:bg-white/20 transition-all duration-300 mr-3">
                <ArrowLeft className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold text-white">Daily Tasks</h1>
              <p className="text-blue-200 text-sm mt-1">Complete tasks and earn rewards</p>
            </div>
            <div className="w-12"></div>
          </div>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 bg-white/10 rounded-2xl hover:bg-white/20 transition-all duration-300 mr-3"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white">Daily Tasks</h1>
              {getServerStatusIcon()}
            </div>
            <p className="text-blue-200 text-sm">Complete tasks and earn rewards</p>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Server Offline Warning */}
        {!isServerOnline && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">Server Offline</span>
            </div>
            <p className="text-red-300 text-xs">
              Telegram tasks are currently unavailable. Please try again later.
            </p>
            <button
              onClick={handleRetryConnection}
              className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-all mt-2"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-1 mb-6">
          <div className="flex justify-between gap-1">
            {["All", "Socials Tasks", "TG Tasks"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setDailyTaskFilter(tab);
                  setCurrentPage(1);
                  setTaskErrors({});
                }}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2
                  ${dailyTaskFilter === tab
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                    : "text-blue-200 hover:text-white hover:bg-white/10"
                  }`}
              >
                {tab === "TG Tasks" && <FaTelegram className="w-4 h-4" />}
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {paginatedTasks.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 text-center">
              <FaTasks className="w-12 h-12 text-blue-400 mx-auto mb-3 opacity-50" />
              <p className="text-blue-300 font-semibold">
                {tasks.length === 0 ? "No tasks available" : "No tasks in this category"}
              </p>
              <p className="text-blue-200 text-sm mt-1">
                Check back later for new tasks
              </p>
            </div>
          ) : (
            paginatedTasks.map((task) => {
              const completed = userData?.tasksCompleted?.[task.id] || 0;
              const isCompleted = completed >= task.totalRequired;
              const isPending = pendingTask?.id === task.id;
              const isStarting = startingTask === task.id;
              const isClaiming = claimingTask === task.id;
              const availability = getTaskAvailability(task);
              const isTelegramTask = task.category === "TG Tasks" && task.checkMembership;
              const isTaskDisabled = isTelegramTask && !isServerOnline;
              const usersQuantity = task.usersQuantity || 0;
              const completedUsers = task.completedUsers || 0;
              const isTaskLimitReached = usersQuantity > 0 && completedUsers >= usersQuantity;

              return (
                <div
                  key={task.id}
                  className={`bg-white/10 backdrop-blur-lg rounded-2xl border transition-all duration-300
                    ${(isTaskDisabled || isTaskLimitReached) ? 'border-red-500/20 opacity-70' :
                      isPending ? 'border-yellow-500/30' : 'border-white/20 hover:border-white/30'}`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Task Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300
                        ${isCompleted ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                          isPending ? 'bg-gradient-to-r from-yellow-500 to-amber-600' :
                            !availability.canStart || isTaskDisabled || isTaskLimitReached ? 'bg-gradient-to-r from-red-500 to-pink-600' :
                              'bg-gradient-to-r from-blue-500 to-cyan-600'}`}
                      >
                        {getTaskIcon(task.category)}
                      </div>

                      {/* Task Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header Row */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-bold text-base leading-tight mb-1 ${(isTaskDisabled || isTaskLimitReached) ? 'text-gray-400' : 'text-white'
                              }`}>
                              {task.name}
                            </h3>

                            {/* Telegram Channel */}
                            {task.telegramChannel && (
                              <div className="flex items-center gap-1 mb-2">
                                <FaTelegram className={`w-3 h-3 ${(isTaskDisabled || isTaskLimitReached) ? 'text-gray-500' : 'text-blue-300'}`} />
                                <span className={`text-xs ${(isTaskDisabled || isTaskLimitReached) ? 'text-gray-500' : 'text-blue-300'}`}>
                                  @{task.telegramChannel}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Reward */}
                          <div className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-lg border border-green-500/30 ml-2 flex-shrink-0">
                            +${task.reward.toFixed(2)}
                          </div>
                        </div>

                        {/* Progress and Stats */}
                        <div className="space-y-2">
                          {/* User Progress */}
                          <div className="flex items-center justify-between">
                            <span className={`text-xs ${(isTaskDisabled || isTaskLimitReached) ? 'text-gray-500' : 'text-blue-300'}`}>
                              Your progress: {completed}/{task.totalRequired}
                            </span>
                            {isCompleted && (
                              <span className="text-green-400 text-xs font-medium bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                                Completed
                              </span>
                            )}
                          </div>

                          {/* Users Quantity Stats */}
                          {usersQuantity > 0 && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-xs text-blue-300">
                                <Users className="w-3 h-3" />
                                <span>
                                  {completedUsers}/{usersQuantity} users
                                  {" "}• Remaining: {usersQuantity - completedUsers}
                                </span>
                              </div>
                              {isTaskLimitReached && (
                                <span className="text-red-400 text-xs font-medium bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                                  Limit Reached
                                </span>
                              )}
                            </div>
                          )}

                          {taskErrors[task.id] && (
                            <p className="text-red-400 text-xs bg-red-500/10 px-2 py-1 rounded border border-red-500/20 whitespace-pre-line">
                              ⚠️ {taskErrors[task.id]}
                            </p>
                          )}
                        </div>

                        {/* Action Button */}
                        <div className="mt-3">
                          {isPending ? (
                            <div className="flex gap-2">
                              <button
                                className="flex-1 px-4 py-2 rounded-xl font-semibold text-sm bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white transition-all duration-300 flex items-center justify-center gap-2"
                                disabled={isClaiming || !isServerOnline || isTaskLimitReached}
                                onClick={() => handleClaimTask(task)}
                              >
                                {isClaiming ? (
                                  <>
                                    <Clock className="w-4 h-4 animate-spin" />
                                    Verifying...
                                  </>
                                ) : (
                                  "Verify & Claim"
                                )}
                              </button>
                              <button
                                className="px-3 py-2 rounded-xl text-xs bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all duration-300"
                                onClick={() => handleCancelTask(task)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              className={`w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2
                                ${isCompleted
                                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                                  : !availability.canStart || isStarting || isTaskDisabled || isTaskLimitReached
                                    ? "bg-red-500/50 text-red-200 cursor-not-allowed"
                                    : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                                }`}
                              disabled={isCompleted || !availability.canStart || isStarting || isTaskDisabled || isTaskLimitReached}
                              onClick={() => handleStartTask(task)}
                            >
                              {isCompleted ? (
                                "Completed"
                              ) : isStarting ? (
                                <>
                                  <Clock className="w-4 h-4 animate-spin" />
                                  Starting...
                                </>
                              ) : !availability.canStart ? (
                                "Unavailable"
                              ) : isTaskDisabled ? (
                                "Offline"
                              ) : isTaskLimitReached ? (
                                "Unavailable"
                              ) : task.buttonText ? (
                                task.buttonText
                              ) : task.category === "TG Tasks" ? (
                                <>
                                  <FaTelegram className="w-4 h-4" />
                                  Join Channel
                                </>
                              ) : (
                                "🚀 Start Task"
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-6 space-x-3">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm rounded-lg bg-white/10 text-blue-300 disabled:opacity-40 hover:text-white hover:bg-white/20 transition-all duration-300 border border-white/20"
            >
              Previous
            </button>
            <span className="text-blue-300 text-sm font-medium min-w-[80px] text-center">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm rounded-lg bg-white/10 text-blue-300 disabled:opacity-40 hover:text-white hover:bg-white/20 transition-all duration-300 border border-white/20"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyTasks;