import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const ZONES = [1, 2, 3, 4, 5] as const;

export default function CitizenLogin() {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login, register } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register
  const [rName, setRName] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rAge, setRAge] = useState('');
  const [rAddress, setRAddress] = useState('');
  const [rZone, setRZone] = useState('');
  const [rPincode, setRPincode] = useState('');
  const [rAadhar, setRAadhar] = useState('');
  const [rPw, setRPw] = useState('');
  const [rPw2, setRPw2] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const u = await login(email, password, 'citizen');
      if (u && u.role === 'citizen') {
        toast({ title: t('toasts.welcomeBack'), description: t('toasts.loggedInAs', { name: u.name }) });
        navigate('/citizen/dashboard');
      } else if (u && u.role === 'admin') {
        // Wrong portal — redirect to admin
        toast({ title: t('toasts.adminAccountDetected'), description: t('toasts.redirectingToAdmin') });
        navigate('/admin/dashboard');
      }
    } catch (err: any) {
      toast({
        title: t('toasts.loginFailed'),
        description: err.message || t('toasts.invalidCredentials'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (rPw !== rPw2) {
      toast({ title: t('toasts.passwordsDoNotMatch'), variant: 'destructive' });
      return;
    }
    if (!rZone) {
      toast({ title: t('toasts.zoneRequired'), description: t('toasts.pleaseSelectZone'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const u = await register({
        role: 'citizen',
        name: rName,
        email: rEmail,
        phone: rPhone,
        age: parseInt(rAge),
        address: rAddress,
        ward: parseInt(rZone),
        pincode: rPincode,
        aadharLast4: rAadhar,
        password: rPw,
        language: 'English',
        points: 0,
        badge: 'Bronze',
        complaintsSubmitted: 0,
        complaintsResolved: 0,
        createdAt: new Date().toISOString().split('T')[0],
      });
      toast({ title: t('toasts.registrationSuccess'), description: t('toasts.welcomeName', { name: u.name }) });
      navigate('/citizen/dashboard');
    } catch (err: any) {
      toast({
        title: t('toasts.registrationFailed'),
        description: err.message || t('toasts.emailMayBeRegistered'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const emailInput = (document.getElementById('forgot-email') as HTMLInputElement)?.value;
    if (!emailInput) {
      toast({ title: t('toasts.enterEmailFirst'), variant: 'destructive' });
      return;
    }
    try {
      toast({ title: t('toasts.otpSentDemo') });
    } catch {
      toast({ title: t('toasts.otpFailed'), variant: 'destructive' });
    }
  };

  const pwStrength = rPw.length === 0 ? 0 : rPw.length < 4 ? 1 : rPw.length < 8 ? 2 : 3;
  const pwColors = ['bg-muted', 'bg-destructive', 'bg-warning', 'bg-success'];

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <span className="text-2xl font-heading font-bold text-primary">जनवाणी</span>
            <span className="text-xs text-muted-foreground">CITIZEN</span>
          </Link>

          <div className="flex justify-end mb-3">
            <LanguageSwitcher />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1">
            {(['login', 'register', 'forgot'] as const).map(tabKey => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === tabKey ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                }`}
              >
                {tabKey === 'login'
                  ? t('auth.login')
                  : tabKey === 'register'
                    ? t('auth.register')
                    : t('auth.forgotPassword')}
              </button>
            ))}
          </div>

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label>{t('auth.email')}</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="citizen1@janvani.in"
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
                  placeholder="••••••"
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
              <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('auth.loggingIn')}</> : t('auth.login')}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {t('auth.demoCitizen')}
              </p>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <Label>{t('auth.fullName')}</Label>
                <Input value={rName} onChange={e => setRName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('auth.phone')}</Label>
                  <Input value={rPhone} onChange={e => setRPhone(e.target.value)} required />
                </div>
                <div>
                  <Label>{t('auth.age')}</Label>
                  <Input type="number" value={rAge} onChange={e => setRAge(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label>{t('auth.email')}</Label>
                <Input type="email" value={rEmail} onChange={e => setREmail(e.target.value)} required />
              </div>
              <div>
                <Label>{t('auth.address')}</Label>
                <Input value={rAddress} onChange={e => setRAddress(e.target.value)} required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{t('auth.zone')}</Label>
                  <select
                    value={rZone}
                    onChange={e => setRZone(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    required
                  >
                    <option value="" disabled>{t('auth.selectZone')}</option>
                    {ZONES.map(z => <option key={z} value={z}>Zone {z}</option>)}
                  </select>
                </div>
                <div>
                  <Label>{t('auth.pincode')}</Label>
                  <Input value={rPincode} onChange={e => setRPincode(e.target.value)} required />
                </div>
                <div>
                  <Label>{t('auth.aadharLast4')}</Label>
                  <Input maxLength={4} value={rAadhar} onChange={e => setRAadhar(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label>{t('auth.password')}</Label>
                <Input
                  type="password"
                  value={rPw}
                  onChange={e => setRPw(e.target.value)}
                  required
                />
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${i <= pwStrength ? pwColors[pwStrength] : 'bg-muted'}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label>{t('auth.confirmPassword')}</Label>
                <Input
                  type="password"
                  value={rPw2}
                  onChange={e => setRPw2(e.target.value)}
                  required
                />
                {rPw2 && rPw !== rPw2 && (
                  <p className="text-xs text-destructive mt-1">{t('toasts.passwordsDoNotMatch')}</p>
                )}
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('auth.registering')}</> : t('auth.register')}
              </Button>
            </form>
          )}

          {tab === 'forgot' && (
            <div className="space-y-4">
              <div>
                <Label>{t('auth.email')}</Label>
                <Input id="forgot-email" type="email" placeholder={t('auth.email')} />
              </div>
              <Button variant="hero" className="w-full" onClick={handleForgotPassword}>
                {t('auth.sendOtp')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right decorative panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary to-accent items-center justify-center p-12">
        <div className="text-center text-primary-foreground max-w-sm">
          <div className="text-6xl mb-6">🏠</div>
          <h2 className="text-3xl font-heading font-bold mb-4">{t('landing.citizenPortalTitle')}</h2>
          <p className="text-primary-foreground/80 font-body">
            {t('landing.citizenPortalDesc')}
          </p>
        </div>
      </div>
    </div>
  );
}