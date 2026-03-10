/**
 * Frontend/src/pages/citizen/Login.tsx
 *
 * FIX: Added 'ward' field to register form — backend requires it.
 * Also added 'age' and 'address' as optional fields for better profile.
 */

import { useState }                from 'react';
import { useNavigate, Link }        from 'react-router-dom';
import { useApp }                   from '@/context/AppContext';
import { Button }                   from '@/components/ui/button';
import { Input }                    from '@/components/ui/input';
import { Label }                    from '@/components/ui/label';
import { useToast }                 from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, MapPin } from 'lucide-react';
import { useTranslation }           from 'react-i18next';
import LanguageSwitcher             from '@/components/LanguageSwitcher';

export default function CitizenLogin() {
  const [tab,        setTab]        = useState<'login' | 'register'>('login');
  const [showPw,     setShowPw]     = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useApp();
  const navigate  = useNavigate();
  const { toast } = useToast();
  const { t }     = useTranslation();

  // ── Login fields ────────────────────────────────────────────
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // ── Register fields ─────────────────────────────────────────
  const [rName,    setRName]    = useState('');
  const [rEmail,   setREmail]   = useState('');
  const [rPhone,   setRPhone]   = useState('');
  const [rWard,    setRWard]    = useState('');          // ward number (required)

  const [rAge,     setRAge]     = useState('');
  const [rAddress, setRAddress] = useState('');
  const [rLang,    setRLang]    = useState('English');
  const [rPw,      setRPw]      = useState('');
  const [rPwC,     setRPwC]     = useState('');

  // ── Login ───────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const u = await login(email, password, 'citizen');
      if (u) {
        toast({
          title      : t('toasts.welcomeBack'),
          description: t('toasts.loggedInAs', { name: u.name }),
        });
        navigate('/citizen/dashboard');
      }
    } catch (err: any) {
      toast({
        title      : t('toasts.loginFailed'),
        description: err.message || t('toasts.invalidCredentials'),
        variant    : 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Register ────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (rPw !== rPwC) {
      toast({
        title  : t('toasts.passwordMismatch'),
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const u = await register({
        role    : 'citizen',
        name    : rName,
        email   : rEmail,
        phone   : rPhone,
        password: rPw,
        ward    : parseInt(rWard),       // ← required by backend
        age     : rAge ? parseInt(rAge) : undefined,
        address : rAddress || undefined,
        language: rLang,
      });
      toast({
        title      : t('toasts.registrationSuccess'),
        description: t('toasts.welcomeTo', { name: u.name }),
      });
      navigate('/citizen/dashboard');
    } catch (err: any) {
      console.error('citizen register error', err);
      toast({
        title      : t('toasts.registrationFailed'),
        description: err.message || t('toasts.emailMayBeRegistered'),
        variant    : 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Left decorative panel ── */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-accent via-accent to-primary/80 items-center justify-center p-12">
        <div className="text-center text-white max-w-sm">
          <div className="text-6xl mb-6">🏙️</div>
          <h2 className="text-3xl font-heading font-bold mb-4">
            {t('citizen.loginPanelTitle', 'Your City, Your Voice')}
          </h2>
          <p className="opacity-80 font-body text-sm leading-relaxed">
            {t('citizen.loginPanelDesc', 'Report civic issues, track resolutions, and earn rewards for making Nashik better.')}
          </p>

          {/* Feature pills */}
          <div className="mt-8 space-y-2">
            {[
              { icon: '📸', text: 'AI-powered issue detection' },
              { icon: '📍', text: 'GPS + map location picker' },
              { icon: '🏆', text: 'Earn points & badges' },
              { icon: '📊', text: 'Real-time status tracking' },
            ].map((f, i) => (
              <div key={i} className="bg-white/10 rounded-full px-4 py-2 flex items-center gap-2 text-sm">
                <span>{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-8">
            <span className="text-2xl font-heading font-bold text-primary">जनवाणी</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              CITIZEN
            </span>
          </Link>

          {/* Language switcher */}
          <div className="flex justify-end mb-3">
            <LanguageSwitcher />
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1">
            {(['login', 'register'] as const).map(tabKey => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === tabKey
                    ? 'bg-card shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tabKey === 'login' ? t('auth.login') : t('auth.register')}
              </button>
            ))}
          </div>

          {/* ── LOGIN FORM ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label>{t('auth.email')}</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="relative">
                <Label>{t('auth.password')}</Label>
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-8 text-muted-foreground"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex justify-end">
                <Link to="/citizen/forgot-password" className="text-xs text-accent hover:underline">
                  {t('auth.forgotPassword')}
                </Link>
              </div>

              <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
                {submitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('auth.loggingIn')}</>
                  : t('auth.login')}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                {t('auth.demoCitizen', 'Demo: citizen@test.com / password123')}
              </p>
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">

              {/* Name */}
              <div>
                <Label>{t('auth.fullName')}</Label>
                <Input
                  value={rName}
                  onChange={e => setRName(e.target.value)}
                  placeholder="Parikshit Bhadange"
                  required
                />
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('auth.email')}</Label>
                  <Input
                    type="email"
                    value={rEmail}
                    onChange={e => setREmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div>
                  <Label>{t('auth.phone')}</Label>
                  <Input
                    value={rPhone}
                    onChange={e => setRPhone(e.target.value)}
                    placeholder="9876543210"
                    required
                  />
                </div>
              </div>

              {/* Ward (REQUIRED) + Age */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-accent" />
                    {t('auth.ward', 'Ward / Zone')}
                    <span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <select
                    value={rWard}
                    onChange={e => setRWard(e.target.value)}
                    required
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >                    <option disabled value="">-- select ward --</option>                    {Array.from({ length: 10 }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w}>Ward {w}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t('auth.age', 'Age')} <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    type="number"
                    min="10"
                    max="120"
                    value={rAge}
                    onChange={e => setRAge(e.target.value)}
                    placeholder="25"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <Label>{t('auth.address', 'Address')} <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  value={rAddress}
                  onChange={e => setRAddress(e.target.value)}
                  placeholder="Street, Area, Nashik"
                />
              </div>

              {/* Language */}
              <div>
                <Label>{t('auth.language', 'Preferred Language')}</Label>
                <select
                  value={rLang}
                  onChange={e => setRLang(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="English">English</option>
                  <option value="Hindi">हिंदी (Hindi)</option>
                  <option value="Marathi">मराठी (Marathi)</option>
                </select>
              </div>

              {/* Password + Confirm */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('auth.password')}</Label>
                  <Input
                    type="password"
                    value={rPw}
                    onChange={e => setRPw(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label>{t('auth.confirmPassword', 'Confirm Password')}</Label>
                  <Input
                    type="password"
                    value={rPwC}
                    onChange={e => setRPwC(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={rPwC && rPw !== rPwC ? 'border-destructive' : ''}
                  />
                  {rPwC && rPw !== rPwC && (
                    <p className="text-xs text-destructive mt-1">Passwords don't match</p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                variant="hero"
                className="w-full mt-2"
                disabled={submitting || (!!rPwC && rPw !== rPwC)}
              >
                {submitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('auth.registering')}</>
                  : t('auth.createAccount', 'Create Account')}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By registering you agree to our Terms &amp; Privacy Policy.
              </p>
            </form>
          )}

          {/* Footer links */}
          <div className="mt-8 pt-6 border-t border-border text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Are you a municipal officer?{' '}
              <Link to="/admin/login" className="text-accent hover:underline font-medium">
                Admin Login →
              </Link>
            </p>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Back to home
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}