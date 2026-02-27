import { useEffect, useMemo, useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import CitizenLayout from '@/components/CitizenLayout';
import {
  Trophy, Users, TrendingUp, Star, CheckCircle2,
  Filter, RefreshCw, Loader2, Crown,
} from 'lucide-react';

// ─── Ward range from User schema (min:1, max:20) ────────────────
const ALL_WARDS = Array.from({ length: 20 }, (_, i) => i + 1);

// ─── Helpers ────────────────────────────────────────────────────
const getInitials = (name: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const toDay = (d: any): string => {
  try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; }
};

const computeStreak = (complaints: any[]): number => {
  const days = new Set(complaints.map(c => toDay(c.createdAt)).filter(Boolean));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (true) {
    const key = cursor.toISOString().split('T')[0];
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

const badgeEmoji = (badge?: string) =>
  badge === 'Gold' ? '🥇' : badge === 'Silver' ? '🥈' : '🥉';

// ─── Sub-components ──────────────────────────────────────────────

/** City-wide top-3 podium — always shows global leaders regardless of ward filter */
function GlobalPodium({ top3, currentUserId }: { top3: any[]; currentUserId: string }) {
  if (!top3.length) return null;

  // Display order: 2nd (left), 1st (centre), 3rd (right)
  const order = [1, 0, 2];

  const podiumConfig = [
    {
      height: 'h-16', podiumBg: 'from-slate-300 to-slate-400',
      avatarSize: 'h-14 w-14 text-base', ring: 'ring-2 ring-slate-400',
      pointColor: 'text-slate-600', label: '#2',
    },
    {
      height: 'h-24', podiumBg: 'from-yellow-400 to-yellow-500',
      avatarSize: 'h-20 w-20 text-2xl', ring: 'ring-4 ring-yellow-400 ring-offset-2 shadow-[0_0_24px_rgba(250,204,21,0.6)]',
      pointColor: 'text-yellow-600', label: '#1',
    },
    {
      height: 'h-12', podiumBg: 'from-amber-500 to-amber-600',
      avatarSize: 'h-12 w-12 text-sm', ring: 'ring-2 ring-amber-400',
      pointColor: 'text-amber-600', label: '#3',
    },
  ];

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center gap-2 mb-5">
        <Crown className="h-5 w-5 text-yellow-500" />
        <h2 className="font-heading font-semibold">City Champions</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">Overall Nashik</span>
      </div>

      <div className="relative rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-50/80 via-background to-transparent dark:from-yellow-900/10 pointer-events-none" />
        <div className="relative flex items-end justify-center gap-4 py-8 px-4">
          {order.map((rank0, posIdx) => {
            const u = top3[rank0];
            if (!u) return <div key={posIdx} className="flex-1 max-w-[120px]" />;

            const cfg  = podiumConfig[posIdx];
            const isMe = u.id === currentUserId || u._id === currentUserId;
            const isFirst = rank0 === 0;

            return (
              <div key={u.id || u._id || posIdx} className="flex flex-col items-center flex-1 max-w-[130px]">
                {isFirst && (
                  <div className="text-2xl mb-1" style={{ animation: 'bounce 2s infinite' }}>👑</div>
                )}

                <div className={`
                  rounded-full flex items-center justify-center font-bold
                  bg-gradient-to-br from-muted to-background
                  ${cfg.avatarSize} ${cfg.ring}
                  ${isMe ? 'outline outline-2 outline-accent outline-offset-2' : ''}
                `}>
                  {getInitials(u.name)}
                </div>

                <p className={`mt-2 text-center font-semibold truncate max-w-full px-1 ${isFirst ? 'text-sm' : 'text-xs'}`}>
                  {u.name}
                  {isMe && <span className="text-accent text-[10px] ml-1">(You)</span>}
                </p>
                <p className="text-[10px] text-muted-foreground">Ward {u.ward}</p>
                <p className={`font-heading font-bold text-xs mt-0.5 ${cfg.pointColor}`}>
                  {(u.points || 0).toLocaleString()} pts
                </p>
                <span className="text-[10px] mt-1 text-muted-foreground">
                  {badgeEmoji(u.badge)} {u.badge}
                </span>

                {/* Podium base */}
                <div className={`w-full mt-3 ${cfg.height} bg-gradient-to-b ${cfg.podiumBg} rounded-t-lg flex items-center justify-center shadow-md`}>
                  <span className="text-white font-heading font-black text-lg drop-shadow">{cfg.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function CitizenLeaderboard() {
  const { leaderboard, globalTop3, refreshLeaderboard, currentUser, myComplaints } = useApp();

  const [ward,        setWard]        = useState<number>(0);       // 0 = all wards
  const [period,      setPeriod]      = useState<'month' | 'week'>('month');
  const [loading,     setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch from DB whenever ward changes
  const doFetch = useCallback(async (wardNum: number) => {
    setLoading(true);
    try {
      // Pass limit=100 so we see all citizens in a ward, not just 50
      await refreshLeaderboard(wardNum || undefined, 100);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [refreshLeaderboard]);

  useEffect(() => { doFetch(ward); }, [ward]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort & filter the ward list
  const citizens = useMemo(() =>
    (leaderboard || [])
      .filter((u: any) => u.role === 'citizen' || !u.role)
      .slice()
      .sort((a: any, b: any) => (b.points || 0) - (a.points || 0)),
    [leaderboard]
  );

  // Find current user in ranked list
  const myIndex = citizens.findIndex(
    (u: any) => u.id === currentUser?.id || u._id === currentUser?._id
  );
  const myRank   = myIndex >= 0 ? myIndex + 1 : 0;
  const myRow    = myIndex >= 0 ? citizens[myIndex] : null;
  const myPoints = myRow?.points ?? currentUser?.points ?? 0;
  const myStreak = useMemo(() => computeStreak(myComplaints || []), [myComplaints]);
  const uid      = currentUser?.id || currentUser?._id || '';

  // Period-filtered complaints (client-side)
  const periodComplaints = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - (period === 'week' ? 7 : 30));
    return (myComplaints || []).filter(c => new Date(c.createdAt) >= since);
  }, [myComplaints, period]);

  // Gap to person above
  const nextPointsGap = myRank > 1
    ? Math.max(0, (citizens[myRank - 2]?.points || 0) - myPoints) : 0;
  const progressToNext = myRank > 1
    ? Math.min(100, (myPoints / Math.max(1, citizens[myRank - 2]?.points || 1)) * 100) : 100;

  // Achievements
  const hasFirstReport  = (currentUser?.complaintsSubmitted ?? 0) > 0 || (myComplaints?.length ?? 0) > 0;
  const hasResolved     = (currentUser?.complaintsResolved  ?? 0) > 0;
  const hasPeriodReport = periodComplaints.length > 0;

  return (
    <CitizenLayout>
      <div className="space-y-6">

        {/* ── Banner ── */}
        <div className="rounded-2xl bg-gradient-to-r from-warning via-warning/90 to-warning p-6 text-warning-foreground">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-warning-foreground/15 flex items-center justify-center flex-shrink-0">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-heading font-bold leading-tight">Leaderboard</h1>
                <p className="text-warning-foreground/80 text-sm mt-0.5">
                  Live rankings from the JANVANI database · {citizens.length} citizens loaded
                  {lastUpdated && (
                    <span className="ml-2 opacity-60">
                      · Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Ward / Zone filter */}
              <div className="flex items-center gap-1.5 bg-warning-foreground/10 border border-warning-foreground/20 rounded-lg px-3 py-1.5">
                <Filter className="h-3.5 w-3.5 text-warning-foreground/70" />
                <select
                  value={ward}
                  onChange={e => setWard(Number(e.target.value))}
                  className="bg-transparent text-warning-foreground text-sm focus:outline-none"
                >
                  <option value={0}>All Wards</option>
                  {ALL_WARDS.map(w => (
                    <option key={w} value={w}>Zone / Ward {w}</option>
                  ))}
                </select>
              </div>

              {/* Manual refresh */}
              <button
                onClick={() => doFetch(ward)}
                disabled={loading}
                className="h-9 w-9 rounded-lg bg-warning-foreground/10 border border-warning-foreground/20 flex items-center justify-center hover:bg-warning-foreground/20 transition-colors"
                title="Refresh leaderboard"
              >
                {loading
                  ? <Loader2 className="h-4 w-4 text-warning-foreground animate-spin" />
                  : <RefreshCw className="h-4 w-4 text-warning-foreground" />
                }
              </button>
            </div>
          </div>
        </div>

        {/* ── City Champions Podium — always global, never filtered ── */}
        <GlobalPodium top3={globalTop3} currentUserId={uid} />

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left: Ward Rankings ── */}
          <div className="lg:col-span-2 card-elevated p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-warning" />
                <h2 className="font-heading font-semibold">
                  {ward > 0 ? `Zone ${ward} Rankings` : 'City Rankings'}
                </h2>
                {loading && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
              </div>

              {/* Period toggle */}
              <div className="bg-muted rounded-full p-1 flex items-center gap-1 text-sm">
                {(['month', 'week'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-1.5 rounded-full font-medium transition-all ${
                      period === p
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p === 'month' ? 'This Month' : 'This Week'}
                  </button>
                ))}
              </div>
            </div>

            {/* Empty state */}
            {!loading && citizens.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No citizens found{ward > 0 ? ` in Zone ${ward}` : ''}.</p>
                <p className="text-sm mt-1">Try a different zone or check back later.</p>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && citizens.length === 0 && (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-muted/30 p-4 h-16 animate-pulse" />
                ))}
              </div>
            )}

            {/* Ranked list */}
            <div className="space-y-2">
              {citizens.map((u: any, i: number) => {
                const isMe     = u.id === uid || u._id === uid;
                const isTop3   = i < 3;
                // Is this person also in the city-wide top3?
                const cityRank = globalTop3.findIndex(t => t.id === u.id || t._id === u._id);
                const isCityChamp = cityRank >= 0;

                return (
                  <div
                    key={u.id || u._id || i}
                    className={`rounded-xl border p-4 flex items-center justify-between gap-3 transition-colors ${
                      isMe
                        ? 'bg-accent/5 border-accent/30'
                        : isTop3
                          ? 'bg-yellow-50/40 dark:bg-yellow-900/5 border-border hover:bg-muted/20'
                          : 'bg-background border-border hover:bg-muted/20'
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-7 flex-shrink-0 text-center">
                      {i === 0 ? <span className="text-lg">🥇</span>
                        : i === 1 ? <span className="text-lg">🥈</span>
                        : i === 2 ? <span className="text-lg">🥉</span>
                        : <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                      }
                    </div>

                    {/* Avatar */}
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                      isMe ? 'bg-accent text-accent-foreground'
                        : isTop3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-muted text-foreground'
                    }`}>
                      {getInitials(u.name)}
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-sm truncate">{u.name}</p>
                        {isMe && (
                          <span className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full flex-shrink-0">You</span>
                        )}
                        {isCityChamp && !isMe && (
                          <span className="text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-1.5 py-0.5 rounded-full flex-shrink-0">🏙️ City Top 3</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Zone {u.ward}
                        <span className="mx-1">·</span>
                        {u.complaintsSubmitted || 0} reports
                        <span className="mx-1">·</span>
                        {u.complaintsResolved  || 0} resolved
                      </p>
                    </div>

                    {/* Points + badge */}
                    <div className="text-right flex-shrink-0">
                      <p className={`font-heading font-bold text-base leading-none ${isTop3 ? 'text-yellow-600' : 'text-accent'}`}>
                        {(u.points || 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">pts</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {badgeEmoji(u.badge)} {u.badge}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {citizens.length > 0 && (
              <p className="text-xs text-muted-foreground text-center mt-4">
                Showing {citizens.length} citizen{citizens.length !== 1 ? 's' : ''}
                {ward > 0 ? ` in Zone ${ward}` : ' city-wide'} · ranked by all-time points
              </p>
            )}
          </div>

          {/* ── Right: Your Stats + Achievements ── */}
          <div className="space-y-5">

            {/* Stats card */}
            <div className="card-elevated p-5">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="h-5 w-5 text-accent" />
                <h2 className="font-heading font-semibold">Your Stats</h2>
              </div>

              {/* Rank */}
              <div className="text-center mb-5">
                <div className="text-5xl font-heading font-black text-accent">
                  {myRank ? `#${myRank}` : '—'}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {ward > 0 ? `Zone ${ward} Rank` : 'City Rank'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-xl bg-success/10 border border-success/15 p-3 text-center">
                  <div className="text-success font-bold text-lg">{myPoints.toLocaleString()}</div>
                  <div className="text-xs text-success/80">Total Points</div>
                </div>
                <div className="rounded-xl bg-sky/10 border border-sky/15 p-3 text-center">
                  <div className="font-bold text-lg" style={{ color: 'hsl(199,89%,48%)' }}>{myStreak}</div>
                  <div className="text-xs text-muted-foreground">Day Streak</div>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 border border-border p-3 text-center mb-3">
                <div className="font-bold text-lg">{periodComplaints.length}</div>
                <div className="text-xs text-muted-foreground">
                  Reports {period === 'month' ? 'This Month' : 'This Week'}
                </div>
              </div>

              {/* Progress to next rank */}
              <div className="rounded-xl bg-accent/5 border border-accent/10 p-4">
                <div className="text-sm font-semibold text-accent">
                  {myRank <= 1 ? "🏆 You're #1!" : 'Points to next rank'}
                </div>
                <div className="text-xl font-heading font-bold text-accent mt-1">
                  {myRank <= 1 ? 'Keep it up!' : `${nextPointsGap.toLocaleString()} pts`}
                </div>
                <div className="mt-3 h-2 rounded-full bg-accent/15 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700"
                    style={{ width: `${progressToNext}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Achievements */}
            <div className="card-elevated p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 text-warning" />
                <h2 className="font-heading font-semibold">Achievements</h2>
              </div>
              <div className="space-y-3">
                {[
                  {
                    label: 'First Report 📋',
                    sub: 'Submit your first civic issue',
                    unlocked: hasFirstReport,
                    progress: null,
                  },
                  {
                    label: 'Issue Resolved ✅',
                    sub: 'Have a complaint marked resolved',
                    unlocked: hasResolved,
                    progress: null,
                  },
                  {
                    label: `Active ${period === 'month' ? 'Month' : 'Week'} 🔥`,
                    sub: `Report an issue in the current ${period}`,
                    unlocked: hasPeriodReport,
                    progress: null,
                  },
                  {
                    label: '3-Day Streak 🌟',
                    sub: 'Report on 3 consecutive days',
                    unlocked: myStreak >= 3,
                    progress: myStreak < 3 ? `${myStreak}/3` : null,
                  },
                ].map(a => (
                  <div
                    key={a.label}
                    className={`rounded-xl p-3 flex items-center justify-between gap-3 border ${
                      a.unlocked
                        ? 'bg-success/10 border-success/15'
                        : 'bg-muted/30 border-border opacity-60'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{a.label}</p>
                      <p className="text-xs text-muted-foreground">{a.sub}</p>
                    </div>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      a.unlocked ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                    }`}>
                      {a.unlocked
                        ? <CheckCircle2 className="h-4 w-4" />
                        : <span className="text-xs font-semibold">{a.progress ?? '0%'}</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Points guide */}
            <div className="card-elevated p-4">
              <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-warning" /> How to Earn Points
              </h3>
              <div className="space-y-2">
                {[
                  { action: '📋 Submit a complaint', pts: '+50 pts' },
                  { action: '✅ Complaint resolved',  pts: '+100 pts' },
                  { action: '⭐ Give feedback',        pts: '+25 pts' },
                  { action: '👍 Support an issue',     pts: '+10 pts' },
                ].map(r => (
                  <div key={r.action} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                    <span className="text-xs">{r.action}</span>
                    <span className="font-semibold text-green-600 text-xs">{r.pts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CitizenLayout>
  );
}