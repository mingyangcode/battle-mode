import { iconFeedback } from "../utils/iconFeedback";
import { useEffect, useRef, useState } from "react";
import { guideCopy } from "../copy/zh-CN";
import { completeGuide, guideSeen, type GuidePage } from "../state/onboarding";
const targets: Record<GuidePage, string[]> = {
  music: ['[data-guide="add"]'],
  editor: [
    '[data-guide="wave"]',
    '[data-guide="playhead"]',
    '[data-guide="mode"]',
  ],
  live: ['[data-guide="live"]'],
};
export function CoachMarks({
  page,
  disabled,
}: {
  page: GuidePage;
  disabled: boolean;
}) {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect>();
  const dialog = useRef<HTMLDialogElement>(null);
  const help = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (disabled || guideSeen(page)) return;
    const check = () => {
      if (document.querySelector(targets[page][0])) {
        setStep(0);
        return true;
      }
      return false;
    };
    if (check()) return;
    const observer = new MutationObserver(() => {
      if (check()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [page, disabled]);
  useEffect(() => {
    if (disabled) setStep(null);
  }, [disabled]);
  useEffect(() => {
    const d = dialog.current;
    if (step === null || disabled) {
      d?.close();
      return;
    }
    const target = document.querySelector<HTMLElement>(targets[page][step]);
    if (!target) {
      setStep(null);
      return;
    }
    target.scrollIntoView({ block: "center", behavior: "instant" });
    const update = () => setRect(target.getBoundingClientRect());
    update();
    d?.showModal();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step, page, disabled]);
  useEffect(() => () => dialog.current?.close(), []);
  function close() {
    completeGuide(page);
    dialog.current?.close();
    setStep(null);
    help.current?.focus({ preventScroll: true });
  }
  const total = targets[page].length;
  const top = rect
    ? rect.bottom + 230 < window.innerHeight
      ? Math.max(12, rect.bottom + 14)
      : Math.max(12, rect.top - 216)
    : 16;
  return (
    <>
      <button
        ref={help}
        className="guide-help"
        aria-label={guideCopy.help}
        title={guideCopy.help}
        disabled={disabled}
        onClick={(event) => { iconFeedback(event.currentTarget); setStep(0); }}
      >
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none"/></svg>
      </button>
      <dialog
        ref={dialog}
        className="coach-dialog"
        aria-labelledby="coach-title"
        aria-describedby="coach-description"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        {step !== null && (
          <>
            {rect && (
              <div
                className="coach-ring"
                aria-hidden="true"
                style={{
                  top: rect.top - 4,
                  left: Math.max(4, rect.left - 4),
                  width: Math.min(rect.width + 8, window.innerWidth - 8),
                  height: rect.height + 8,
                }}
              />
            )}
            <div className="coach-card" style={{ top }} key={`${page}-${step}`}>
              <div className="coach-heading">
                <h2 id="coach-title">{guideCopy.title}</h2>
                <span>{guideCopy.step(step, total)}</span>
              </div>
              <p id="coach-description" aria-live="polite">
                {guideCopy[page][step]}
              </p>
              <div className="coach-actions">
                <button className="text-button" onClick={close}>
                  {guideCopy.skip}
                </button>
                <button
                  autoFocus
                  className="primary"
                  onClick={() =>
                    step + 1 === total ? close() : setStep(step + 1)
                  }
                >
                  {step + 1 === total ? guideCopy.done : guideCopy.next}
                </button>
              </div>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
