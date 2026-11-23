import { useEffect, useRef, type ReactNode } from 'react';
import { stopSpeaking } from '../hooks/tts';

/** Native <dialog> modal; entry/exit animated with @starting-style in CSS. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      stopSpeaking();
      d.showModal();
    }
    if (!open && d.open) {
      stopSpeaking();
      d.close();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? ' modal--wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal__inner">
        <header className="modal__head">
          <h2>{title}</h2>
          {dismissible && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="סגירה">
              ✕
            </button>
          )}
        </header>
        {open && children}
      </div>
    </dialog>
  );
}
