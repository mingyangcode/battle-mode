export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export async function collapseTrack(id: string) {
  const row = document.getElementById(`track-${id}`);
  if (!row || reducedMotion() || !row.animate) return;
  const height = row.getBoundingClientRect().height;
  try {
    await row.animate(
      [
        { height: `${height}px`, opacity: 1 },
        { height: "0px", opacity: 0, marginBottom: "0px" },
      ],
      { duration: 150, easing: "ease-out", fill: "forwards" },
    ).finished;
  } catch {
    /* unmount/cancel does not block deletion */
  }
}
