export type GuidePage = "music" | "editor" | "live";
export const ONBOARDING_VERSION = "battle-onboarding-v1";
const session = new Set<GuidePage>();
export function guideSeen(page: GuidePage): boolean {
  if (session.has(page)) return true;
  try {
    const value = JSON.parse(localStorage.getItem(ONBOARDING_VERSION) ?? "{}");
    return value?.[page] === true;
  } catch {
    return false;
  }
}
export function completeGuide(page: GuidePage) {
  session.add(page);
  try {
    let value: Record<string, boolean> = {};
    try {
      const stored = JSON.parse(
        localStorage.getItem(ONBOARDING_VERSION) ?? "{}",
      );
      if (stored && typeof stored === "object" && !Array.isArray(stored))
        value = stored;
    } catch {
      /* repair malformed preferences */
    }
    localStorage.setItem(
      ONBOARDING_VERSION,
      JSON.stringify({ ...value, [page]: true }),
    );
  } catch {
    /* Private mode must never block music. */
  }
}
