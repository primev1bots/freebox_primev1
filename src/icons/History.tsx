import { IconProps } from "../utils/types";

const History: React.FC<IconProps> = ({ size = 24, className = "" }) => {
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
      <path d="M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3zm1 5h-2v5l4.25 2.52.75-1.23-3.5-2.08V8z" />
    </svg>
  );
};

export default History;
