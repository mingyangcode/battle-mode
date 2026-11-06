export function Icon({
  name,
  size = 22,
}: {
  name: "music" | "play" | "plus" | "arrow" | "headphones" | "check" | "close";
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "music" ? (
        <>
          <path d="M9 18V5l11-2v13M9 8l11-2" />
          <ellipse cx="6" cy="18" rx="3" ry="2" />
          <ellipse cx="17" cy="16" rx="3" ry="2" />
        </>
      ) : name === "play" ? (
        <path d="m9 5 11 7-11 7Z" />
      ) : name === "plus" ? (
        <path d="M12 5v14M5 12h14" />
      ) : name === "arrow" ? (
        <path d="m9 5 7 7-7 7" />
      ) : name === "headphones" ? (
        <>
          <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
          <rect x="3" y="12" width="4" height="8" rx="2" />
          <rect x="17" y="12" width="4" height="8" rx="2" />
        </>
      ) : name === "check" ? (
        <path d="m5 12 4 4L19 6" />
      ) : (
        <path d="m6 6 12 12M6 18 18 6" />
      )}
    </svg>
  );
}
