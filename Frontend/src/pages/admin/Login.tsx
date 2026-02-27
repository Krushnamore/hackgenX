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

const DEPARTMENTS = [
  'Roads & Infrastructure',
  'Water Supply',
  'Sanitation',
  'Electricity',
  'Planning',
  'General Administration',
];

export default function AdminLogin() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login, register } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rName, setRName] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [rDept, setRDept] = useState(DEPARTMENTS[0]);
  const [rPost, setRPost] = useState('');
  const [rJoined, setRJoined] = useState('');
  const [rPw, setRPw] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const u = await login(email, password, 'admin');
      if (u && u.role === 'admin') {
        toast({ title: t('toasts.welcomeBack'), description: t('toasts.loggedInAs', { name: u.name }) });
        navigate('/admin/dashboard');
      } else if (u && u.role === 'citizen') {
        toast({ title: t('toasts.citizenAccountDetected'), description: t('toasts.redirectingToCitizen') });
        navigate('/citizen/dashboard');
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
    setSubmitting(true);
    const empId = `MUN-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    try {
      const u = await register({
        role: 'admin',
        name: rName,
        email: rEmail,
        phone: rPhone,
        password: rPw,
        department: rDept,
        post: rPost,
        employeeId: empId,
        joinedDate: rJoined,
        createdAt: new Date().toISOString().split('T')[0],
      });
      toast({ title: t('toasts.registrationSuccess'), description: `Employee ID: ${u.employeeId || empId}` });
      navigate('/admin/dashboard');
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

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary via-primary to-warning/30 items-center justify-center p-12">
        <div className="text-center text-primary-foreground max-w-sm">
          <div className="text-6xl mb-6">🏛️</div>
          <h2 className="text-3xl font-heading font-bold mb-4">{t('admin.officerPortalTitle')}</h2>
          <p className="text-primary-foreground/80 font-body">
            {t('admin.officerPortalDesc')}
          </p>
          <div className="mt-6 inline-block bg-warning/20 rounded-full px-4 py-2 text-sm font-semibold text-warning">
            {t('admin.officialUseOnly')}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <span className="text-2xl font-heading font-bold text-primary">जनवाणी</span>
            <span className="text-xs text-muted-foreground">ADMIN</span>
          </Link>

          <div className="flex justify-end mb-3">
            <LanguageSwitcher />
          </div>

          <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1">
            {(['login', 'register'] as const).map(tabKey => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === tabKey ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                }`}
              >
                {tabKey === 'login' ? t('auth.login') : t('auth.register')}
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
                  placeholder="admin@janvani.in"
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
              <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('auth.loggingIn')}</> : t('auth.login')}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {t('auth.demoAdmin')}
              </p>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <Label>{t('auth.fullName')}</Label>
                <Input value={rName} onChange={e => setRName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('auth.email')}</Label>
                  <Input type="email" value={rEmail} onChange={e => setREmail(e.target.value)} required />
                </div>
                <div>
                  <Label>{t('auth.phone')}</Label>
                  <Input value={rPhone} onChange={e => setRPhone(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('auth.department')}</Label>
                  <select
                    value={rDept}
                    onChange={e => setRDept(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <Label>{t('auth.postDesignation')}</Label>
                  <Input value={rPost} onChange={e => setRPost(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label>{t('auth.joiningDate')}</Label>
                <Input type="date" value={rJoined} onChange={e => setRJoined(e.target.value)} required />
              </div>
              <div>
                <Label>{t('auth.password')}</Label>
                <Input type="password" value={rPw} onChange={e => setRPw(e.target.value)} required />
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('auth.registering')}</> : t('auth.register')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}