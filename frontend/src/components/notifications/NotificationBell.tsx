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
          'relative flex h-9 w-9 items-center justify-center rounded-[8px] border border-transparent transition-all',
          open ? 'border-[rgba(0,122,255,0.12)] bg-[rgba(0,122,255,0.08)] text-[#007AFF]' : 'text-[#64748B] hover:border-[#E2E8F0] hover:bg-white hover:text-[#0F172A]'
        )}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#e11d48] rounded-full text-[9px] text-white font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="glass absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-[12px] border border-[rgba(0,0,0,0.05)] shadow-md animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold font-display text-[#1a1d2e]">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full border border-[rgba(0,122,255,0.18)] bg-[rgba(0,122,255,0.08)] px-2 py-0.5 text-[10px] text-[#007AFF]">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#8b90a8]">All caught up!</div>
            ) : (
              recent.map(n => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    'w-full px-4 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.92)]',
                    !n.is_read && 'bg-[rgba(255,255,255,0.72)]'
                  )}
                >
                  {!n.is_read && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3d5af1] float-right mt-1.5 ml-2 flex-shrink-0" />
                  )}
                  <p className="text-xs text-[#1a1d2e] leading-relaxed">{n.content}</p>
                  <p className="text-[10px] text-[#8b90a8] mt-0.5">
                    {new Date(n.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-2.5">
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
