import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Home, BookOpen, ChartNoAxesCombined, MessagesSquare, LayoutDashboard, LibraryBig, ClipboardList, Inbox, GraduationCap, type LucideIcon } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { AskAceProvider } from '@/components/AskAce';
import { ToastHost } from '@/components/overlays';
import { Shell, type NavItem } from '@/components/Shell';
import Login from '@/pages/Login';
import Dashboard from '@/pages/student/Dashboard';
import SessionsPage from '@/pages/student/SessionsPage';
import SessionPage from '@/pages/student/SessionPage';
import LessonPage from '@/pages/student/LessonPage';
import ExamPage from '@/pages/student/ExamPage';
import ResultsPage from '@/pages/student/ResultsPage';
import ProgressPage from '@/pages/student/ProgressPage';
import QuestionsPage from '@/pages/student/QuestionsPage';
import Overview from '@/pages/instructor/Overview';
import Curriculum from '@/pages/instructor/Curriculum';
import Exams from '@/pages/instructor/Exams';
import InboxPage from '@/pages/instructor/InboxPage';
import StudentRecord from '@/pages/instructor/StudentRecord';
import AttemptReview from '@/pages/instructor/AttemptReview';

const studentNav: NavItem[] = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/sessions', label: 'Sessions', icon: BookOpen },
  { to: '/app/progress', label: 'Progress', icon: ChartNoAxesCombined },
  { to: '/app/questions', label: 'Questions', icon: MessagesSquare },
];
const aceNav: NavItem[] = [
  { to: '/ace', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/ace/curriculum', label: 'Course', icon: LibraryBig },
  { to: '/ace/exams', label: 'Exams', icon: ClipboardList },
  { to: '/ace/inbox', label: 'Inbox', icon: Inbox },
  { to: '/ace/student', label: 'Daniella', icon: GraduationCap },
];

function Guard({ role }: { role: 'student' | 'instructor' }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="login-wrap"><div className="card soft">Opening your academy…</div></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== role) return <Navigate to={user.role === 'instructor' ? '/ace' : '/app'} replace />;
  return <Outlet />;
}

function StudentLayout() {
  return <Shell nav={studentNav} subtitle="Daniella · Student" student><Outlet /></Shell>;
}
function InstructorLayout() {
  return <Shell nav={aceNav} subtitle="ACECODES · Instructor"><Outlet /></Shell>;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.role === 'instructor' ? '/ace' : '/app'} replace />;
  return <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AskAceProvider>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route element={<Guard role="student" />}>
                <Route element={<StudentLayout />}>
                  <Route path="/app" element={<Dashboard />} />
                  <Route path="/app/sessions" element={<SessionsPage />} />
                  <Route path="/app/session/:sessionId" element={<SessionPage />} />
                  <Route path="/app/lesson/:lessonId" element={<LessonPage />} />
                  <Route path="/app/exam/:examId" element={<ExamPage />} />
                  <Route path="/app/exam/:examId/result/:attemptId" element={<ResultsPage />} />
                  <Route path="/app/progress" element={<ProgressPage />} />
                  <Route path="/app/questions" element={<QuestionsPage />} />
                </Route>
              </Route>
              <Route element={<Guard role="instructor" />}>
                <Route element={<InstructorLayout />}>
                  <Route path="/ace" element={<Overview />} />
                  <Route path="/ace/curriculum" element={<Curriculum />} />
                  <Route path="/ace/exams" element={<Exams />} />
                  <Route path="/ace/inbox" element={<InboxPage />} />
                  <Route path="/ace/student" element={<StudentRecord />} />
                  <Route path="/ace/attempt/:id" element={<AttemptReview />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            <ToastHost />
          </AskAceProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
