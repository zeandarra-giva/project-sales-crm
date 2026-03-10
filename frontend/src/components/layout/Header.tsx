import { Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/index';
import NotificationBell from '../notifications/NotificationBell';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; to?: string; onClick?: () => void };
}

export default function Header({ title, subtitle, action }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-[#e2e6f0] bg-white flex-shrink-0">
      <div>
        <h1 className="font-bold text-lg font-display text-[#1a1d2e] leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-[#8b90a8] mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b90a8]" />
          <input
            placeholder="Search..."
            className="h-8 w-48 bg-[#f4f6fb] border border-[#e2e6f0] rounded-lg pl-8 pr-3 text-xs text-[#1a1d2e] placeholder-[#8b90a8] focus:outline-none focus:border-[#3d5af1]"
          />
        </div>

        <NotificationBell />

        {action && (
          action.to ? (
            <Link to={action.to}>
              <Button size="sm"><Plus size={14} />{action.label}</Button>
            </Link>
          ) : (
            <Button size="sm" onClick={action.onClick}><Plus size={14} />{action.label}</Button>
          )
        )}
      </div>
    </header>
  );
}
