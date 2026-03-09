import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Users, UserCheck, Bell, BarChart3,
  LogOut, ChevronLeft, ChevronRight, Briefcase, CreditCard,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { Avatar } from '../ui/index';
import { MOCK_NOTIFICATIONS } from '../../mockData';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/executive', icon: TrendingUp, label: 'Executive View', roles: ['SALES_MANAGER'] },
  { to: '/pipeline', icon: Briefcase, label: 'Pipeline', roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/clients', icon: Users, label: 'Clients', roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/contacts', icon: UserCheck, label: 'Contacts', roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/reports', icon: BarChart3, label: 'Reports', roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/payments', icon: CreditCard, label: 'Payments', roles: ['BD_REP', 'SALES_MANAGER'] },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();
  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.is_read).length;

  const visibleItems = NAV_ITEMS.filter(item =>
    user?.role ? item.roles.includes(user.role) : false
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen bg-white border-r border-[#e2e6f0] transition-all duration-300 flex-shrink-0',
        sidebarOpen ? 'w-56' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-[#e2e6f0]', !sidebarOpen && 'justify-center px-0')}>
        <div className="w-8 h-8 rounded-xl bg-[#3d5af1] flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-white font-bold font-display text-sm">S</span>
        </div>
        {sidebarOpen && (
          <div>
            <div className="font-bold text-sm font-display text-[#1a1d2e] leading-none">SalesCRM</div>
            <div className="text-[10px] text-[#8b90a8] mt-0.5">BD Team</div>
          </div>
        )}
      </div>

      {/* Toggle btn */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-[#e2e6f0] rounded-full flex items-center justify-center text-[#8b90a8] hover:text-[#1a1d2e] transition-colors z-10 shadow-sm"
      >
        {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>

      {/* Nav */}
      <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 h-9 rounded-xl transition-all duration-150 group',
              sidebarOpen ? 'px-3' : 'justify-center px-0',
              isActive
                ? 'bg-[#eef1fe] text-[#3d5af1] border border-[#c7d0fb]'
                : 'text-[#6b7280] hover:text-[#1a1d2e] hover:bg-[#f4f6fb]'
            )}
          >
            <item.icon size={16} className="flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}

        {/* Notifications */}
        <NavLink
          to="/notifications"
          className={({ isActive }) => cn(
            'flex items-center gap-3 h-9 rounded-xl transition-all duration-150 relative',
            sidebarOpen ? 'px-3' : 'justify-center px-0',
            isActive
              ? 'bg-[#eef1fe] text-[#3d5af1] border border-[#c7d0fb]'
              : 'text-[#6b7280] hover:text-[#1a1d2e] hover:bg-[#f4f6fb]'
          )}
        >
          <Bell size={16} className="flex-shrink-0" />
          {sidebarOpen && <span className="text-sm font-medium">Notifications</span>}
          {unreadCount > 0 && (
            <span className={cn(
              'absolute bg-[#e11d48] text-white text-[10px] font-bold rounded-full flex items-center justify-center',
              sidebarOpen ? 'right-2 w-4 h-4' : '-top-1 -right-1 w-4 h-4'
            )}>
              {unreadCount}
            </span>
          )}
        </NavLink>
      </nav>

      {/* User section */}
      <div className={cn('border-t border-[#e2e6f0] p-3', !sidebarOpen && 'flex justify-center')}>
        {sidebarOpen ? (
          <div className="flex items-center gap-3">
            <Avatar name={`${user?.firstName} ${user?.lastName}`} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[#1a1d2e] truncate">{user?.firstName} {user?.lastName}</div>
              <div className="text-[10px] text-[#8b90a8] truncate">{user?.role}</div>
            </div>
            <button onClick={handleLogout} className="text-[#8b90a8] hover:text-[#e11d48] transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button onClick={handleLogout} className="text-[#8b90a8] hover:text-[#e11d48] transition-colors p-1">
            <LogOut size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}
