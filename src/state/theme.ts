export type Theme = "light" | "dark";
export function readTheme(storage?: Pick<Storage, "getItem">): Theme {
  try {
    return storage?.getItem("battle-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "light" ? "#F7F8F7" : "#111412");
  try {
    localStorage.setItem("battle-theme", theme);
  } catch {
    /* session-only fallback */
  }
}
