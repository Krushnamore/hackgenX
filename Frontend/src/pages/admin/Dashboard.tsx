import { useApp } from '@/context/AppContext';
import AdminLayout from '@/components/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { FileStack, CheckCircle, AlertTriangle, Clock, Users, Star, Brain, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { CATEGORIES } from '@/types';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const COLORS = [
  'hsl(217,91%,53%)', 'hsl(199,89%,48%)', 'hsl(142,72%,36%)',
  'hsl(38,92%,44%)', 'hsl(0,84%,50%)', 'hsl(270,75%,55%)'
];

const STATUS_COLORS: Record<string, string> = {
  'Submitted': 'hsl(217,91%,53%)',
  'Under Review': 'hsl(38,92%,44%)',
  'In Progress': 'hsl(199,89%,48%)',
  'Resolved': 'hsl(142,72%,36%)',
  'Rejected': 'hsl(0,84%,50%)',
};

export default function AdminDashboard() {
  const { complaints, users } = useApp();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const locale = i18n.language === 'hi' ? 'hi-IN' : i18n.language === 'mr' ? 'mr-IN' : 'en-IN';

  const today = new Date().toISOString().split('T')[0];

  // ── Real computed stats ──────────────────────────────────────────────────
  const resolvedToday = complaints.filter(c => c.status === 'Resolved' && c.updatedAt === today).length;
  const criticalPending = complaints.filter(c => c.priority === 'Critical' && c.status !== 'Resolved' && c.status !== 'Rejected').length;
  const activeCitizens = users.filter(u => u.role === 'citizen').length;
  const feedbacks = complaints.filter(c => c.feedback);
  const avgSat = feedbacks.length
    ? (feedbacks.reduce((s, c) => s + (c.feedback?.rating || 0), 0) / feedbacks.length * 20).toFixed(0)
    : '0';

  // Average resolution time (days between createdAt and updatedAt for Resolved complaints)
  const resolved = complaints.filter(c => c.status === 'Resolved' && c.createdAt && c.updatedAt);
  const avgResolutionDays = resolved.length
    ? (resolved.reduce((sum, c) => {
        const diff = new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime();
        return sum + diff / (1000 * 60 * 60 * 24);
      }, 0) / resolved.length).toFixed(1)
    : '—';

  // ── Chart data ───────────────────────────────────────────────────────────
  const catData = CATEGORIES.map((cat, i) => ({
    name: cat.length > 12 ? cat.slice(0, 12) + '…' : cat,
    fullName: cat,
    count: complaints.filter(c => c.category === cat).length,
    fill: COLORS[i % COLORS.length],
  }));

  const statusData = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected'].map(s => ({
    name: s,
    count: complaints.filter(c => c.status === s).length,
  })).filter(d => d.count > 0);

  // Real 7-day volume from data
  const dayData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    return {
      day: d.toLocaleDateString(locale, { weekday: 'short' }),
      Submitted: complaints.filter(c => c.createdAt === dateStr).length,
      Resolved: complaints.filter(c => c.status === 'Resolved' && c.updatedAt === dateStr).length,
    };
  }), [complaints, locale]);

  // Priority breakdown
  const priorityData = ['Critical', 'High', 'Medium', 'Low'].map(p => ({
    name: p,
    count: complaints.filter(c => c.priority === p).length,
  }));

  // Zone heatmap (predefined 5 zones)
  const zoneCounts = Array.from({ length: 5 }, (_, i) => ({
    zone: i + 1,
    count: complaints.filter(c => c.ward === i + 1).length,
    resolved: complaints.filter(c => c.ward === i + 1 && c.status === 'Resolved').length,
    pending: complaints.filter(c => c.ward === i + 1 && c.status !== 'Resolved' && c.status !== 'Rejected').length,
  }));
  const maxZone = Math.max(...zoneCounts.map(z => z.count), 1);

  // AI Insights (real data driven)
  const hotspotZone = zoneCounts.reduce((prev, curr) => curr.count > prev.count ? curr : prev, zoneCounts[0]);
  const mostCommonCat = catData.reduce((prev, curr) => curr.count > prev.count ? curr : prev, catData[0]);
  const unresolvedSOS = complaints.filter(c => c.isSOS && c.status !== 'Resolved').length;

  // ── Zone click → navigate to complaints with zone filter ─────────────────
  const handleZoneClick = (zone: number) => {
    navigate(`/admin/complaints?zone=${zone}`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold">{t('admin.dashboardTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.lastUpdated', { time: new Date().toLocaleString(locale) })}</p>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { icon: FileStack, label: t('admin.stats.totalComplaints'), value: complaints.length, color: 'text-accent', bg: 'bg-accent/10', trend: null },
            { icon: CheckCircle, label: t('admin.stats.resolvedToday'), value: resolvedToday, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', trend: null },
            { icon: AlertTriangle, label: t('admin.stats.criticalPending'), value: criticalPending, color: 'text-destructive', bg: 'bg-destructive/10', trend: criticalPending > 0 ? 'up' : 'down' },
            { icon: Clock, label: t('admin.stats.avgResolution'), value: `${avgResolutionDays}d`, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', trend: null },
            { icon: Users, label: t('admin.stats.activeCitizens'), value: activeCitizens, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20', trend: null },
            { icon: Star, label: t('admin.stats.satisfaction'), value: `${avgSat}%`, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', trend: null },
          ].map((s, i) => (
            <div key={i} className="stat-card group hover:shadow-md transition-shadow">
              <div className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="text-xl font-heading font-bold">{s.value}</p>
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                {s.trend === 'up' && <TrendingUp className="h-3 w-3 text-destructive" />}
                {s.trend === 'down' && <TrendingDown className="h-3 w-3 text-green-500" />}
              </div>
            </div>
          ))}
        </div>

        {/* ── Zone Heatmap (Clickable) ── */}
        <div className="card-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold">{t('admin.zoneHeatmap')}</h3>
            <p className="text-xs text-muted-foreground">{t('admin.clickZoneToFilter')}</p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {zoneCounts.map(z => {
              const intensity = maxZone > 0 ? z.count / maxZone : 0;
              const isDark = intensity > 0.5;
              return (
                <button
                  key={z.zone}
                  onClick={() => handleZoneClick(z.zone)}
                  className="rounded-lg p-3 text-center transition-all hover:scale-105 hover:shadow-md active:scale-95 cursor-pointer relative group"
                  style={{
                    backgroundColor: `hsl(217, 91%, ${100 - intensity * 47}%)`,
                    color: isDark ? 'white' : 'inherit',
                  }}
                  title={`Zone ${z.zone}: ${z.count} total, ${z.pending} pending, ${z.resolved} resolved`}
                >
                  <p className="text-xs font-medium">Z{z.zone}</p>
                  <p className="text-lg font-bold">{z.count}</p>
                  <div className="absolute inset-0 rounded-lg bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{t('admin.view')}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 justify-end">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(217,91%,95%)' }} /> {t('admin.low')}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(217,91%,53%)' }} /> {t('admin.high')}
            </div>
          </div>
        </div>

        {/* ── Charts Row 1 ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* By Category */}
          <div className="card-elevated p-5">
            <h3 className="font-heading font-semibold mb-4">{t('admin.complaintsByCategory')}</h3>
            {complaints.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">{t('admin.noDataYet')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={catData} margin={{ left: -10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(val, _, props) => [val, props.payload.fullName]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {catData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 7-Day Volume */}
          <div className="card-elevated p-5">
            <h3 className="font-heading font-semibold mb-4">{t('admin.sevenDayVolume')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dayData} margin={{ left: -10 }}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Submitted" stroke="hsl(217,91%,53%)" strokeWidth={2} dot={{ fill: 'hsl(217,91%,53%)', r: 3 }} />
                <Line type="monotone" dataKey="Resolved" stroke="hsl(142,72%,36%)" strokeWidth={2} dot={{ fill: 'hsl(142,72%,36%)', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Charts Row 2 ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <div className="card-elevated p-5">
            <h3 className="font-heading font-semibold mb-4">{t('admin.statusDistribution')}</h3>
            {statusData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">{t('admin.noDataYet')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={({ name, count }) => count > 0 ? `${name} (${count})` : ''}
                    labelLine={false}
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Priority Breakdown */}
          <div className="card-elevated p-5">
            <h3 className="font-heading font-semibold mb-4">Priority Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={priorityData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={65} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {priorityData.map((_, i) => (
                    <Cell key={i} fill={['hsl(0,84%,50%)', 'hsl(38,92%,44%)', 'hsl(217,91%,53%)', 'hsl(142,72%,36%)'][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Bottom Row ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* AI Intelligence */}
          <div className="card-elevated p-5">
            <h3 className="font-heading font-semibold mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-accent" /> AI Intelligence
            </h3>
            <div className="space-y-3">
              {[
                {
                  title: '🎯 Priority Alert',
                  desc: criticalPending > 0
                    ? `${criticalPending} critical complaint${criticalPending > 1 ? 's' : ''} need immediate attention.`
                    : 'No critical complaints pending. Great work!',
                  color: criticalPending > 0 ? 'border-l-destructive bg-destructive/5' : 'border-l-green-500 bg-green-50 dark:bg-green-900/10',
                },
                {
                  title: '🔥 Hotspot Zone',
                  desc: hotspotZone.count > 0
                    ? `Zone ${hotspotZone.zone} has the most complaints (${hotspotZone.count} total, ${hotspotZone.pending} pending).`
                    : 'No zone hotspot detected.',
                  color: 'border-l-orange-400 bg-orange-50 dark:bg-orange-900/10',
                },
                {
                  title: '📊 Top Category',
                  desc: mostCommonCat.count > 0
                    ? `"${mostCommonCat.fullName}" has the highest complaint count (${mostCommonCat.count}).`
                    : 'No category data yet.',
                  color: 'border-l-accent bg-accent/5',
                },
                {
                  title: '🚨 SOS Alerts',
                  desc: unresolvedSOS > 0
                    ? `${unresolvedSOS} unresolved SOS complaint${unresolvedSOS > 1 ? 's' : ''} require immediate action!`
                    : 'No unresolved SOS complaints.',
                  color: unresolvedSOS > 0 ? 'border-l-destructive bg-destructive/5' : 'border-l-green-500 bg-green-50 dark:bg-green-900/10',
                },
                {
                  title: '⭐ Satisfaction Score',
                  desc: feedbacks.length > 0
                    ? `Current satisfaction: ${avgSat}% based on ${feedbacks.length} feedback${feedbacks.length > 1 ? 's' : ''}.`
                    : 'No citizen feedback received yet.',
                  color: 'border-l-yellow-400 bg-yellow-50 dark:bg-yellow-900/10',
                },
              ].map((insight, i) => (
                <div key={i} className={`border-l-4 rounded-r-lg p-3 ${insight.color}`}>
                  <p className="text-sm font-semibold">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{insight.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Complaints */}
          <div className="card-elevated p-5">
            <h3 className="font-heading font-semibold mb-4">Recent Complaints</h3>
            <div className="space-y-2">
              {complaints.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No complaints yet</p>
              )}
              {complaints.slice(0, 8).map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/complaints?id=${c.id}`)}
                >
                  <span className="mono-id text-[10px]">{c.id}</span>
                  <span className="flex-1 text-sm truncate">{c.title}</span>
                  <span className={`badge-pill text-[10px] ${
                    c.priority === 'Critical' ? 'bg-destructive text-destructive-foreground'
                    : c.priority === 'High' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                    : 'bg-muted text-muted-foreground'
                  }`}>{c.priority}</span>
                  <span className={`badge-pill text-[10px] ${
                    c.status === 'Resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>{c.status}</span>
                  {c.isSOS && <span className="text-xs">🚨</span>}
                </div>
              ))}
            </div>
            {complaints.length > 8 && (
              <button
                className="mt-3 text-xs text-accent hover:underline w-full text-center"
                onClick={() => navigate('/admin/complaints')}
              >
                View all {complaints.length} complaints →
              </button>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}