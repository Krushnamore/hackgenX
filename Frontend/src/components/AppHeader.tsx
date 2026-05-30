/**
 * AppHeader.tsx — Universal header: Bell + Profile
 * Notification keys by role:
 *   superAdmin   → 'superadmin'
 *   dept_officer → deptKey(department)  (also sees 'admins' channel merged)
 *   admin        → 'admins'
 *   citizen      → their userId
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, X, LogOut, Settings, ChevronRight, Trophy } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useNotifications, deptKey } from '@/hooks/useNotifications';

const TYPE_ICON: Record<string, string> = {
  new_complaint : '📋',
  status_change : '🔄',
  resolved      : '✅',
  points_earned : '🏆',
  badge_unlocked: '🎖️',
  document_sent : '📄',
  admin_pending : '⏳',
};

const TYPE_BG: Record<string, string> = {
  new_complaint : 'bg-blue-50 border-blue-200',
  status_change : 'bg-yellow-50 border-yellow-200',
  resolved      : 'bg-green-50 border-green-200',
  points_earned : 'bg-purple-50 border-purple-200',
  badge_unlocked: 'bg-amber-50 border-amber-200',
  document_sent : 'bg-teal-50 border-teal-200',
  admin_pending : 'bg-orange-50 border-orange-200',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function initials(name: string): string {
  return (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const BADGE_COLOR: Record<string, string> = {
  Bronze: 'bg-orange-100 text-orange-700',
  Silver: 'bg-slate-100 text-slate-600',
  Gold  : 'bg-yellow-100 text-yellow-700',
};

const ADMIN_ROLES = ['superAdmin', 'dept_officer', 'admin'];

interface Props { title?: string; }

export default function AppHeader({ title = 'JANVANI' }: Props) {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();

  const isAdmin      = ADMIN_ROLES.includes(currentUser?.role);
  const isSuperAdmin = currentUser?.role === 'superAdmin';
  const isOfficer    = currentUser?.role === 'dept_officer' || currentUser?.role === 'admin';

  // Primary notif key per role
  const primaryKey = useMemo(() => {
    if (!currentUser) return undefined;
    if (isSuperAdmin) return 'superadmin';
    if (isOfficer && currentUser.department) return deptKey(currentUser.department);
    if (isAdmin)  return 'admins';
    // Citizen — must be a plain string matching what addNotification uses
    const uid = String(currentUser._id || currentUser.id || '');
    return uid || undefined;
  }, [currentUser, isSuperAdmin, isOfficer, isAdmin]);

  // Officers also get the shared 'admins' channel merged in
  const secondaryKey = isOfficer ? 'admins' : undefined;

  const primary   = useNotifications(primaryKey);
  const secondary = useNotifications(secondaryKey);

  // Merge both channels, sorted by timestamp, deduplicated by id
  const allNotifs = useMemo(() => {
    const merged = [...primary.notifs, ...secondary.notifs];
    const seen   = new Set<string>();
    return merged
      .filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [primary.notifs, secondary.notifs]);

  const unread = allNotifs.filter(n => !n.read).length;

  const handleMarkRead = () => {
    primary.markRead();
    secondary.markRead();
  };
  const handleClear = () => {
    primary.clear();
    secondary.clear();
  };

  const [bellOpen,    setBellOpen]    = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bellRef    = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (bellRef.current    && !bellRef.current.contains(e.target as Node))    setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const toggleBell = () => {
    setBellOpen(v => !v);
    setProfileOpen(false);
    if (!bellOpen && unread > 0) handleMarkRead();
  };

  const toggleProfile = () => {
    setProfileOpen(v => !v);
    setBellOpen(false);
  };

  const handleNotifClick = (n: any) => {
    if (n.link) navigate(n.link);
    setBellOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate(isAdmin ? '/admin/login' : '/citizen/login');
  };

  const handleSettings = () => {
    navigate(isAdmin ? '/admin/settings' : '/citizen/dashboard');
    setProfileOpen(false);
  };



  if (!currentUser) return null;

  const roleLabel =
    isSuperAdmin  ? 'Super Admin'
    : isOfficer   ? `Officer · ${currentUser.department || ''}`
    : currentUser.role === 'admin' ? `Admin · ${currentUser.department || ''}`
    : `Citizen · Ward ${currentUser.ward || 1}`;

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 flex-shrink-0 z-30">
      <p className="text-sm font-medium text-muted-foreground hidden sm:block">{title}</p>

      <div className="flex items-center gap-2 ml-auto">

        {/* ── Bell ── */}
        <div className="relative" ref={bellRef}>
          <button onClick={toggleBell}
            className="relative h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Notifications">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-11 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span className="font-semibold text-sm">Notifications</span>
                  {unread > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unread} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {allNotifs.length > 0 && (
                    <>
                      <button onClick={handleMarkRead} title="Mark all read"
                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted">
                        <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={handleClear} title="Clear all"
                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </>
                  )}
                  <button onClick={() => setBellOpen(false)}
                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
                {allNotifs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-medium">No notifications yet</p>
                    <p className="text-xs mt-1 opacity-60">
                      {isAdmin ? 'New complaint alerts will appear here' : 'Complaint updates & rewards appear here'}
                    </p>
                  </div>
                ) : (
                  allNotifs.map(n => (
                    <button key={n.id} onClick={() => handleNotifClick(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex gap-3 items-start ${!n.read ? 'bg-accent/5' : ''}`}>
                      <span className={`flex-shrink-0 h-8 w-8 rounded-full border flex items-center justify-center text-sm ${TYPE_BG[n.type] || 'bg-muted border-border'}`}>
                        {TYPE_ICON[n.type] || '🔔'}
                      </span>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-start justify-between gap-1">
                          <p className={`text-xs font-semibold leading-snug ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {n.title}
                          </p>
                          {!n.read && <span className="flex-shrink-0 h-2 w-2 rounded-full bg-blue-500 mt-1" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1">{timeAgo(n.timestamp)}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {allNotifs.length > 0 && (
                <div className="px-4 py-2 border-t border-border bg-muted/20 text-center">
                  <p className="text-[10px] text-muted-foreground">
                    {allNotifs.length} notification{allNotifs.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Avatar / Profile ── */}
        <div className="relative" ref={profileRef}>
          <button onClick={toggleProfile}
            className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold hover:opacity-90 transition-opacity overflow-hidden ring-2 ring-transparent hover:ring-primary/30"
            aria-label="Profile">
            {currentUser.avatar
              ? <img src={currentUser.avatar} className="w-full h-full object-cover" alt={currentUser.name} />
              : initials(currentUser.name || 'U')}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-11 w-72 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="p-4 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold flex-shrink-0 overflow-hidden">
                    {currentUser.avatar
                      ? <img src={currentUser.avatar} className="w-full h-full object-cover" alt={currentUser.name} />
                      : initials(currentUser.name || 'U')}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {roleLabel}
                    </span>
                  </div>
                </div>

                {!isAdmin && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-background rounded-lg p-2">
                      <p className="text-sm font-bold text-primary">{currentUser.points || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Points</p>
                    </div>
                    <div className="bg-background rounded-lg p-2">
                      <p className="text-sm font-bold">{currentUser.complaintsSubmitted || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Reports</p>
                    </div>
                    <div className="bg-background rounded-lg p-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_COLOR[currentUser.badge || 'Bronze'] || BADGE_COLOR.Bronze}`}>
                        {currentUser.badge || 'Bronze'}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Badge</p>
                    </div>
                  </div>
                )}

                {isAdmin && currentUser.department && (
                  <div className="mt-2">
                    <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      🏢 {currentUser.department}
                    </span>
                    {isSuperAdmin && (
                      <span className="ml-2 text-[11px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                        👑 Super Admin
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-2 space-y-0.5">
                <button onClick={handleSettings}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Settings &amp; Profile</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                </button>

                {!isAdmin && (
                  <button onClick={() => { navigate('/citizen/rewards'); setProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span>My Rewards</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  </button>
                )}

                <div className="my-1 border-t border-border" />

                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors text-sm">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}