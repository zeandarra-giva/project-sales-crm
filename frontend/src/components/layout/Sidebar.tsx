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
      className="soft-sidebar relative flex h-full flex-shrink-0 flex-col"
      style={{
        width: '268px',
        minWidth: '268px',
      }}
    >
      {/* ── Logo / Brand ────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center px-5 pb-2 pt-4">
        <div className="flex w-full items-center gap-4 rounded-[20px] border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] border border-[rgba(255,255,255,0.22)]"
          style={{ background: 'linear-gradient(135deg, rgba(0,122,255,0.98) 0%, rgba(59,171,255,0.88) 100%)', boxShadow: '0 12px 24px rgba(0,122,255,0.22), inset 0 1px 0 rgba(255,255,255,0.28)' }}
        >
          <span className="text-[12px] font-semibold text-white">S</span>
        </div>
        <div className="min-w-0 flex-1 self-center text-left">
          <div className="text-[14px] font-semibold leading-tight tracking-tight text-white">SalesCRM</div>
          <div className="mt-1 text-[10px] leading-none tracking-[0.08em] text-[rgba(255,255,255,0.46)] whitespace-nowrap">Revenue workspace</div>
        </div>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────── */}
      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-3">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              'soft-nav-link group flex h-11 items-center gap-3 rounded-[14px] px-3.5 transition-all duration-150',
              isActive
                ? 'text-[#DBEAFE] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_14px_30px_rgba(15,23,42,0.16)]'
                : 'text-[rgba(255,255,255,0.64)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white'
            )}
            style={({ isActive }) => isActive ? {
              background: 'linear-gradient(180deg, rgba(0,122,255,0.24) 0%, rgba(59,171,255,0.16) 100%)',
              border: '1px solid rgba(147,197,253,0.22)',
            } : undefined}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={16}
                  className={cn(
                    'flex-shrink-0 transition-colors',
                    isActive
                      ? 'text-[#BFDBFE]'
                      : 'text-[rgba(255,255,255,0.56)] group-hover:text-white'
                  )}
                  strokeWidth={isActive ? 2.15 : 1.85}
                />
                <span className={cn(
                  'text-[13px] font-medium',
                  isActive ? 'text-[#DBEAFE]' : ''
                )}>{item.label}</span>
                {isActive && (
                  <span className="ml-auto h-2.5 w-2.5 rounded-full bg-[#93C5FD] shadow-[0_0_14px_rgba(147,197,253,0.8)]" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Notifications — separate so the badge can show the real unread count */}
        <NavLink
          to="/notifications"
          className={({ isActive }) => cn(
            'soft-nav-link group relative flex h-11 items-center gap-3 rounded-[14px] px-3.5 transition-all duration-150',
            isActive
              ? 'text-[#DBEAFE] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_14px_30px_rgba(15,23,42,0.16)]'
              : 'text-[rgba(255,255,255,0.64)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white'
          )}
          style={({ isActive }) => isActive ? {
            background: 'linear-gradient(180deg, rgba(0,122,255,0.24) 0%, rgba(59,171,255,0.16) 100%)',
            border: '1px solid rgba(147,197,253,0.22)',
          } : undefined}
        >
          {({ isActive }) => (
            <>
              <Bell
                size={16}
                className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive
                    ? 'text-[#BFDBFE]'
                    : 'text-[rgba(255,255,255,0.56)] group-hover:text-white'
                )}
                strokeWidth={isActive ? 2.15 : 1.85}
              />
              <span className={cn('text-[13px] font-medium', isActive ? 'text-[#DBEAFE]' : '')}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="ml-auto flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#F43F5E] px-1.5 text-[10px] font-semibold text-white shadow-[0_10px_22px_rgba(244,63,94,0.28)]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {!unreadCount && isActive && (
                <span className="ml-auto h-2.5 w-2.5 rounded-full bg-[#93C5FD] shadow-[0_0_14px_rgba(147,197,253,0.8)]" />
              )}
            </>
          )}
        </NavLink>
      </nav>

      {/* ── User footer ─────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-4">
        <div className="rounded-[18px] border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[rgba(255,255,255,0.42)]">
            Active Workspace
          </div>
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
            className="rounded-[12px] p-2 text-[rgba(255,255,255,0.46)] transition-colors hover:bg-[rgba(244,63,94,0.14)] hover:text-[#F43F5E]"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
        </div>
      </div>
    </aside>
  );
}
