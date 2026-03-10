import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';

export default function NotificationBell() {
  const { user } = useAuthStore();
  const { notifications, unreadCount, markRead } = useNotifications();
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
          'relative w-8 h-8 flex items-center justify-center rounded-xl transition-all',
          open ? 'bg-[#eef1fe] text-[#3d5af1]' : 'text-[#8b90a8] hover:text-[#1a1d2e] hover:bg-[#f4f6fb]'
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
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#e2e6f0] rounded-2xl shadow-lg z-40 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f2f8]">
            <span className="text-xs font-semibold font-display text-[#1a1d2e]">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] bg-[#eef1fe] text-[#3d5af1] px-2 py-0.5 rounded-full border border-[#c7d0fb]">
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
                    'w-full text-left px-4 py-3 border-b border-[#f4f6fb] hover:bg-[#f4f6fb] transition-colors',
                    !n.is_read && 'bg-[#fafbff]'
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

          <div className="px-4 py-2.5 border-t border-[#f0f2f8]">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-[#3d5af1] hover:underline font-medium"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
