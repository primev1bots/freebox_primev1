import React from 'react';

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
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

interface ProfileCardProps {
  userData?: UserData | null;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ userData }) => {
  const [telegramUser, setTelegramUser] = React.useState<TelegramUser | null>(null);

  React.useEffect(() => {
    const checkTelegram = () => {
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        setTelegramUser(window.Telegram.WebApp.initDataUnsafe.user);
      } else {
        // Fallback for development/testing
        setTelegramUser({
          id: 123456,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
          photo_url: 'https://res.cloudinary.com/deu1ngeov/image/upload/v1758779824/Unknown_zbnrig.jpg'
        });
      }
    };
    checkTelegram();
  }, []);

  const profilePhoto = userData?.profilePhoto || telegramUser?.photo_url || "https://res.cloudinary.com/deu1ngeov/image/upload/v1758779824/Unknown_zbnrig.jpg";
  const firstName = userData?.firstName || telegramUser?.first_name || "Username";
  const lastName = userData?.lastName || telegramUser?.last_name || "";
  const username = userData?.username || telegramUser?.username || "username";
  const telegramId = userData?.telegramId || telegramUser?.id || "123456";
  const initials = firstName?.charAt(0) || "U";

  return (
    <div className="flex items-center space-x-4">
      <div className="w-16 h-16 bg-[#0a1a2b] border border-[#014983]/30 rounded-full flex items-center justify-center overflow-hidden">
        {profilePhoto && profilePhoto !== "https://res.cloudinary.com/deu1ngeov/image/upload/v1758779824/Unknown_zbnrig.jpg" ? (
          <img
            src={profilePhoto}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-white text-3xl">{initials}</span>
        )}
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">{firstName} {lastName}</h2>
        <p className="text-sm text-blue-300">@{username}</p>
        <p className="text-xs text-blue-300">ID: {telegramId}</p>
      </div>
    </div>
  );
};

export default ProfileCard;