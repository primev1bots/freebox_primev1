import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { FaTasks } from 'react-icons/fa';

interface Task {
  id: string;
  name: string;
  description: string;
  reward: number;
  category: string;
  totalRequired: number;
  completed?: number;
  url?: string;
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

interface DailyTasksProps {
  userData?: UserData | null;
  tasks: Task[];
  onCompleteTask: (taskId: string) => Promise<boolean>;
  onBack: () => void;
}

const TASKS_PER_PAGE = 3;

const DailyTasks: React.FC<DailyTasksProps> = ({
  userData,
  tasks,
  onCompleteTask,
  onBack,
}) => {
  const [dailyTaskFilter, setDailyTaskFilter] = useState("All");
  const [pendingTask, setPendingTask] = useState<Task | null>(null);
  const [claimingTask, setClaimingTask] = useState<string | null>(null);
  const [taskTimer, setTaskTimer] = useState<number>(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filteredTasks =
    dailyTaskFilter === "All"
      ? tasks
      : tasks.filter((task) => task.category === dailyTaskFilter);

  const totalPages = Math.ceil(filteredTasks.length / TASKS_PER_PAGE);
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * TASKS_PER_PAGE,
    currentPage * TASKS_PER_PAGE
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [timerInterval]);

  const handleStartTask = (task: Task) => {
    if (task.category === "Web Tasks") {
      setPendingTask(task);
      setTaskTimer(5); // 5 seconds timer

      const taskUrl = task.url || "https://risknai.com";
      window.open(taskUrl, "_blank", "noopener,noreferrer");

      const interval = setInterval(() => {
        setTaskTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setTimerInterval(interval);
    } else {
      setPendingTask(task);
      window.open("https://risknai.com", "_blank", "noopener,noreferrer");
    }
  };

  const handleClaimTask = async (task: Task) => {
    if (task.category === "Web Tasks" && taskTimer > 0) {
      alert(`⏳ Please wait ${taskTimer} more seconds before claiming this task`);
      return;
    }

    setClaimingTask(task.id);
    try {
      const success = await onCompleteTask(task.id);
      if (success) {
        setPendingTask(null);
        setTaskTimer(0);
        if (timerInterval) {
          clearInterval(timerInterval);
          setTimerInterval(null);
        }
        alert(`🎉 Task completed! You earned $${task.reward.toFixed(2)}`);
      } else {
        alert("❌ Failed to complete task. Please try again.");
      }
    } catch {
      alert("❌ Error completing task. Please try again.");
    } finally {
      setClaimingTask(null);
    }
  };

  const getButtonState = (task: Task) => {
    const completed = userData?.tasksCompleted?.[task.id] || 0;
    const isCompleted = completed >= task.totalRequired;
    const isPending = pendingTask?.id === task.id;
    const isWebTask = task.category === "Web Tasks";
    const isTimerActive = isWebTask && isPending && taskTimer > 0;

    return { isCompleted, isPending, isWebTask, isTimerActive };
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <div
            className="flex items-center cursor-pointer group"
            onClick={onBack}
          >
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

        {/* Filter Tabs */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-2 mb-6">
          <div className="flex justify-between gap-1">
            {["All", "Socials Tasks", "Web Tasks"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setDailyTaskFilter(tab);
                  setCurrentPage(1); // Reset page when filter changes
                }}
                className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ease-out transform
                  ${
                    dailyTaskFilter === tab
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg scale-105"
                      : "text-blue-200 hover:text-white hover:bg-white/10 hover:scale-105"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          {paginatedTasks.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-8 text-center">
              <FaTasks className="w-16 h-16 text-blue-400 mx-auto mb-4 opacity-50" />
              <p className="text-blue-300 text-lg font-semibold">No tasks available</p>
              <p className="text-blue-400 text-sm mt-2">
                Check back later for new tasks
              </p>
            </div>
          ) : (
            paginatedTasks.map((task) => {
              const completed = userData?.tasksCompleted?.[task.id] || 0;
              const { isCompleted, isPending, isWebTask, isTimerActive } = getButtonState(task);
              const isClaiming = claimingTask === task.id;

              return (
                <div
                  key={task.id}
                  className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-5 hover:bg-white/15 transition-all duration-300 hover:scale-[1.02] group"
                >
                  <div className="flex items-start justify-between">
                    {/* Task Info */}
                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        {/* Status Icon */}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300
                          ${isCompleted ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/25' :
                            isPending ? 'bg-gradient-to-r from-yellow-500 to-amber-600 shadow-lg shadow-yellow-500/25' :
                            'bg-gradient-to-r from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/25'}`}
                        >
                          {isCompleted ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : isPending ? (
                            <span className="text-white text-xs font-bold text-center">
                              {isTimerActive ? `${taskTimer}s` : "Pending"}
                            </span>
                          ) : (
                            <span className="text-white text-xs font-bold text-center">{completed}/{task.totalRequired}</span>
                          )}
                        </div>

                        {/* Task Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-lg mb-1 group-hover:text-blue-200 transition-colors">
                            {task.name}
                          </h3>
                         
                          {/* Timer notice for web tasks */}
                          {isWebTask && isPending && isTimerActive && (
                            <div className="mb-2">
                              <p className="text-yellow-400 text-xs font-semibold bg-yellow-400/10 px-2 py-1 rounded-full inline-block">
                                ⏳ Wait {taskTimer}s on the website
                              </p>
                            </div>
                          )}

                          {/* Reward and Category */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="text-blue-200 text-sm mb-0 leading-relaxed">
                                {task.description}
                              </p>
                              <span className="bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1 rounded-full border border-green-500/30">
                                +${task.reward.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="ml-4 flex-shrink-0">
                      <button
                        className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-300 transform hover:scale-105 shadow-lg
                          ${isCompleted
                            ? "bg-gray-600 text-gray-400 cursor-not-allowed shadow-none"
                            : isTimerActive
                            ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-orange-500/25 cursor-not-allowed"
                            : isPending
                            ? "bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white shadow-yellow-500/25"
                            : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-blue-500/25"
                          }`}
                        disabled={isCompleted || isTimerActive || isClaiming}
                        onClick={() =>
                          isPending && !isTimerActive
                            ? handleClaimTask(task)
                            : handleStartTask(task)
                        }
                      >
                        {isCompleted
                          ? "✅ Done"
                          : isTimerActive
                          ? `⏳ ${taskTimer}s`
                          : isPending
                          ? isClaiming
                            ? "⏳ Claiming..."
                            : "🎁 Claim"
                          : "🚀 Start"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-6 space-x-4">
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

export default DailyTasks;
