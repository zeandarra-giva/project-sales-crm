import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';

export default function NotificationBell() {
  const { user } = useAuthStore();
  const { notifications, unreadCount, markRead } = useNotifications(user?.id);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const recent = notifications.slice(0, 5);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'soft-icon-button relative flex h-10 w-10 items-center justify-center transition-all',
          open ? 'border-[rgba(0,122,255,0.18)] bg-[rgba(0,122,255,0.10)] text-[#007AFF]' : 'text-[#64748B] hover:border-[#D7E3F0] hover:text-[#0F172A]'
        )}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#e11d48] text-[9px] font-bold text-white shadow-[0_10px_20px_rgba(225,29,72,0.28)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 top-full z-40 mt-3 w-[22rem] overflow-hidden rounded-[20px] animate-fade-in">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#94A3B8]">Inbox</div>
              <span className="mt-1 block text-sm font-semibold font-display text-[#0F172A]">Notifications</span>
            </div>
            {unreadCount > 0 && (
              <span className="soft-pill px-2.5 py-1 text-[10px] font-medium text-[#007AFF]">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto px-2 pb-2">
            {recent.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#8b90a8]">All caught up!</div>
            ) : (
              recent.map(n => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    'mb-1.5 w-full rounded-[16px] px-4 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.84)]',
                    !n.is_read ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(239,246,255,0.72))] shadow-[0_10px_22px_rgba(15,23,42,0.05)]' : 'bg-[rgba(255,255,255,0.52)]'
                  )}
                >
                  {!n.is_read && (
                    <div className="float-right ml-2 mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#3d5af1]" />
                  )}
                  <p className="text-xs leading-relaxed text-[#1a1d2e]">{n.content}</p>
                  <p className="mt-1 text-[10px] text-[#8b90a8]">
                    {new Date(n.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-3">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-[#007AFF] hover:underline"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
