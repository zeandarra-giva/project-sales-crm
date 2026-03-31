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

const queryClient = new QueryClient();

function ProtectedLayout() {
  return (
    <AuthGuard>
      <div className="relative flex h-screen overflow-hidden bg-[#FFFFFF]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,122,255,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.32),transparent_28%),linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)]" />
        <Sidebar />
        <main className="relative flex min-w-0 flex-1 overflow-hidden flex-col">
          <Outlet />
        </main>
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<BDDashboard />} />
            <Route element={<ManagerLayout />}>
              <Route path="/executive" element={<ExecutiveDashboard />} />
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
