/**
 * Admin Settings Page — shows adminType badge + role info
 *
 * CHANGES vs original:
 * • Profile tab shows the user's role badge (Super Admin / Officer)
 * • Officers see a note that their department is locked and cannot be changed
 * • Super Admin can change department freely
 * • All other functionality identical to original
 */

import { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { userAPI } from '@/lib/api';
import {
  User, Shield, Bell, Settings as SettingsIcon,
  Eye, EyeOff, Check, Camera, Download, ShieldCheck, Wrench,
} from 'lucide-react';
import * as XLSX from 'xlsx';

const DEPT_OPTIONS = [
  'Roads & Infrastructure', 'Water Supply', 'Sanitation',
  'Electricity', 'Planning', 'General Administration',
];

export default function AdminSettings() {
  const { currentUser, complaints, updateUser } = useApp();
  const { toast } = useToast();
  const [tab, setTab] = useState('profile');

  const isSuperAdmin = currentUser?.adminType === 'superadmin';
  const isOfficer    = currentUser?.adminType === 'officer';

  // Profile state
  const [pName,   setPName]   = useState(currentUser?.name       || '');
  const [pEmail,  setPEmail]  = useState(currentUser?.email      || '');
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
    await updateUser({
      name: pName, phone: pPhone,
      // Officers: department is immutable — don't send it
      ...(isSuperAdmin ? { department: pDept } : {}),
      post: pPost,
      ...(pAvatar ? { avatar: pAvatar } : {}),
    });
    setPSaved(true);
    setTimeout(() => setPSaved(false), 3000);
    toast({ title: '✅ Profile saved' });
  };

  // Security state
  const [curPw,    setCurPw]    = useState('');
  const [newPw,    setNewPw]    = useState('');
  const [confPw,   setConfPw]   = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showConf, setShowConf] = useState(false);

  const pwStrength = (() => {
    if (!newPw) return 0;
    let s = 0;
    if (newPw.length >= 8)          s++;
    if (/[A-Z]/.test(newPw))        s++;
    if (/[0-9]/.test(newPw))        s++;
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

  // Notifications state
  const [notifs, setNotifs] = useState({
    newComplaints: true, sosAlerts: true, feedback: true,
    weeklyReports: false, criticalOnly: false, overdue: true,
  });
  const toggleNotif = (key: keyof typeof notifs) => setNotifs(prev => ({ ...prev, [key]: !prev[key] }));

  const NOTIF_LABELS: { key: keyof typeof notifs; label: string; desc: string }[] = [
    { key: 'newComplaints', label: 'New Complaints',    desc: 'Notify when a new complaint is submitted' },
    { key: 'sosAlerts',     label: 'SOS Alerts',        desc: 'Immediate alert for emergency SOS reports' },
    { key: 'feedback',      label: 'Feedback Received', desc: 'When citizens submit feedback on resolved issues' },
    { key: 'weeklyReports', label: 'Weekly Reports',    desc: 'Auto-generated summary every Monday' },
    { key: 'criticalOnly',  label: 'Critical Priority', desc: 'Extra alert for Critical priority complaints' },
    { key: 'overdue',       label: 'Overdue Alerts',    desc: 'When complaints pass their estimated resolution date' },
  ];

  const downloadAll = () => {
    const rows = complaints.map(c => ({
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

  const tabs = [
    { id: 'profile',       label: 'Profile',      icon: User },
    { id: 'security',      label: 'Security',      icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'system',        label: 'System',        icon: SettingsIcon },
  ];

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-heading font-bold">Settings</h1>

        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {tabs.map(t => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                tab === t.id ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <div className="card-elevated p-6 space-y-5">
            {/* Avatar + role badge */}
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

                {/* Role badge */}
                <div className="mt-2">
                  {isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="h-3 w-3" /> Super Admin · All Departments
                    </span>
                  )}
                  {isOfficer && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 px-2 py-0.5 rounded-full">
                      <Wrench className="h-3 w-3" /> Department Officer · {currentUser?.department}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full Name</Label>
                <Input className="mt-1" value={pName} onChange={e => setPName(e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input className="mt-1" value={pEmail} disabled title="Email cannot be changed." />
              </div>
              <div>
                <Label>Phone</Label>
                <Input className="mt-1" value={pPhone} onChange={e => setPPhone(e.target.value)} />
              </div>

              {/* Department: editable for superadmin, locked for officer */}
              <div>
                <Label>Department</Label>
                {isSuperAdmin ? (
                  <select
                    value={pDept} onChange={e => setPDept(e.target.value)}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select department</option>
                    {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                ) : (
                  <div className="mt-1">
                    <Input value={pDept} disabled className="bg-sky-50 dark:bg-sky-900/20 border-sky-200 text-sky-700 dark:text-sky-300" />
                    <p className="text-[10px] text-muted-foreground mt-1">🔒 Department is locked. Contact Super Admin to change.</p>
                  </div>
                )}
              </div>

              <div>
                <Label>Post / Title</Label>
                <Input className="mt-1" value={pPost} onChange={e => setPPost(e.target.value)} />
              </div>
              <div>
                <Label>Joined Date</Label>
                <Input className="mt-1" value={currentUser?.joinedDate || '—'} disabled />
              </div>
              <div>
                <Label>Employee ID</Label>
                <Input className="mt-1" value={currentUser?.employeeId || '—'} disabled />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="hero" onClick={handleSaveProfile}>Save Changes</Button>
              {pSaved && <span className="flex items-center gap-1 text-sm text-green-600"><Check className="h-4 w-4" /> Saved</span>}
            </div>
          </div>
        )}

        {/* ── SECURITY TAB ── */}
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
                  <div className="flex gap-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= pwStrength ? pwStrengthColor : 'bg-muted'}`} />
                    ))}
                  </div>
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

            <hr className="border-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => toast({ title: '🔜 Coming soon' })}>Enable</Button>
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS TAB ── */}
        {tab === 'notifications' && (
          <div className="card-elevated p-6 space-y-1">
            <h3 className="font-heading font-semibold mb-4">Notification Preferences</h3>
            {NOTIF_LABELS.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <button
                  role="switch" aria-checked={notifs[key]} onClick={() => toggleNotif(key)}
                  className={`relative w-10 h-6 rounded-full transition-colors focus:outline-none ${notifs[key] ? 'bg-accent' : 'bg-muted'}`}
                >
                  <span className={`absolute top-1 left-1 h-4 w-4 bg-white rounded-full shadow transition-transform ${notifs[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
            <div className="pt-4">
              <Button variant="hero" size="sm" onClick={() => toast({ title: '✅ Notification preferences saved' })}>
                Save Preferences
              </Button>
            </div>
          </div>
        )}

        {/* ── SYSTEM TAB ── */}
        {tab === 'system' && (
          <div className="space-y-4">
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold mb-4">Data Export</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Export All Complaints</p>
                  <p className="text-xs text-muted-foreground">{complaints.length} records · Excel format
                    {isOfficer && ` · ${currentUser?.department} only`}
                  </p>
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
                  { label: 'Environment',      value: import.meta.env.MODE || 'development' },
                  { label: 'Backend URL',      value: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' },
                  { label: 'Logged in as',     value: `${currentUser?.name} (${currentUser?.employeeId})` },
                  { label: 'Role',             value: isSuperAdmin ? '👑 Super Admin (City-wide)' : `🏢 Department Officer (${currentUser?.department})` },
                  { label: 'Total Complaints', value: complaints.length.toString() },
                  { label: 'Resolved',         value: complaints.filter(c => c.status === 'Resolved').length.toString() },
                  { label: 'Pending',          value: complaints.filter(c => c.status !== 'Resolved' && c.status !== 'Rejected').length.toString() },
                  { label: 'SOS Complaints',   value: complaints.filter(c => c.isSOS).length.toString() },
                  { label: 'Auth',             value: 'JWT · MongoDB Atlas' },
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
      </div>
    </AdminLayout>
  );
}