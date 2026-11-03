import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bouncy } from './Bouncy';
import { SPRING_SOFT } from '@/lib/motion';

let openSheets = 0;
let savedBodyOverflow = '';

export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const id = useRef(Symbol(title));
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const ownId = id.current;
    const otherOpened = (event: Event) => { if ((event as CustomEvent<symbol>).detail !== ownId) close.current(); };
    window.dispatchEvent(new CustomEvent('academy-sheet-opened', { detail: ownId }));
    window.addEventListener('academy-sheet-opened', otherOpened);
    const previousFocus = document.activeElement as HTMLElement | null;
    if (openSheets++ === 0) { savedBodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    const focusTimer = window.setTimeout(() => panel.current?.querySelector<HTMLElement>('button, input, textarea, select, [tabindex]:not([tabindex="-1"])')?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const nodes = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!nodes.length) { e.preventDefault(); return; }
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.current.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !panel.current.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(focusTimer); document.removeEventListener('keydown', onKey); window.removeEventListener('academy-sheet-opened', otherOpened); if (--openSheets === 0) { document.body.style.overflow = savedBodyOverflow; previousFocus?.focus({ preventScroll: true }); } };
  }, [open]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="sheet-layer">
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div ref={panel}
            className="sheet" role="dialog" aria-modal="true" aria-label={title}
            initial={{ y: reduced ? 0 : 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: reduced ? 0 : 16, opacity: 0 }}
            transition={SPRING_SOFT}
          >
            <div className="sheet-handle" />
            <div className="row-between" style={{ marginBottom: 14 }}>
              <h2 className="section-title" style={{ fontSize: '1.4rem' }}>{title}</h2>
              <button className="icon-btn small" onClick={onClose} aria-label="Close">✕</button>
            </div>
            {children}
            {footer && <div style={{ marginTop: 16 }}>{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>, document.body);
}

export function ConfirmSheet({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: {
  open: boolean; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}
      footer={<div className="btn-row"><Bouncy variant={danger ? 'danger' : 'primary'} block onClick={onConfirm}>{confirmLabel}</Bouncy><Bouncy block onClick={onCancel}>Cancel</Bouncy></div>}>
      <div className={danger ? 'warn-note' : 'comic-note'}>{body}</div>
    </Sheet>
  );
}

export interface ToastMessage { id: number; text: string; tone?: 'ok' | 'warn' }
let toastSeq = 0;
export const toast = { listeners: [] as Array<(t: ToastMessage) => void>,
  show(text: string, tone: 'ok' | 'warn' = 'ok') {
    toastSeq += 1;
    const msg = { id: toastSeq, text, tone };
    this.listeners.forEach(fn => fn(msg));
  },
};

export function ToastHost() {
  const [items, setItems] = useState<ToastMessage[]>([]);
  useEffect(() => {
    const fn = (t: ToastMessage) => {
      setItems(prev => [...prev.slice(-2), t]);
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== t.id)), 4200);
    };
    toast.listeners.push(fn);
    return () => { toast.listeners = toast.listeners.filter(x => x !== fn); };
  }, []);
  return createPortal(
    <AnimatePresence>
      {items.map(t => (
        <motion.div key={t.id} className="toast"
          initial={{ opacity: 0, y: 20, scale: .9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
          transition={SPRING_SOFT} role="status">
          {t.tone === 'warn' ? '⚠ ' : '✓ '}{t.text}
        </motion.div>
      ))}
    </AnimatePresence>, document.body);
}
