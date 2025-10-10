import { IconProps } from "../utils/types";

const Profile: React.FC<IconProps> = ({ size = 24, className = "" }) => {
  const svgSize = `${size}px`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width={svgSize}
      height={svgSize}
      className={className}
    >
      <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.2c-3.2 0-9.6 1.6-9.6 4.8V22h19.2v-2.9c0-3.2-6.4-4.9-9.6-4.9z" />
    </svg>
  );
};

export default Profile;
