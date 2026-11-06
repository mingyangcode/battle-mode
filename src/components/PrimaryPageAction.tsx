import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

/** One viewport-anchored action slot shared by both main pages. */
export function PrimaryPageAction({ label, onClick, disabled = false, caption, guide }: {
  label: string; onClick: () => void; disabled?: boolean; caption?: ReactNode; guide: "add" | "live";
}) {
  return createPortal(<div className="primary-page-action" data-page-swipe-ignore>
    {caption && <p className="primary-page-caption">{caption}</p>}
    <button className="primary" data-guide={guide} disabled={disabled} onClick={onClick}>
      <Icon name="plus" size={22} /><span>{label}</span>
    </button>
  </div>, document.body);
}
