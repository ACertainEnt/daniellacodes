import { motion, useReducedMotion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { SPRING } from '@/lib/motion';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  block?: boolean;
  children: ReactNode;
};

/** A real button with a tactile spring press on touch and mouse. */
export function Bouncy({ variant = 'outline', size = 'md', block, className = '', children, ...rest }: Props) {
  const reduced = useReducedMotion();
  const cls = ['btn', variant, size === 'sm' ? 'sm' : '', block ? 'block' : '', className].filter(Boolean).join(' ');
  return (
    <motion.button
      className={cls}
      whileHover={reduced ? undefined : { scale: 1.035, y: -1 }}
      whileTap={reduced ? undefined : { scale: 0.94, y: 2 }}
      transition={SPRING}
      {...(rest as any)}
    >{children}</motion.button>
  );
}

export function BouncyLink({ className = '', children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reduced ? undefined : { scale: 1.02, y: -2 }}
      whileTap={reduced ? undefined : { scale: 0.975, y: 1 }}
      transition={SPRING}
      onClick={onClick}
    >{children}</motion.div>
  );
}
