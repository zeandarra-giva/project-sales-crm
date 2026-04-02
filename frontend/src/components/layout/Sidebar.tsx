import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Users, UserCheck, Bell, BarChart3,
  LogOut, Briefcase, CreditCard, Package,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useNotifications } from '../../hooks/useNotifications';

const NAV_ITEMS = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',         roles: ['BD_REP'] },
  { to: '/executive',  icon: TrendingUp,      label: 'Executive View',    roles: ['SALES_MANAGER'] },
  { to: '/pipeline',   icon: Briefcase,       label: 'Pipeline',          roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/clients',    icon: Users,           label: 'Clients',           roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/contacts',   icon: UserCheck,       label: 'Contacts',          roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/services',   icon: Package,         label: 'Services & Bundles',roles: ['SALES_MANAGER'] },
  { to: '/reports',    icon: BarChart3,       label: 'Reports',           roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/payments',   icon: CreditCard,      label: 'Payments',          roles: ['BD_REP', 'SALES_MANAGER'] },
];

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] text-[10px] font-semibold text-white">
      <span>{initials}</span>
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  const visibleItems = NAV_ITEMS.filter(item =>
    user?.role ? item.roles.includes(user.role) : false
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className="relative flex h-screen flex-shrink-0 flex-col border-r border-[rgba(255,255,255,0.08)]"
      style={{
        width: '250px',
        minWidth: '250px',
        background: 'linear-gradient(180deg, #0F172A 0%, #132238 48%, #1A2E4A 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      {/* ── Logo / Brand ────────────────────────────────── */}
      <div className="flex h-[68px] flex-shrink-0 items-center gap-3 px-5">
        <div
          className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[8px]"
          style={{ background: 'linear-gradient(135deg, #007AFF 0%, #3BABFF 100%)', boxShadow: '0 8px 18px rgba(0,122,255,0.18)' }}
        >
          <span className="text-white font-semibold text-[11px]">S</span>
        </div>
        <div>
          <div className="text-[13px] font-semibold leading-none tracking-tight text-white">SalesCRM</div>
          <div className="mt-[2px] text-[10px] text-[rgba(255,255,255,0.48)]">BD Team</div>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────── */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              'group flex h-10 items-center gap-3 rounded-[8px] px-3 transition-all duration-150',
              isActive
                ? 'bg-[rgba(0,122,255,0.18)] text-[#93C5FD]'
                : 'text-[rgba(255,255,255,0.64)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white'
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={15}
                  className={cn(
                    'flex-shrink-0 transition-colors',
                    isActive
                      ? 'text-[#93C5FD]'
                      : 'text-[rgba(255,255,255,0.56)] group-hover:text-white'
                  )}
                  strokeWidth={isActive ? 2.15 : 1.85}
                />
                <span className={cn(
                  'text-[13px] font-medium',
                  isActive ? 'text-[#93C5FD]' : ''
                )}>{item.label}</span>
                {isActive && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-[#007AFF]" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Notifications — separate so the badge can show the real unread count */}
        <NavLink
          to="/notifications"
          className={({ isActive }) => cn(
            'group relative flex h-10 items-center gap-3 rounded-[8px] px-3 transition-all duration-150',
            isActive
              ? 'bg-[rgba(0,122,255,0.18)] text-[#93C5FD]'
              : 'text-[rgba(255,255,255,0.64)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white'
          )}
        >
          {({ isActive }) => (
            <>
              <Bell
                size={15}
                className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive
                    ? 'text-[#93C5FD]'
                    : 'text-[rgba(255,255,255,0.56)] group-hover:text-white'
                )}
                strokeWidth={isActive ? 2.15 : 1.85}
              />
              <span className={cn('text-[13px] font-medium', isActive ? 'text-[#93C5FD]' : '')}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-[#F43F5E] text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {!unreadCount && isActive && (
                <span className="ml-auto h-2 w-2 rounded-full bg-[#007AFF]" />
              )}
            </>
          )}
        </NavLink>
      </nav>

      {/* ── User footer ─────────────────────────────────── */}
      <div className="px-4 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Avatar name={`${user?.firstName} ${user?.lastName}`} />
          <div className="flex-1 min-w-0">
            <div className="truncate text-[12px] font-semibold leading-none text-white">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="mt-[2px] truncate text-[10px] text-[rgba(255,255,255,0.48)]">
              {user?.role?.replace('_', ' ')}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-[8px] p-1.5 text-[rgba(255,255,255,0.46)] transition-colors hover:bg-[rgba(244,63,94,0.14)] hover:text-[#F43F5E]"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
