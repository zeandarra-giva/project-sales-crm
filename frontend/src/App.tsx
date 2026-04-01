import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuthGuard from './components/layout/AuthGuard';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/Login';
import BDDashboard from './pages/BDDashboard';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import PipelinePage from './pages/Pipeline';
import DealDetail from './pages/DealDetail';
import NewDealPage from './pages/NewDeal';
import ClientList from './pages/ClientList';
import ClientDetailPage from './pages/ClientDetail';
import NewClientPage from './pages/NewClient';
import ContactList from './pages/ContactList';
import NewContactPage from './pages/NewContact';
import NotificationsPage from './pages/Notifications';
import ReportsPage from './pages/Reports';
import PaymentsPage from './pages/Payments';
import ServicesPage from './pages/ServicesPage';
import { useAuthStore } from './store/authStore';

const queryClient = new QueryClient();

function ProtectedLayout() {
  return (
    <AuthGuard>
      <div className="relative flex h-screen w-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,122,255,0.07),transparent_24%),radial-gradient(circle_at_top_right,rgba(191,219,254,0.32),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(226,232,240,0.48),transparent_30%),linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_54%,#F2F7FB_100%)]" />
        <div className="soft-shell relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-none border-0 shadow-none">
          <Sidebar />
          <main className="relative flex min-w-0 flex-1 overflow-hidden flex-col">
            <Outlet />
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

function ManagerLayout() {
  return (
    <AuthGuard requiredRole="SALES_MANAGER">
      <Outlet />
    </AuthGuard>
  );
}

function HomeRedirect() {
  const { user } = useAuthStore();
  return <Navigate to={user?.role === 'SALES_MANAGER' ? '/executive' : '/dashboard'} replace />;
}

function BDDashboardRoute() {
  const { user } = useAuthStore();
  return user?.role === 'SALES_MANAGER' ? <Navigate to="/executive" replace /> : <BDDashboard />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/dashboard" element={<BDDashboardRoute />} />
            <Route element={<ManagerLayout />}>
              <Route path="/executive" element={<ExecutiveDashboard />} />
              <Route path="/services" element={<ServicesPage />} />
            </Route>
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/deals/new" element={<NewDealPage />} />
            <Route path="/deals/:id" element={<DealDetail />} />
            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/new" element={<NewClientPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/contacts" element={<ContactList />} />
            <Route path="/contacts/new" element={<NewContactPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
