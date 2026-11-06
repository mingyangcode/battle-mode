import { iconFeedback } from "../utils/iconFeedback";
import { useState } from "react";
import { applyTheme, type Theme } from "../state/theme";
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  return (
    <button
      className="icon-button theme-toggle"
      aria-label={`切换到${theme === "light" ? "暗" : "亮"}色模式`}
      onClick={(event) => {
        iconFeedback(event.currentTarget);
        const next = theme === "light" ? "dark" : "light";
        applyTheme(next);
        setTheme(next);
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        {theme === "light" ? (
          <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" />
          </>
        )}
      </svg>
    </button>
  );
}
