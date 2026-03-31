import { cn } from '../../lib/utils';
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

// ─── Button ──────────────────────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading,
  className,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium rounded-[8px] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none active:scale-[0.98]';

  const variants = {
    primary:
      'text-white border-transparent',
    secondary:
      'bg-white border border-[rgba(0,0,0,0.08)] text-[#0F172A] hover:bg-[#F8FAFC] shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
    ghost:
      'bg-transparent border border-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-[rgba(0,0,0,0.04)]',
    danger:
      'bg-[rgba(244,63,94,0.06)] border border-[rgba(244,63,94,0.18)] text-[#E11D48] hover:bg-[rgba(244,63,94,0.10)]',
    success:
      'bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.18)] text-[#059669] hover:bg-[rgba(16,185,129,0.10)]',
  };

  const sizes = {
    sm: 'h-7 px-3 text-[12px]',
    md: 'h-8 px-4 text-[13px]',
    lg: 'h-10 px-5 text-[14px]',
  };

  const primaryStyle =
    variant === 'primary'
      ? {
          background: 'linear-gradient(135deg, #007AFF 0%, #0055D4 100%)',
          boxShadow: '0 1px 3px rgba(0,122,255,0.28)',
          ...style,
        }
      : style;

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      style={primaryStyle}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'blue' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({ children, variant = 'default', size = 'md', className, style }: BadgeProps) {
  const base = 'inline-flex items-center gap-1 rounded-full font-medium border';
  const variants = {
    default:  'bg-[#F1F5F9] border-[rgba(0,0,0,0.05)] text-[#64748B]',
    neutral:  'bg-[#F1F5F9] border-[rgba(0,0,0,0.05)] text-[#64748B]',
    success:  'bg-[rgba(16,185,129,0.08)] border-[rgba(16,185,129,0.18)] text-[#059669]',
    warning:  'bg-[rgba(245,158,11,0.08)] border-[rgba(245,158,11,0.18)] text-[#D97706]',
    danger:   'bg-[rgba(244,63,94,0.08)] border-[rgba(244,63,94,0.18)] text-[#E11D48]',
    info:     'bg-[rgba(0,122,255,0.08)] border-[rgba(0,122,255,0.18)] text-[#007AFF]',
    blue:     'bg-[rgba(0,122,255,0.08)] border-[rgba(0,122,255,0.18)] text-[#007AFF]',
    purple:   'bg-[rgba(139,92,246,0.08)] border-[rgba(139,92,246,0.18)] text-[#7C3AED]',
  };
  const sizes = {
    sm: 'px-2 py-[2px] text-[10px]',
    md: 'px-2.5 py-[3px] text-[11px]',
  };
  return (
    <span className={cn(base, variants[variant], sizes[size], className)} style={style}>
      {children}
    </span>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">{icon}</span>
        )}
        <input
          className={cn(
            'w-full h-9 bg-white border border-[rgba(0,0,0,0.08)] rounded-[8px] px-3 text-[13px] text-[#0F172A] placeholder-[#94A3B8]',
            'focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.12)] transition-all',
            icon && 'pl-9',
            error && 'border-[#F43F5E] focus:border-[#F43F5E] focus:ring-[rgba(244,63,94,0.12)]',
            className
          )}
          {...props}
        />
      </div>
      {error && <span className="text-[11px] text-[#E11D48]">{error}</span>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        className={cn(
          'w-full h-9 bg-white border border-[rgba(0,0,0,0.08)] rounded-[8px] px-3 text-[13px] text-[#0F172A]',
          'focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.12)] transition-all',
          'appearance-none cursor-pointer',
          error && 'border-[#F43F5E]',
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className="text-[11px] text-[#E11D48]">{error}</span>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          'w-full bg-white border border-[rgba(0,0,0,0.08)] rounded-[8px] px-3 py-2.5 text-[13px] text-[#0F172A] placeholder-[#94A3B8]',
          'focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.12)] transition-all resize-none',
          error && 'border-[#F43F5E]',
          className
        )}
        {...props}
      />
      {error && <span className="text-[11px] text-[#E11D48]">{error}</span>}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-[rgba(0,0,0,0.05)] rounded-[8px] shadow-[0_1px_4px_rgba(15,23,42,0.06)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: string | ReactNode;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  accent?: string;
  icon?: ReactNode;
  className?: string;
  delay?: number;
}

export function MetricCard({
  label,
  value,
  sub,
  trend,
  trendValue,
  accent = '#007AFF',
  icon,
  className,
  delay = 0,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-[rgba(0,0,0,0.05)] rounded-[8px] shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5 flex flex-col gap-3 animate-fade-in',
        className
      )}
      style={{ animationDelay: `${delay}ms`, opacity: 0, animationFillMode: 'forwards' }}
    >
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider">{label}</span>
        {icon && (
          <div
            className="w-8 h-8 rounded-[8px] flex items-center justify-center"
            style={{ background: `${accent}12` }}
          >
            <span style={{ color: accent }}>{icon}</span>
          </div>
        )}
      </div>
      <div>
        <div className="text-[22px] font-semibold tracking-tight" style={{ color: accent }}>
          {value}
        </div>
        {sub && <div className="text-[11px] text-[#94A3B8] mt-1">{sub}</div>}
      </div>
      {trend && trendValue && (
        <div
          className={cn(
            'flex items-center gap-1 text-[11px] font-medium',
            trend === 'up' ? 'text-[#059669]' : trend === 'down' ? 'text-[#E11D48]' : 'text-[#64748B]'
          )}
        >
          <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '–'}</span>
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({
  value,
  max = 100,
  color = '#007AFF',
  className,
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={cn('h-1.5 bg-[rgba(0,0,0,0.05)] rounded-full overflow-hidden', className)}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#007AFF', '#059669', '#D97706', '#7C3AED', '#E11D48', '#0891B2'];

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const sizes = {
    xs: 'w-6 h-6 text-[9px]',
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-8 h-8 text-[11px]',
    lg: 'w-10 h-10 text-[13px]',
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold flex-shrink-0',
        sizes[size],
        className
      )}
      style={{
        background: `${color}12`,
        color,
        border: `1.5px solid ${color}25`,
      }}
    >
      {initials}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
      {icon && <div className="text-[#CBD5E1] text-4xl">{icon}</div>}
      <div className="text-[13px] font-medium text-[#94A3B8]">{title}</div>
      {description && <div className="text-[12px] text-[#94A3B8] max-w-xs">{description}</div>}
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-[rgba(0,0,0,0.05)]', className)} />;
}
