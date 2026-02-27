import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import CitizenLayout from '@/components/CitizenLayout';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, Clock, Star, Plus, Search, AlertTriangle } from 'lucide-react';
import { getPriorityClass, getStatusClass } from '@/types';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const COLORS = ['hsl(217,91%,53%)', 'hsl(199,89%,48%)', 'hsl(142,72%,36%)', 'hsl(38,92%,44%)', 'hsl(0,84%,50%)'];

export default function CitizenDashboard() {
  const { currentUser, myComplaints, refreshComplaints } = useApp();
  const { t } = useTranslation();

  useEffect(() => { refreshComplaints(); }, []);

  // myComplaints is already filtered to this citizen (from AppContext)
  const resolved   = useMemo(() => myComplaints.filter(c => c.status === 'Resolved').length, [myComplaints]);
  const inProgress = useMemo(() => myComplaints.filter(c => c.status === 'In Progress' || c.status === 'Under Review').length, [myComplaints]);

  const catData = useMemo(() => Object.entries(
    myComplaints.reduce((acc, c) => { acc[c.category] = (acc[c.category] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value })), [myComplaints]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const monthData = useMemo(() => months.map((m, i) => ({
    month: m,
    count: myComplaints.filter(c => {
      const d = new Date(c.createdAt);
      return d.getMonth() === i;
    }).length,
  })), [myComplaints]);

  const statusColor = (s: string) => {
    if (s === 'Resolved')     return 'bg-green-500';
    if (s === 'In Progress')  return 'bg-blue-500 animate-pulse';
    if (s === 'Under Review') return 'bg-yellow-500 animate-pulse';
    if (s === 'Rejected')     return 'bg-red-500';
    return 'bg-gray-400';
  };

  return (
    <CitizenLayout>
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: FileText,   label: t('citizen.dashboard.myReports'),  value: myComplaints.length,    color: 'text-accent'  },
            { icon: CheckCircle,label: t('citizen.dashboard.resolved'),   value: resolved,               color: 'text-success' },
            { icon: Clock,      label: t('citizen.dashboard.inProgress'), value: inProgress,             color: 'text-warning' },
            { icon: Star,       label: t('citizen.dashboard.myPoints'),   value: currentUser?.points||0, color: 'text-accent'  },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 flex-wrap">
          <Button variant="hero" size="sm" asChild>
            <Link to="/citizen/report"><Plus className="h-4 w-4" /> {t('citizen.quickActions.reportIssue')}</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/citizen/track"><Search className="h-4 w-4" /> {t('citizen.quickActions.trackStatus')}</Link>
          </Button>
          <Button variant="destructive" size="sm" asChild>
            <Link to="/citizen/sos"><AlertTriangle className="h-4 w-4" /> {t('citizen.quickActions.sos')}</Link>
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Complaints list */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="font-heading font-semibold">{t('citizen.dashboard.myComplaints')}</h3>
            {myComplaints.length === 0 && (
              <div className="card-elevated p-8 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{t('citizen.dashboard.noComplaintsTitle')}</p>
                <p className="text-sm mt-1">{t('citizen.dashboard.noComplaintsDesc')}</p>
              </div>
            )}
            {myComplaints.map(c => (
              <Link
                key={c.id || c._id}
                to={`/citizen/track?id=${c.complaintId || c.id}`}
                className="card-elevated p-4 flex items-center gap-4 block hover:shadow-md transition-shadow"
              >
                <div className={`h-3 w-3 rounded-full flex-shrink-0 ${statusColor(c.status)}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="mono-id text-xs">{c.complaintId || c.id}</span>
                    {c.isSOS && <span className="badge-pill bg-destructive text-destructive-foreground text-[10px]">🚨 SOS</span>}
                  </div>
                  <p className="font-medium text-sm truncate">{c.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="badge-pill bg-muted text-muted-foreground text-xs">{c.category}</span>
                    <span className={getPriorityClass(c.priority)}>{c.priority}</span>
                    <span className={getStatusClass(c.status)}>{c.status}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{c.createdAt}</span>
              </Link>
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {/* Profile card */}
            <div className="card-elevated p-5 text-center">
              <div className="h-16 w-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center mx-auto text-2xl font-bold mb-3">
                {currentUser?.name?.[0]}
              </div>
              <h4 className="font-heading font-semibold">{currentUser?.name}</h4>
              <p className="text-xs text-muted-foreground">{t('citizen.ward', { ward: currentUser?.ward || '—' })}</p>
              <div className={`inline-block mt-2 badge-pill ${
                currentUser?.badge === 'Gold'   ? 'bg-yellow-100 text-yellow-700' :
                currentUser?.badge === 'Silver' ? 'bg-slate-100 text-slate-600'  :
                                                  'bg-amber-100 text-amber-700'
              }`}>
                {currentUser?.badge === 'Gold' ? '🥇' : currentUser?.badge === 'Silver' ? '🥈' : '🥉'} {currentUser?.badge}
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>{t('citizen.dashboard.pts', { count: currentUser?.points || 0 })}</span>
                  <span className="text-muted-foreground">
                    {t('citizen.dashboard.max', { count: currentUser?.badge === 'Gold' ? '1000+' : currentUser?.badge === 'Silver' ? '1000' : '500' })}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((currentUser?.points || 0) % 500) / 5)}%` }}
                  />
                </div>
              </div>
            </div>

            {catData.length > 0 && (
              <div className="card-elevated p-4">
                <h4 className="text-sm font-heading font-semibold mb-3">{t('citizen.dashboard.byCategory')}</h4>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={catData} dataKey="value" cx="50%" cy="50%" outerRadius={60} label={({ name }) => name}>
                      {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="card-elevated p-4">
              <h4 className="text-sm font-heading font-semibold mb-3">{t('citizen.dashboard.monthlySubmissions')}</h4>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={monthData}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Bar dataKey="count" fill="hsl(217,91%,53%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </CitizenLayout>
  );
}