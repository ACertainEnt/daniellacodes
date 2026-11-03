import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, post } from './api';
import type { DashboardData } from '@shared/types';
import { toast } from '@/components/overlays';

/** Strict rule: if a student reaches lesson/session pages while an exam is
 *  active, warn them, invalidate only THAT attempt on confirmation, and keep
 *  all completed lessons and past history untouched. */
export function useExamLeavingGuard() {
  const [pending, setPending] = useState<DashboardData['activeAttempt'] | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    api<DashboardData>('/api/student/dashboard')
      .then(d => { if (d.activeAttempt) setPending(d.activeAttempt); })
      .catch(() => {});
  }, []);
  const confirm = async () => {
    if (!pending) return;
    try {
      await post(`/api/exams/attempt/${pending.id}/abandon`);
      toast.show('Exam attempt invalidated. Your lessons and history are safe.', 'warn');
      setPending(null);
    } catch (e: any) { toast.show(e.message, 'warn'); }
  };
  const cancel = () => { if (pending) navigate('/app/exam/' + pending.examId, { replace: true }); setPending(null); };
  return { pending, confirm, cancel };
}
