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
      className="flex items-center justify-between h-[60px] px-6 border-b border-[rgba(0,0,0,0.05)] flex-shrink-0 glass"
      style={{ position: 'sticky', top: 0, zIndex: 20 }}
    >
      {/* Left — Page title */}
      <div>
        <h1 className="text-[15px] font-semibold text-[#0F172A] leading-none tracking-tight headline">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] text-[#94A3B8] mt-[3px] font-normal">{subtitle}</p>
        )}
      </div>

      {/* Right — Controls */}
      <div className="flex items-center gap-2">
        {/* Demo user switcher */}
        <select
          className="h-8 bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] rounded-[8px] px-2.5 text-[12px] text-[#475569] cursor-pointer focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.12)] transition-all"
          value={user?.id}
          onChange={e => switchUser(e.target.value)}
        >
          {MOCK_BDS.map(bd => (
            <option key={bd.id} value={bd.id}>{bd.firstName} ({bd.role})</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
          <input
            placeholder="Search…"
            className="h-8 w-44 bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] rounded-[8px] pl-8 pr-3 text-[12px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.12)] transition-all"
          />
        </div>

        <NotificationBell />

        {/* Primary action */}
        {action && (
          action.to ? (
            <Link to={action.to}>
              <button
                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[8px] text-[12px] font-medium text-white transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #007AFF 0%, #0055D4 100%)', boxShadow: '0 1px 3px rgba(0,122,255,0.30)' }}
              >
                <Plus size={13} strokeWidth={2.5} />
                {action.label}
              </button>
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[8px] text-[12px] font-medium text-white transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #007AFF 0%, #0055D4 100%)', boxShadow: '0 1px 3px rgba(0,122,255,0.30)' }}
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
