import { T } from "../app/Locale";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
export function Dialog({ title, children, onClose, side = false, className = "", }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    side?: boolean;
    className?: string;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const oldOverflow = document.body.style.overflow;
        ref.current?.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = oldOverflow;
            previous?.focus();
        };
    }, []);
    return createPortal(<dialog className={`shop-dialog ${side ? "side-dialog" : ""} ${className}`} ref={ref} aria-labelledby={titleId} onCancel={(event) => {
            event.preventDefault();
            onClose();
        }} onClick={(event) => {
            if (event.target === event.currentTarget)
                onClose();
        }}>
      <div className="dialog-inner">
        <div className="dialog-heading">
          <h2 id={titleId}><T>{title}</T></h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X />
          </button>
        </div>
        <T>{children}</T>
      </div>
    </dialog>, document.body);
}
