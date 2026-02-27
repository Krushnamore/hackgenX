import { useApp } from '@/context/AppContext';
import CitizenLayout from '@/components/CitizenLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Gift, Star, Trophy, Calendar } from 'lucide-react';

const EVENTS = [
  { title: 'Clean Ward Challenge', desc: 'Report 5 sanitation issues this month', reward: '+200 pts', deadline: '2026-03-15', icon: '🧹' },
  { title: 'Road Safety Week', desc: 'Help identify road hazards in your ward', reward: '+150 pts', deadline: '2026-03-01', icon: '🛣️' },
  { title: 'Water Conservation Drive', desc: 'Report water waste and leaks', reward: '+100 pts', deadline: '2026-03-20', icon: '💧' },
];

const POINTS_TABLE = [
  { action: 'Submit a complaint', points: '+50' },
  { action: 'Complaint resolved', points: '+100' },
  { action: 'Give feedback', points: '+25' },
  { action: 'Support an issue', points: '+10' },
];

export default function CitizenRewards() {
  const { currentUser } = useApp();
  const { toast } = useToast();

  const badges = [
    { name: 'Bronze', min: 0, icon: '🥉', active: (currentUser?.points || 0) >= 0 },
    { name: 'Silver', min: 500, icon: '🥈', active: (currentUser?.points || 0) >= 500 },
    { name: 'Gold', min: 1000, icon: '🥇', active: (currentUser?.points || 0) >= 1000 },
  ];

  return (
    <CitizenLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-heading font-bold">Rewards & Events</h1>

        {/* My rewards */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-14 w-14 rounded-full bg-warning/20 flex items-center justify-center text-2xl">
              {currentUser?.badge === 'Gold' ? '🥇' : currentUser?.badge === 'Silver' ? '🥈' : '🥉'}
            </div>
            <div>
              <h3 className="font-heading font-semibold text-lg">{currentUser?.name}</h3>
              <p className="text-sm text-muted-foreground">{currentUser?.points} points • {currentUser?.badge} Badge</p>
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            {badges.map(b => (
              <div key={b.name} className={`flex-1 text-center p-3 rounded-lg border ${b.active ? 'border-accent bg-accent/5' : 'border-border opacity-50'}`}>
                <span className="text-2xl">{b.icon}</span>
                <p className="text-xs font-medium mt-1">{b.name}</p>
                <p className="text-[10px] text-muted-foreground">{b.min}+ pts</p>
              </div>
            ))}
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent to-sky rounded-full transition-all" style={{ width: `${Math.min(100, ((currentUser?.points || 0) / 1500) * 100)}%` }} />
          </div>
        </div>

        {/* Events */}
        <h2 className="font-heading font-semibold text-lg flex items-center gap-2"><Calendar className="h-5 w-5 text-accent" /> Active Events</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {EVENTS.map((e, i) => (
            <div key={i} className="card-elevated p-4">
              <div className="text-3xl mb-2">{e.icon}</div>
              <h3 className="font-heading font-semibold text-sm">{e.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{e.desc}</p>
              <div className="flex items-center justify-between">
                <span className="badge-pill bg-success/10 text-success">{e.reward}</span>
                <span className="text-[10px] text-muted-foreground">by {e.deadline}</span>
              </div>
              <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => toast({ title: '🎯 Participating!', description: e.title })}>Participate</Button>
            </div>
          ))}
        </div>

        {/* Points table */}
        <h2 className="font-heading font-semibold text-lg flex items-center gap-2"><Star className="h-5 w-5 text-warning" /> How to Earn Points</h2>
        <div className="card-elevated overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {POINTS_TABLE.map((p, i) => (
                <tr key={i} className="border-t border-border first:border-0">
                  <td className="p-3">{p.action}</td>
                  <td className="p-3 text-right font-semibold text-success">{p.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button variant="outline" className="w-full" onClick={() => toast({ title: '🔜 Coming Soon!', description: 'Redeem feature launching next month.' })}>
          <Gift className="h-4 w-4" /> Redeem Points
        </Button>
      </div>
    </CitizenLayout>
  );
}
