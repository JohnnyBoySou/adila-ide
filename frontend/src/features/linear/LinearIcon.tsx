interface LinearIconProps {
  className?: string;
}

export function LinearIcon({ className }: LinearIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M.402 13.795a12.038 12.038 0 0 0 9.806 9.806L.402 13.795Z" />
      <path d="M.014 9.21l14.78 14.78a11.96 11.96 0 0 0 2.704-.402L.416 6.506A11.96 11.96 0 0 0 .014 9.21Z" />
      <path d="M1.18 4.55l18.27 18.27a12.046 12.046 0 0 0 1.78-1.34L2.52 2.77a12.046 12.046 0 0 0-1.34 1.78Z" />
      <path d="M4.4 1.5L22.5 19.6A12 12 0 1 0 4.4 1.5Z" />
    </svg>
  );
}
