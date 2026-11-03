import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bouncy } from './Bouncy';
import { SPRING_SOFT } from '@/lib/motion';

export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="sheet" role="dialog" aria-modal="true" aria-label={title}
            initial={{ y: '100%', opacity: .6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: .6 }}
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
        </>
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
