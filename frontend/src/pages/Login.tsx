import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button, Input } from '../components/ui/index';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

const DEMO_USERS = [
  { email: 'henne@company.com', label: 'Henne (Senior BD Rep)', password: 'demo' },
  { email: 'isten@company.com', label: 'Isten (BD Rep)', password: 'demo' },
  { email: 'brian@company.com', label: 'Brian (BD Rep)', password: 'demo' },
  { email: 'maria@company.com', label: 'Maria (Manager)', password: 'demo' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('henne@company.com');
  const [password, setPassword] = useState('demo');
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
    <div className="min-h-screen bg-[#f4f6fb] flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] bg-[#f0f2f8] border-r border-[#e2e6f0] p-12 flex-shrink-0">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-[#3d5af1] flex items-center justify-center mb-8">
            <span className="text-white font-bold font-display text-xl">S</span>
          </div>
          <h1 className="font-bold text-4xl font-display text-[#1a1d2e] leading-tight mb-4">
            Sales CRM
          </h1>
          <p className="text-[#4a5068] text-base leading-relaxed">
            Pipeline visibility, win/loss intelligence, and automated alerts — everything your BD team needs to hit quota.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { stat: '₱22.6M', label: 'Annual team quota' },
            { stat: '7 stages', label: 'Pipeline tracking' },
            { stat: '6 alerts', label: 'Automated notifications' },
          ].map(item => (
            <div key={item.stat} className="flex items-center gap-4 p-4 bg-white border border-[#e2e6f0] rounded-xl">
              <div className="text-2xl font-bold font-display text-accent-gradient">{item.stat}</div>
              <div className="text-sm text-[#4a5068]">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold font-display text-[#1a1d2e] mb-1">Welcome back</h2>
            <p className="text-sm text-[#4a5068]">Sign in to your account to continue</p>
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
              <label className="text-xs font-medium text-[#4a5068] uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-9 bg-white border border-[#e2e6f0] rounded-[10px] px-3 pr-10 text-sm text-[#1a1d2e] placeholder-[#8b90a8] focus:outline-none focus:border-[#3d5af1] focus:ring-2 focus:ring-[#4f6ef720] transition-all"
                  placeholder="Password"
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5068] hover:text-[#4a5068]">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-[#e11d48] bg-[#fff1f2] border border-[#fecdd3] rounded-lg px-3 py-2">{error}</p>}

            <Button type="submit" loading={loading} className="mt-1">
              Sign in
              <ArrowRight size={14} />
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#ffffff0a]" />
              <span className="text-xs text-[#4a5068]">Demo accounts</span>
              <div className="h-px flex-1 bg-[#ffffff0a]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_USERS.map(user => (
                <button
                  key={user.email}
                  onClick={() => { setEmail(user.email); setPassword(user.password); }}
                  className="text-left p-2.5 bg-white border border-[#e2e6f0] rounded-xl hover:border-[#a5b4fc] transition-all"
                >
                  <div className="text-xs font-medium text-[#4a5068]">{user.label}</div>
                  <div className="text-[10px] text-[#4a5068] truncate mt-0.5">{user.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
