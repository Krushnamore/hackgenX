/**
 * Admin Settings Page
 * — superAdmin: sees "Pending Approvals" tab with approve/reject buttons
 * — dept_officer: normal profile/security/notifications/system tabs
 */

import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { userAPI } from '@/lib/api';
import {
  User, Shield, Bell, Settings as SettingsIcon,
  Eye, EyeOff, Check, Camera, Download,
  ShieldCheck, Wrench, UserCheck, UserX, Clock,
} from 'lucide-react';
import * as XLSX from 'xlsx';

const DEPT_OPTIONS = [
  'Roads & Infrastructure', 'Water Supply', 'Sanitation',
  'Electricity', 'Planning', 'General Administration',
];

export default function AdminSettings() {
  const { currentUser, complaints, getPendingAdmins, approveAdmin } = useApp() as any;
  const { toast } = useToast();
  const [tab, setTab] = useState('profile');

  const isSuperAdmin = currentUser?.role === 'superAdmin';
  const isOfficer    = currentUser?.role === 'dept_officer' || currentUser?.role === 'admin';

  // ── Profile ──────────────────────────────────────────────────
  const [pName,   setPName]   = useState(currentUser?.name       || '');
  const [pPhone,  setPPhone]  = useState(currentUser?.phone      || '');
  const [pDept,   setPDept]   = useState(currentUser?.department || '');
  const [pPost,   setPPost]   = useState(currentUser?.post       || '');
  const [pAvatar, setPAvatar] = useState<string | null>(currentUser?.avatar || null);
  const [pSaved,  setPSaved]  = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setPAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await userAPI.updateProfile({
        name: pName, phone: pPhone,
        ...(isSuperAdmin ? { department: pDept } : {}),
        post: pPost,
        ...(pAvatar ? { avatar: pAvatar } : {}),
      });
      setPSaved(true);
      setTimeout(() => setPSaved(false), 3000);
      toast({ title: '✅ Profile saved' });
    } catch (err: any) {
      toast({ title: '❌ ' + err.message, variant: 'destructive' });
    }
  };

  // ── Security ─────────────────────────────────────────────────
  const [curPw,    setCurPw]    = useState('');
  const [newPw,    setNewPw]    = useState('');
  const [confPw,   setConfPw]   = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showConf, setShowConf] = useState(false);

  const pwStrength = (() => {
    if (!newPw) return 0;
    let s = 0;
    if (newPw.length >= 8) s++;
    if (/[A-Z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return Math.min(3, s);
  })();
  const pwStrengthLabel = ['', 'Weak', 'Medium', 'Strong'][pwStrength];
  const pwStrengthColor = ['', 'bg-destructive', 'bg-warning', 'bg-success'][pwStrength];

  const handleChangePassword = async () => {
    if (!curPw || !newPw || !confPw) { toast({ title: 'Fill all password fields', variant: 'destructive' }); return; }
    if (newPw !== confPw)            { toast({ title: 'Passwords do not match', variant: 'destructive' }); return; }
    if (newPw.length < 6)           { toast({ title: 'Password must be at least 6 characters', variant: 'destructive' }); return; }
    try {
      await userAPI.changePassword(curPw, newPw);
      toast({ title: '✅ Password updated successfully' });
      setCurPw(''); setNewPw(''); setConfPw('');
    } catch (err: any) {
      toast({ title: '❌ ' + (err.message || 'Failed'), variant: 'destructive' });
    }
  };

  // ── Notifications ─────────────────────────────────────────────
  const [notifs, setNotifs] = useState({
    newComplaints: true, sosAlerts: true, feedback: true,
    weeklyReports: false, criticalOnly: false, overdue: true,
  });
  const toggleNotif = (key: keyof typeof notifs) => setNotifs(prev => ({ ...prev, [key]: !prev[key] }));
  const NOTIF_LABELS = [
    { key: 'newComplaints' as const, label: 'New Complaints',    desc: 'Notify when a new complaint is submitted' },
    { key: 'sosAlerts'     as const, label: 'SOS Alerts',        desc: 'Immediate alert for emergency SOS reports' },
    { key: 'feedback'      as const, label: 'Feedback Received', desc: 'When citizens submit feedback on resolved issues' },
    { key: 'weeklyReports' as const, label: 'Weekly Reports',    desc: 'Auto-generated summary every Monday' },
    { key: 'criticalOnly'  as const, label: 'Critical Priority', desc: 'Extra alert for Critical priority complaints' },
    { key: 'overdue'       as const, label: 'Overdue Alerts',    desc: 'When complaints pass their estimated resolution date' },
  ];

  // ── Export ────────────────────────────────────────────────────
  const downloadAll = () => {
    const rows = complaints.map((c: any) => ({
      'Complaint ID': c.id, 'Title': c.title, 'Category': c.category,
      'Priority': c.priority, 'Status': c.status, 'Zone': `Zone ${c.ward}`,
      'Citizen': c.citizenName, 'Phone': c.citizenPhone,
      'Submitted': c.createdAt, 'Updated': c.updatedAt,
      'Officer': c.assignedOfficer || '', 'Admin Note': c.adminNote || '',
      'Rating': c.feedback?.rating || '', 'Feedback': c.feedback?.comment || '',
      'SOS': c.isSOS ? 'Yes' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Complaints');
    XLSX.writeFile(wb, `janvani_all_data_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: '📥 All data exported', description: `${complaints.length} records` });
  };

  // ── Pending Admins (superAdmin only) ──────────────────────────
  const [pendingAdmins, setPendingAdmins]   = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins]   = useState(false);
  const [approvingId,   setApprovingId]     = useState<string | null>(null);

  const loadPending = async () => {
    setLoadingAdmins(true);
    try {
      const list = await getPendingAdmins();
      setPendingAdmins(list);
    } catch {}
    setLoadingAdmins(false);
  };

  useEffect(() => {
    if (tab === 'approvals' && isSuperAdmin) loadPending();
  }, [tab]);

  const handleApproval = async (id: string, action: 'approve' | 'reject') => {
    setApprovingId(id);
    try {
      await approveAdmin(id, action);
      toast({
        title: action === 'approve' ? '✅ Admin Approved' : '❌ Admin Rejected',
        description: action === 'approve'
          ? 'The officer can now log in to the portal.'
          : 'The registration has been rejected.',
      });
      setPendingAdmins(prev => prev.filter(a => (a._id || a.id) !== id));
    } catch (err: any) {
      toast({ title: '❌ Error: ' + err.message, variant: 'destructive' });
    }
    setApprovingId(null);
  };

  // ── Tabs ──────────────────────────────────────────────────────
  const tabs = [
    { id: 'profile',       label: 'Profile',       icon: User },
    { id: 'security',      label: 'Security',       icon: Shield },
    { id: 'notifications', label: 'Notifications',  icon: Bell },
    { id: 'system',        label: 'System',         icon: SettingsIcon },
    ...(isSuperAdmin ? [{ id: 'approvals', label: `Approvals${pendingAdmins.length ? ` (${pendingAdmins.length})` : ''}`, icon: UserCheck }] : []),
  ];

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-heading font-bold">Settings</h1>

        <div className="flex gap-1 bg-muted rounded-lg p-1 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                tab === t.id ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
              } ${t.id === 'approvals' && pendingAdmins.length > 0 ? 'text-orange-600' : ''}`}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── PROFILE ── */}
        {tab === 'profile' && (
          <div className="card-elevated p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className="h-20 w-20 rounded-full bg-warning text-warning-foreground flex items-center justify-center text-3xl font-bold overflow-hidden cursor-pointer"
                  onClick={() => avatarRef.current?.click()}
                >
                  {pAvatar
                    ? <img src={pAvatar} className="h-full w-full object-cover" alt="Avatar" />
                    : pName?.[0]?.toUpperCase() || '?'}
                </div>
                <button
                  className="absolute bottom-0 right-0 h-6 w-6 bg-accent rounded-full flex items-center justify-center shadow"
                  onClick={() => avatarRef.current?.click()}
                >
                  <Camera className="h-3 w-3 text-white" />
                </button>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-lg">{currentUser?.name}</h3>
                <p className="text-sm text-muted-foreground">{currentUser?.employeeId}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{currentUser?.email}</p>
                <div className="mt-2">
                  {isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="h-3 w-3" /> Super Admin · All Departments
                    </span>
                  )}
                  {isOfficer && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                      <Wrench className="h-3 w-3" /> Department Officer · {currentUser?.department}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Full Name</Label><Input className="mt-1" value={pName} onChange={e => setPName(e.target.value)} /></div>
              <div><Label>Email</Label><Input className="mt-1" value={currentUser?.email || ''} disabled /></div>
              <div><Label>Phone</Label><Input className="mt-1" value={pPhone} onChange={e => setPPhone(e.target.value)} /></div>
              <div>
                <Label>Department</Label>
                {isSuperAdmin ? (
                  <select value={pDept} onChange={e => setPDept(e.target.value)}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Select department</option>
                    {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                ) : (
                  <div className="mt-1">
                    <Input value={pDept} disabled className="bg-sky-50 border-sky-200 text-sky-700" />
                    <p className="text-[10px] text-muted-foreground mt-1">🔒 Department locked. Contact Super Admin to change.</p>
                  </div>
                )}
              </div>
              <div><Label>Post / Title</Label><Input className="mt-1" value={pPost} onChange={e => setPPost(e.target.value)} /></div>
              <div><Label>Joined Date</Label><Input className="mt-1" value={currentUser?.joinedDate || '—'} disabled /></div>
              <div><Label>Employee ID</Label><Input className="mt-1" value={currentUser?.employeeId || '—'} disabled /></div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="hero" onClick={handleSaveProfile}>Save Changes</Button>
              {pSaved && <span className="flex items-center gap-1 text-sm text-green-600"><Check className="h-4 w-4" /> Saved</span>}
            </div>
          </div>
        )}

        {/* ── SECURITY ── */}
        {tab === 'security' && (
          <div className="card-elevated p-6 space-y-5">
            <h3 className="font-heading font-semibold">Change Password</h3>
            <div>
              <Label>Current Password</Label>
              <div className="relative mt-1">
                <Input type={showCur ? 'text' : 'password'} value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="Enter current password" />
                <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={() => setShowCur(!showCur)}>
                  {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>New Password</Label>
              <div className="relative mt-1">
                <Input type={showNew ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Enter new password" />
                <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPw && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">{[1,2,3].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= pwStrength ? pwStrengthColor : 'bg-muted'}`} />)}</div>
                  <p className="text-xs text-muted-foreground">Strength: <strong>{pwStrengthLabel}</strong></p>
                </div>
              )}
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <div className="relative mt-1">
                <Input type={showConf ? 'text' : 'password'} value={confPw} onChange={e => setConfPw(e.target.value)} placeholder="Re-enter new password" />
                <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={() => setShowConf(!showConf)}>
                  {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confPw && newPw !== confPw && <p className="text-xs text-destructive mt-1">Passwords do not match</p>}
            </div>
            <Button variant="hero" onClick={handleChangePassword}>Update Password</Button>
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {tab === 'notifications' && (
          <div className="card-elevated p-6 space-y-1">
            <h3 className="font-heading font-semibold mb-4">Notification Preferences</h3>
            {NOTIF_LABELS.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                <button
                  role="switch" aria-checked={notifs[key]} onClick={() => toggleNotif(key)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${notifs[key] ? 'bg-accent' : 'bg-muted'}`}
                >
                  <span className={`absolute top-1 left-1 h-4 w-4 bg-white rounded-full shadow transition-transform ${notifs[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
            <div className="pt-4">
              <Button variant="hero" size="sm" onClick={() => toast({ title: '✅ Notification preferences saved' })}>Save Preferences</Button>
            </div>
          </div>
        )}

        {/* ── SYSTEM ── */}
        {tab === 'system' && (
          <div className="space-y-4">
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold mb-4">Data Export</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Export All Complaints</p>
                  <p className="text-xs text-muted-foreground">{complaints.length} records · Excel format</p>
                </div>
                <Button variant="outline" size="sm" onClick={downloadAll}>
                  <Download className="h-4 w-4 mr-1" /> Export Excel
                </Button>
              </div>
            </div>
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold mb-4">System Information</h3>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Application',     value: 'JANVANI Complaint Management' },
                  { label: 'Version',          value: 'v1.0.0' },
                  { label: 'Backend URL',      value: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' },
                  { label: 'Logged in as',     value: `${currentUser?.name} (${currentUser?.employeeId})` },
                  { label: 'Role',             value: isSuperAdmin ? '👑 Super Admin' : `🏢 Officer · ${currentUser?.department}` },
                  { label: 'Total Complaints', value: String(complaints.length) },
                  { label: 'Resolved',         value: String(complaints.filter((c: any) => c.status === 'Resolved').length) },
                  { label: 'Pending',          value: String(complaints.filter((c: any) => !['Resolved','Rejected'].includes(c.status)).length) },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PENDING APPROVALS (superAdmin only) ── */}
        {tab === 'approvals' && isSuperAdmin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold">Pending Admin Registrations</h3>
              <Button variant="outline" size="sm" onClick={loadPending}>🔄 Refresh</Button>
            </div>

            {loadingAdmins ? (
              <div className="card-elevated p-8 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 animate-pulse opacity-40" />
                <p className="text-sm">Loading pending requests…</p>
              </div>
            ) : pendingAdmins.length === 0 ? (
              <div className="card-elevated p-8 text-center text-muted-foreground">
                <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-sm">No pending approvals</p>
                <p className="text-xs mt-1 opacity-60">All department officer registrations are up to date.</p>
              </div>
            ) : (
              pendingAdmins.map((admin: any) => {
                const id = admin._id || admin.id;
                return (
                  <div key={id} className="card-elevated p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-lg font-bold flex-shrink-0">
                          {admin.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{admin.name}</p>
                          <p className="text-xs text-muted-foreground">{admin.email}</p>
                          <p className="text-xs text-muted-foreground">{admin.phone}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              🏢 {admin.department}
                            </span>
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                              {admin.employeeId}
                            </span>
                            <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" /> Pending
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1"
                          disabled={approvingId === id}
                          onClick={() => handleApproval(id, 'approve')}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          {approvingId === id ? 'Approving…' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
                          disabled={approvingId === id}
                          onClick={() => handleApproval(id, 'reject')}
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}