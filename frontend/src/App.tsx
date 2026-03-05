import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
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
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6fb]">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

function ManagerOnly() {
  const { user } = useAuthStore();
  if (user?.role !== 'Manager') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
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
            <Route element={<ManagerOnly />}>
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
