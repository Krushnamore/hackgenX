import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { LayoutDashboard, FileText, Search, Trophy, Gift, AlertTriangle, MessageSquare, LogOut, Bell, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const NAV = [
  { to: '/citizen/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { to: '/citizen/report', icon: FileText, labelKey: 'nav.reportIssue' },
  { to: '/citizen/track', icon: Search, labelKey: 'nav.track' },
  { to: '/citizen/leaderboard', icon: Trophy, labelKey: 'nav.leaderboard' },
  { to: '/citizen/rewards', icon: Gift, labelKey: 'nav.rewards' },
  { to: '/citizen/sos', icon: AlertTriangle, labelKey: 'nav.sos' },
  { to: '/citizen/feedback', icon: MessageSquare, labelKey: 'nav.feedback' },
];

export default function CitizenLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-60 bg-primary flex-col transition-transform duration-200 hidden lg:flex")}>
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <span className="text-xl font-heading font-bold text-primary-foreground">जनवाणी</span>
          <span className="text-xs text-primary-foreground/70 font-body">JANVANI</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) =>
              cn("sidebar-item text-primary-foreground/70 hover:bg-sidebar-accent hover:text-primary-foreground", isActive && "sidebar-item-active bg-sidebar-accent text-primary-foreground")
            }>
              <n.icon className="h-4 w-4" /><span>{t(n.labelKey)}</span>
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} className="sidebar-item text-primary-foreground/70 hover:bg-sidebar-accent mx-3 mb-4">
          <LogOut className="h-4 w-4" /><span>{t('auth.logout')}</span>
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex lg:hidden justify-around py-2">
        {NAV.slice(0, 5).map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) =>
            cn("flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground p-1", isActive && "text-accent")
          }>
            <n.icon className="h-5 w-5" />{t(n.labelKey)}
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <div className="flex-1 lg:ml-60">
        <header className="sticky top-0 z-30 bg-card border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(!open)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
            <h2 className="text-sm font-heading font-semibold">{t('citizen.welcome', { name: currentUser?.name || '' })}</h2>
            <span className="text-xs text-muted-foreground hidden sm:inline">{t('citizen.ward', { ward: currentUser?.ward || '—' })}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <button className="relative"><Bell className="h-5 w-5 text-muted-foreground" /><span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" /></button>
            <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-sm font-bold">{currentUser?.name?.[0]}</div>
          </div>
        </header>

        {/* Mobile slide menu */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-60 bg-primary p-4 space-y-1 animate-fade-in">
              {NAV.map(n => (
                <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)} className={({ isActive }) =>
                  cn("sidebar-item text-primary-foreground/70", isActive && "sidebar-item-active text-primary-foreground")
                }>
                  <n.icon className="h-4 w-4" /><span>{t(n.labelKey)}</span>
                </NavLink>
              ))}
              <button onClick={handleLogout} className="sidebar-item text-primary-foreground/70 w-full"><LogOut className="h-4 w-4" /><span>{t('auth.logout')}</span></button>
            </div>
          </div>
        )}

        <main className="p-4 lg:p-6 pb-20 lg:pb-6">{children}</main>
      </div>
    </div>
  );
}
