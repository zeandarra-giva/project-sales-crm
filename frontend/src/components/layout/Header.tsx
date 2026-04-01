import { Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import NotificationBell from '../notifications/NotificationBell';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; to?: string; onClick?: () => void };
}

export default function Header({ title, subtitle, action }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header
      className="glass flex h-[82px] flex-shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.45)] px-7"
      style={{ position: 'sticky', top: 0, zIndex: 20, boxShadow: 'inset 0 -1px 0 rgba(226,232,240,0.65)' }}
    >
      {/* Left — Page title */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#94A3B8]">
          Workspace
        </div>
        <h1 className="headline text-[20px] font-semibold leading-none text-[#0F172A]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-[6px] text-[12px] font-normal text-[#64748B]">{subtitle}</p>
        )}
      </div>

      {/* Right — Controls */}
      <div className="flex items-center gap-3">
        {user && (
          <div className="soft-pill inline-flex h-10 items-center px-3.5 text-[12px] font-medium text-[#475569]">
            {user.firstName} {user.lastName} · {user.role === 'SALES_MANAGER' ? 'Manager' : 'BD'}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            placeholder="Search…"
            className="soft-input h-10 w-56 rounded-full pl-10 pr-4 text-[12px] text-[#0F172A] placeholder-[#94A3B8]"
          />
        </div>

        <NotificationBell />

        {/* Primary action */}
        {action && (
          action.to ? (
            <Link to={action.to}>
              <button
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[12px] font-medium text-white shadow-[0_16px_32px_rgba(0,122,255,0.24)] transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #007AFF 0%, #005FE0 100%)' }}
              >
                <Plus size={13} strokeWidth={2.5} />
                {action.label}
              </button>
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[12px] font-medium text-white shadow-[0_16px_32px_rgba(0,122,255,0.24)] transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #007AFF 0%, #005FE0 100%)' }}
            >
              <Plus size={13} strokeWidth={2.5} />
              {action.label}
            </button>
          )
        )}
      </div>
    </header>
  );
}
