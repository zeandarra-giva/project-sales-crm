import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button, Input } from '../components/ui/index';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

const DEMO_USERS = [
  { email: 'henne@company.com', label: 'Henne (Senior BD Rep)', password: 'changeme123' },
  { email: 'isten@company.com', label: 'Isten (BD Rep)', password: 'changeme123' },
  { email: 'brian@company.com', label: 'Brian (BD Rep)', password: 'changeme123' },
  { email: 'manager@company.com', label: 'Manager', password: 'changeme123' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('henne@company.com');
  const [password, setPassword] = useState('changeme123');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const success = await login(email, password);
    if (success) {
      navigate('/dashboard');
    } else {
      setError('Invalid credentials. Use a demo account below.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#faf9fe] text-[#2f323a] antialiased">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-8%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_rgba(0,122,255,0.18)_0%,_rgba(0,122,255,0.03)_52%,_transparent_72%)]" />
        <div className="absolute bottom-[-18%] right-[-8%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,_rgba(191,219,254,0.45)_0%,_rgba(255,255,255,0)_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(243,243,250,0.84)_100%)]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center p-5 sm:p-8 lg:p-10">
        <div className="grid w-full max-w-[1320px] overflow-hidden rounded-[28px] bg-[rgba(255,255,255,0.74)] shadow-[0_30px_80px_rgba(47,50,58,0.08)] backdrop-blur-[20px] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative flex min-h-[420px] items-center bg-[linear-gradient(180deg,rgba(255,255,255,0.76)_0%,rgba(243,243,250,0.92)_100%)] p-8 sm:p-10 lg:p-14">
            <div className="max-w-[580px]">
              <h1 className="max-w-[12ch] text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-[#2f323a] sm:text-5xl lg:text-6xl">
                Welcome to a calmer way to run your pipeline.
              </h1>
              <p className="mt-5 max-w-[48ch] text-base leading-7 text-[#5c5f68] sm:text-lg">
                Keep every relationship, next step, and revenue signal in one focused workspace designed for fast daily decision-making.
              </p>
            </div>
          </section>

          <section className="flex items-center justify-center bg-[rgba(255,255,255,0.58)] p-8 sm:p-10 lg:p-14">
            <div className="w-full max-w-md">
              <div className="mb-8">
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#2f323a]">Welcome back</h2>
                <p className="mt-2 text-sm leading-6 text-[#5c5f68]">
                  Sign in to continue to your dashboard, pipeline, and team workspace.
                </p>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <Input
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-[#5c5f68]">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="h-11 w-full rounded-xl border border-[rgba(176,177,187,0.2)] bg-[rgba(255,255,255,0.95)] px-3 pr-10 text-sm text-[#2f323a] placeholder-[#8b90a8] outline-none transition-all focus:border-[#007aff] focus:ring-4 focus:ring-[rgba(0,122,255,0.14)]"
                      placeholder="Password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] transition-colors hover:text-[#2f323a]"
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl bg-[#fff1f2] px-3 py-2 text-xs text-[#e11d48]">
                    {error}
                  </p>
                )}

                <Button type="submit" loading={loading} className="mt-2 h-11">
                  Sign in
                  <ArrowRight size={14} />
                </Button>
              </form>

              <div className="mt-8">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[rgba(176,177,187,0.24)]" />
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#5c5f68]">Demo accounts</span>
                  <div className="h-px flex-1 bg-[rgba(176,177,187,0.24)]" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DEMO_USERS.map(user => (
                    <button
                      key={user.email}
                      onClick={() => { setEmail(user.email); setPassword(user.password); }}
                      className="rounded-2xl bg-[rgba(243,243,250,0.88)] p-3 text-left transition-all hover:bg-[rgba(231,231,240,0.96)]"
                    >
                      <div className="text-xs font-semibold text-[#2f323a]">{user.label}</div>
                      <div className="mt-1 truncate text-[11px] text-[#5c5f68]">{user.email}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
