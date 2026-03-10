import { cn } from '../../lib/utils';
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

// Button
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', children, loading, className, disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border';
  const variants = {
    primary: 'bg-[#3d5af1] border-[#2d48d9] text-white hover:bg-[#2d48d9] active:scale-[0.98] shadow-sm',
    secondary: 'bg-white border-[#e2e6f0] text-[#1a1d2e] hover:bg-[#f4f6fb] active:scale-[0.98] shadow-sm',
    ghost: 'bg-transparent border-transparent text-[#6b7280] hover:text-[#1a1d2e] hover:bg-[#f0f2f8]',
    danger: 'bg-[#fff1f2] border-[#fecdd3] text-[#e11d48] hover:bg-[#ffe4e6]',
    success: 'bg-[#ecfdf5] border-[#a7f3d0] text-[#059669] hover:bg-[#d1fae5]',
  };
  const sizes = {
    sm: 'h-7 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
    lg: 'h-11 px-6 text-base',
  };

  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// Badge
interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({ children, variant = 'default', size = 'md', className, style }: BadgeProps) {
  const base = 'inline-flex items-center gap-1 rounded-full border font-medium';
  const variants = {
    default: 'bg-[#f0f2f8] border-[#e2e6f0] text-[#4a5068]',
    success: 'bg-[#ecfdf5] border-[#a7f3d0] text-[#059669]',
    warning: 'bg-[#fffbeb] border-[#fde68a] text-[#d97706]',
    danger: 'bg-[#fff1f2] border-[#fecdd3] text-[#e11d48]',
    info: 'bg-[#eef1fe] border-[#c7d0fb] text-[#3d5af1]',
    neutral: 'bg-[#f4f6fb] border-[#e2e6f0] text-[#6b7280]',
  };
  const sizes = { sm: 'px-2 py-0.5 text-xs', md: 'px-2.5 py-1 text-xs' };
  return <span className={cn(base, variants[variant], sizes[size], className)} style={style}>{children}</span>;
}

// Input
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[#4a5068] uppercase tracking-wider">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b90a8]">{icon}</span>}
        <input
          className={cn(
            'w-full h-9 bg-white border border-[#e2e6f0] rounded-[10px] px-3 text-sm text-[#1a1d2e] placeholder-[#8b90a8]',
            'focus:outline-none focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af120] transition-all shadow-sm',
            icon && 'pl-9',
            error && 'border-[#e11d48]',
            className
          )}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-[#e11d48]">{error}</span>}
    </div>
  );
}

// Select
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[#4a5068] uppercase tracking-wider">{label}</label>}
      <select
        className={cn(
          'w-full h-9 bg-white border border-[#e2e6f0] rounded-[10px] px-3 text-sm text-[#1a1d2e]',
          'focus:outline-none focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af120] transition-all shadow-sm',
          'appearance-none cursor-pointer',
          error && 'border-[#e11d48]',
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className="text-xs text-[#e11d48]">{error}</span>}
    </div>
  );
}

// Textarea
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[#4a5068] uppercase tracking-wider">{label}</label>}
      <textarea
        className={cn(
          'w-full bg-white border border-[#e2e6f0] rounded-[10px] px-3 py-2.5 text-sm text-[#1a1d2e] placeholder-[#8b90a8]',
          'focus:outline-none focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af120] transition-all resize-none shadow-sm',
          error && 'border-[#e11d48]',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-[#e11d48]">{error}</span>}
    </div>
  );
}

// Card
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('bg-white border border-[#e2e6f0] rounded-2xl shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

// Metric Card
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

export function MetricCard({ label, value, sub, trend, trendValue, accent = '#3d5af1', icon, className, delay = 0 }: MetricCardProps) {
  return (
    <div
      className={cn('bg-white border border-[#e2e6f0] rounded-2xl shadow-sm p-5 flex flex-col gap-3 animate-fade-in', className)}
      style={{ animationDelay: `${delay}ms`, opacity: 0, animationFillMode: 'forwards' }}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-[#6b7280] uppercase tracking-wider font-display">{label}</span>
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}15` }}>
            <span style={{ color: accent }}>{icon}</span>
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold font-display" style={{ color: accent }}>{value}</div>
        {sub && <div className="text-xs text-[#8b90a8] mt-1">{sub}</div>}
      </div>
      {trend && trendValue && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-medium',
          trend === 'up' ? 'text-[#059669]' : trend === 'down' ? 'text-[#e11d48]' : 'text-[#6b7280]'
        )}>
          <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '–'}</span>
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}

// Progress bar
export function ProgressBar({ value, max = 100, color = '#3d5af1', className }: { value: number; max?: number; color?: string; className?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={cn('h-1.5 bg-[#e2e6f0] rounded-full overflow-hidden', className)}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// Avatar
export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#3d5af1', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2'];
  const colorIndex = name.charCodeAt(0) % colors.length;
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' };

  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-bold font-display flex-shrink-0', sizes[size], className)}
      style={{ background: `${colors[colorIndex]}15`, color: colors[colorIndex], border: `1.5px solid ${colors[colorIndex]}30` }}
    >
      {initials}
    </div>
  );
}

// Empty state
export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {icon && <div className="text-4xl text-[#c8cfe8]">{icon}</div>}
      <div className="text-sm font-medium text-[#8b90a8]">{title}</div>
      {description && <div className="text-xs text-[#8b90a8] max-w-xs">{description}</div>}
    </div>
  );
}

// Divider
export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-[#e2e6f0]', className)} />;
}
