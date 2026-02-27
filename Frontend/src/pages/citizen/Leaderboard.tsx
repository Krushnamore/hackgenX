import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import CitizenLayout from '@/components/CitizenLayout';
import { Trophy, Medal, Star } from 'lucide-react';
import { WARDS } from '@/types';

export default function CitizenLeaderboard() {
  const { users, currentUser, refreshLeaderboard } = useApp();
  const [ward, setWard] = useState(0);

  useEffect(() => { refreshLeaderboard(ward || undefined); }, [ward]);

  const citizens = [...users]
    .filter(u => u.role === 'citizen' && (ward === 0 || Number(u.ward) === ward))
    .sort((a, b) => (b.points || 0) - (a.points || 0));

  const top3   = citizens.slice(0, 3);
  const uid    = currentUser?.id || currentUser?._id;
  const myRank = citizens.findIndex(u => u.id === uid || u._id === uid) + 1;

  const badgeIcon  = (b?: string) => b === 'Gold' ? '🥇' : b === 'Silver' ? '🥈' : '🥉';
  const badgeColor = (b?: string) =>
    b === 'Gold'   ? 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20' :
    b === 'Silver' ? 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800/30' :
                     'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20';

  // Podium display order: silver (2nd), gold (1st), bronze (3rd)
  const podiumOrder  = [1, 0, 2];
  const podiumHeight = ['h-20', 'h-32', 'h-14'];
  const podiumBg     = [
    'bg-gradient-to-b from-slate-300 to-slate-400',
    'bg-gradient-to-b from-yellow-400 to-yellow-500',
    'bg-gradient-to-b from-amber-500 to-amber-600',
  ];
  const avatarGlow   = [
    'ring-4 ring-slate-400 shadow-[0_0_14px_rgba(148,163,184,0.55)]',
    'ring-4 ring-yellow-400 ring-offset-2 shadow-[0_0_24px_rgba(250,204,21,0.7)]',
    'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(217,119,6,0.45)]',
  ];
  const avatarBg     = [
    'bg-slate-100 text-slate-700',
    'bg-yellow-100 text-yellow-700',
    'bg-amber-100 text-amber-700',
  ];
  const rankLabel    = ['#2', '#1', '#3'];

  return (
    <CitizenLayout>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" /> Leaderboard
          </h1>
          <select
            value={ward}
            onChange={e => setWard(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={0}>All Wards</option>
            {WARDS.map(w => <option key={w} value={w}>Ward {w}</option>)}
          </select>
        </div>

        {/* ═══════════════════════════════════════
            TOP 3 PODIUM with glow effects
        ═══════════════════════════════════════ */}
        {top3.length > 0 && (
          <div className="relative rounded-2xl overflow-hidden">
            {/* Ambient background */}
            <div className="absolute inset-0 bg-gradient-to-b from-yellow-50/80 via-background to-transparent dark:from-yellow-900/15 pointer-events-none" />

            <div className="relative flex items-end justify-center gap-4 py-10 px-6">
              {podiumOrder.map((rank0, posIdx) => {
                const u = top3[rank0];
                if (!u) return <div key={posIdx} className="flex-1 max-w-[130px]" />;

                const isMe = u.id === uid || u._id === uid;
                const isFirst = rank0 === 0;

                return (
                  <div key={posIdx} className={`flex flex-col items-center flex-1 max-w-[130px] ${isFirst ? 'z-10' : 'z-0'}`}>

                    {/* Crown only for 1st */}
                    {isFirst && <div className="text-3xl mb-1 drop-shadow-lg" style={{ animation: 'bounce 1.5s infinite' }}>👑</div>}

                    {/* Avatar with glow */}
                    <div className={`
                      ${isFirst ? 'h-16 w-16 text-2xl' : 'h-12 w-12 text-lg'}
                      rounded-full flex items-center justify-center font-bold
                      ${avatarBg[rank0]} ${avatarGlow[rank0]}
                      ${isMe ? 'outline outline-2 outline-accent outline-offset-2' : ''}
                      transition-all
                    `}>
                      {u.name?.[0]?.toUpperCase() || '?'}
                    </div>

                    {/* Name */}
                    <p className={`mt-2 text-center font-semibold truncate max-w-full px-1 ${isFirst ? 'text-sm' : 'text-xs'}`}>
                      {u.name}
                      {isMe && <span className="text-accent ml-1 text-[10px]">(You)</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Ward {u.ward}</p>

                    {/* Points */}
                    <p className={`font-heading font-bold mt-0.5 ${
                      isFirst ? 'text-yellow-600 text-sm' : rank0 === 1 ? 'text-slate-600 text-xs' : 'text-amber-600 text-xs'
                    }`}>
                      {(u.points || 0).toLocaleString()} pts
                    </p>

                    {/* Badge pill */}
                    <span className={`mt-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${badgeColor(u.badge)}`}>
                      {badgeIcon(u.badge)} {u.badge}
                    </span>

                    {/* Podium base */}
                    <div className={`w-full mt-3 ${podiumHeight[rank0]} ${podiumBg[rank0]} rounded-t-lg flex items-center justify-center shadow-md`}>
                      <span className="text-white font-heading font-black text-xl drop-shadow">
                        {rankLabel[posIdx]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            FULL RANKINGS TABLE
        ═══════════════════════════════════════ */}
        <div className="card-elevated overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-accent px-5 py-3 flex items-center gap-2">
            <Medal className="h-4 w-4 text-white" />
            <h3 className="text-white font-heading font-semibold text-sm">
              Full Rankings{ward > 0 && ` — Ward ${ward}`}
            </h3>
            <span className="ml-auto text-white/70 text-xs">{citizens.length} citizens</span>
          </div>

          {citizens.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No citizens registered yet{ward > 0 ? ` in Ward ${ward}` : ''}.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">RANK</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">CITIZEN</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">WARD</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">COMPLAINTS</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground">POINTS</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground">BADGE</th>
                </tr>
              </thead>
              <tbody>
                {citizens.map((u, i) => {
                  const isMe   = u.id === uid || u._id === uid;
                  const rank   = i + 1;
                  const isTop3 = rank <= 3;

                  return (
                    <tr
                      key={u.id || u._id}
                      className={`border-t border-border transition-colors ${
                        isMe     ? 'bg-accent/8 border-l-2 border-l-accent' :
                        isTop3   ? 'bg-yellow-50/30 dark:bg-yellow-900/5 hover:bg-muted/20' :
                                   'hover:bg-muted/20'
                      }`}
                    >
                      {/* Rank */}
                      <td className="p-3">
                        {rank === 1 ? <span className="text-xl">🥇</span> :
                         rank === 2 ? <span className="text-xl">🥈</span> :
                         rank === 3 ? <span className="text-xl">🥉</span> :
                         <span className="font-mono font-bold text-muted-foreground text-sm">#{rank}</span>}
                      </td>

                      {/* Citizen name + avatar */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isTop3 ? 'bg-yellow-100 text-yellow-700' : 'bg-muted text-muted-foreground'
                          }`}>
                            {u.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium flex items-center gap-1.5">
                              {u.name}
                              {isMe && (
                                <span className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">You</span>
                              )}
                            </p>
                            <p className="text-[10px] text-muted-foreground sm:hidden">Ward {u.ward}</p>
                          </div>
                        </div>
                      </td>

                      {/* Ward */}
                      <td className="p-3 text-center hidden sm:table-cell">
                        <span className="badge-pill bg-muted text-muted-foreground">Ward {u.ward}</span>
                      </td>

                      {/* Complaints stats */}
                      <td className="p-3 text-center hidden md:table-cell">
                        <div className="text-xs space-y-0.5">
                          <p className="font-medium">{u.complaintsSubmitted || 0} submitted</p>
                          <p className="text-green-600">{u.complaintsResolved || 0} resolved</p>
                        </div>
                      </td>

                      {/* Points */}
                      <td className="p-3 text-right">
                        <span className={`font-heading font-bold ${isTop3 ? 'text-yellow-600 text-base' : ''}`}>
                          {(u.points || 0).toLocaleString()}
                        </span>
                        <p className="text-[10px] text-muted-foreground">pts</p>
                      </td>

                      {/* Badge */}
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${badgeColor(u.badge)}`}>
                          {badgeIcon(u.badge)} {u.badge}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* My rank sticky footer */}
        {myRank > 0 && (
          <div className="sticky bottom-4 card-elevated p-4 flex items-center justify-between border border-accent/20 bg-accent/5 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold">
                {currentUser?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm">{currentUser?.name}</p>
                <p className="text-xs text-muted-foreground">Ward {currentUser?.ward} · {currentUser?.points || 0} pts · {currentUser?.badge}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Your Rank</p>
              <p className="text-2xl font-heading font-black text-accent">#{myRank}</p>
            </div>
          </div>
        )}

        {/* Points guide */}
        <div className="card-elevated p-5">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" /> How to Earn Points & Badges
          </h3>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { action: '📋 Submit a complaint', pts: '+50 pts' },
              { action: '✅ Complaint resolved', pts: '+100 pts' },
              { action: '⭐ Give feedback',       pts: '+25 pts' },
              { action: '👍 Support an issue',    pts: '+10 pts' },
            ].map(r => (
              <div key={r.action} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                <span className="text-xs">{r.action}</span>
                <span className="font-semibold text-green-600 text-xs">{r.pts}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: '🥉', name: 'Bronze', range: '0–499 pts',   color: 'text-amber-700' },
              { icon: '🥈', name: 'Silver', range: '500–999 pts', color: 'text-slate-500' },
              { icon: '🥇', name: 'Gold',   range: '1000+ pts',   color: 'text-yellow-600' },
            ].map(b => (
              <div key={b.name} className="bg-muted/40 rounded-lg p-2">
                <p className={`font-semibold text-sm ${b.color}`}>{b.icon} {b.name}</p>
                <p className="text-[10px] text-muted-foreground">{b.range}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CitizenLayout>
  );
}