import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Users, UserCheck, Bell, BarChart3,
  LogOut, Briefcase, CreditCard,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { MOCK_NOTIFICATIONS } from '../../mockData';

const NAV_ITEMS = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',      roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/executive',  icon: TrendingUp,      label: 'Executive View', roles: ['SALES_MANAGER'] },
  { to: '/pipeline',   icon: Briefcase,       label: 'Pipeline',       roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/clients',    icon: Users,           label: 'Clients',        roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/contacts',   icon: UserCheck,       label: 'Contacts',       roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/reports',    icon: BarChart3,       label: 'Reports',        roles: ['BD_REP', 'SALES_MANAGER'] },
  { to: '/payments',   icon: CreditCard,      label: 'Payments',       roles: ['BD_REP', 'SALES_MANAGER'] },
];

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.12)',
        border: '1.5px solid rgba(255,255,255,0.18)',
      }}
    >
      <span className="text-[10px] font-semibold text-white">{initials}</span>
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
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
      className="relative flex flex-col h-screen flex-shrink-0 border-r border-[rgba(255,255,255,0.12)]"
      style={{
        width: '250px',
        minWidth: '250px',
        background: 'linear-gradient(160deg, #0A1628 0%, #0D1F3C 40%, #0F2952 75%, #0A1E45 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      {/* ── Logo / Brand ────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 h-[60px] border-b border-[rgba(255,255,255,0.07)] flex-shrink-0">
        <div
          className="w-[28px] h-[28px] rounded-[8px] flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #007AFF 0%, #3BABFF 100%)', boxShadow: '0 2px 8px rgba(0,122,255,0.40)' }}
        >
          <span className="text-white font-semibold text-[11px]">S</span>
        </div>
        <div>
          <div className="text-[13px] font-semibold text-white leading-none tracking-tight">SalesCRM</div>
          <div className="text-[10px] text-[rgba(255,255,255,0.40)] mt-[2px]">BD Team</div>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────── */}
      <nav className="flex-1 py-3 flex flex-col gap-[2px] px-3 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 h-9 px-3 rounded-[8px] transition-all duration-150 group',
              isActive
                ? 'bg-[rgba(255,255,255,0.12)] text-white'
                : 'text-[rgba(255,255,255,0.50)] hover:text-[rgba(255,255,255,0.85)] hover:bg-[rgba(255,255,255,0.06)]'
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={15}
                  className={cn(
                    'flex-shrink-0 transition-colors',
                    isActive
                      ? 'text-white'
                      : 'text-[rgba(255,255,255,0.45)] group-hover:text-[rgba(255,255,255,0.80)]'
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className={cn(
                  'text-[13px] font-medium',
                  isActive ? 'text-white' : ''
                )}>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1 h-4 rounded-full bg-[#007AFF]" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Notifications */}
        <NavLink
          to="/notifications"
          className={({ isActive }) => cn(
            'flex items-center gap-3 h-9 px-3 rounded-[8px] transition-all duration-150 relative group',
            isActive
              ? 'bg-[rgba(255,255,255,0.12)] text-white'
              : 'text-[rgba(255,255,255,0.50)] hover:text-[rgba(255,255,255,0.85)] hover:bg-[rgba(255,255,255,0.06)]'
          )}
        >
          {({ isActive }) => (
            <>
              <Bell
                size={15}
                className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-[rgba(255,255,255,0.45)] group-hover:text-[rgba(255,255,255,0.80)]'
                )}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span className={cn('text-[13px] font-medium', isActive ? 'text-white' : '')}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="ml-auto w-[18px] h-[18px] bg-[#F43F5E] text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
              {!unreadCount && isActive && (
                <span className="ml-auto w-1 h-4 rounded-full bg-[#007AFF]" />
              )}
            </>
          )}
        </NavLink>
      </nav>

      {/* ── User footer ─────────────────────────────────── */}
      <div className="border-t border-[rgba(255,255,255,0.07)] px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Avatar name={`${user?.firstName} ${user?.lastName}`} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-white truncate leading-none">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-[10px] text-[rgba(255,255,255,0.38)] mt-[2px] truncate">
              {user?.role?.replace('_', ' ')}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-[rgba(255,255,255,0.35)] hover:text-[#F43F5E] transition-colors p-1 rounded-[6px] hover:bg-[rgba(244,63,94,0.12)]"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
