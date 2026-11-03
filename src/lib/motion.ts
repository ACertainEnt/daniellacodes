import { useReducedMotion } from 'framer-motion';
import type { Transition, TargetAndTransition } from 'framer-motion';

export const SPRING: Transition = { type: 'spring', stiffness: 520, damping: 24, mass: 0.7 };
export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 240, damping: 26, mass: 0.9 };

/** Every interactive control shares one short, springy press. */
export function useBounce() {
  const reduced = useReducedMotion();
  if (reduced) return { whileHover: {} as TargetAndTransition, whileTap: {} as TargetAndTransition, transition: { duration: 0 } as Transition };
  return {
    whileHover: { scale: 1.035, y: -1 } as TargetAndTransition,
    whileTap: { scale: 0.94, y: 2 } as TargetAndTransition,
    transition: SPRING,
  };
}

export function useSheetMotion() {
  const reduced = useReducedMotion();
  if (reduced) return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.01 } };
  return {
    initial: { y: '100%', opacity: 0, scale: .97 },
    animate: { y: 0, opacity: 1, scale: 1 },
    exit: { y: '100%', opacity: 0, scale: .97 },
    transition: SPRING_SOFT,
  };
}
