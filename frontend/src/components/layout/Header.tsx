import { Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { MOCK_BDS } from '../../mockData';
import NotificationBell from '../notifications/NotificationBell';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; to?: string; onClick?: () => void };
}

export default function Header({ title, subtitle, action }: HeaderProps) {
  const { user, switchUser } = useAuthStore();

  return (
    <header
      className="glass flex h-[68px] flex-shrink-0 items-center justify-between border-b border-[rgba(0,0,0,0.05)] px-6"
      style={{ position: 'sticky', top: 0, zIndex: 20 }}
    >
      {/* Left — Page title */}
      <div>
        <h1 className="headline text-[16px] font-semibold leading-none text-[#0F172A]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-[4px] text-[11px] font-normal text-[#64748B]">{subtitle}</p>
        )}
      </div>

      {/* Right — Controls */}
      <div className="flex items-center gap-2.5">
        {/* Demo user switcher */}
        <select
          className="h-9 rounded-[8px] border border-[#E2E8F0] bg-[rgba(248,250,252,0.92)] px-3 text-[12px] text-[#475569] shadow-sm cursor-pointer focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.12)] transition-all"
          value={user?.id}
          onChange={e => switchUser(e.target.value)}
        >
          {MOCK_BDS.map(bd => (
            <option key={bd.id} value={bd.id}>{bd.firstName} ({bd.role})</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            placeholder="Search…"
            className="h-9 w-48 rounded-[8px] border border-[#E2E8F0] bg-[rgba(248,250,252,0.92)] pl-9 pr-3 text-[12px] text-[#0F172A] placeholder-[#94A3B8] shadow-sm focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.12)] transition-all"
          />
        </div>

        <NotificationBell />

        {/* Primary action */}
        {action && (
          action.to ? (
            <Link to={action.to}>
              <button
                className="inline-flex h-9 items-center gap-1.5 rounded-[8px] px-3.5 text-[12px] font-medium text-white shadow-md transition-all active:scale-[0.98]"
                style={{ background: '#007AFF' }}
              >
                <Plus size={13} strokeWidth={2.5} />
                {action.label}
              </button>
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] px-3.5 text-[12px] font-medium text-white shadow-md transition-all active:scale-[0.98]"
              style={{ background: '#007AFF' }}
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
