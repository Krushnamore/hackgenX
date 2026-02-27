import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import CitizenLayout from '@/components/CitizenLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Star, MessageSquare } from 'lucide-react';

export default function CitizenFeedback() {
  const { myComplaints, submitFeedback } = useApp();
  const { toast } = useToast();

  // myComplaints already filtered to this citizen — no need to re-filter by citizenId
  const pending   = myComplaints.filter(c => c.status === 'Resolved' && !c.feedback);
  const completed = myComplaints.filter(c => c.feedback);

  const [ratings, setRatings] = useState<Record<string, { stars: number; resolved: string; comment: string }>>({});

  const getR = (id: string) => ratings[id] || { stars: 0, resolved: '', comment: '' };
  const setR = (id: string, update: Partial<typeof ratings[string]>) =>
    setRatings(prev => ({ ...prev, [id]: { ...getR(id), ...update } }));

  const handleSubmit = async (id: string) => {
    const r = getR(id);
    if (!r.stars || !r.resolved) { toast({ title: 'Please rate and select resolution status', variant: 'destructive' }); return; }
    try {
      await submitFeedback(id, { rating: r.stars, comment: r.comment, resolved: r.resolved as any });
      toast({ title: '✅ Feedback submitted! +25 points' });
    } catch (err: any) {
      toast({ title: '❌ ' + (err.message || 'Failed'), variant: 'destructive' });
    }
  };

  const totalRatings = completed.length;
  const avgRating = totalRatings
    ? (completed.reduce((sum, c) => sum + (c.feedback?.rating || 0), 0) / totalRatings).toFixed(1)
    : '—';

  return (
    <CitizenLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-accent" /> Feedback
        </h1>

        <div className="card-elevated p-4 flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-heading font-bold">{avgRating}</p>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-heading font-bold">{totalRatings}</p>
            <p className="text-xs text-muted-foreground">Given</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-heading font-bold">{pending.length}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </div>

        {pending.length > 0 && <h2 className="font-heading font-semibold">Pending Feedback</h2>}
        {pending.map(c => {
          const r = getR(c.id);
          return (
            <div key={c.id} className="card-elevated p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="mono-id">{c.id}</span>
                <span className="badge-status-resolved">Resolved</span>
              </div>
              <h3 className="font-medium">{c.title}</h3>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Was the issue resolved satisfactorily?</p>
                <div className="flex gap-2">
                  {['yes', 'no', 'partially'].map(v => (
                    <button key={v} onClick={() => setR(c.id, { resolved: v })}
                      className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-all ${r.resolved === v ? 'border-accent bg-accent/10 text-accent' : 'border-border'}`}>
                      {v === 'yes' ? '✅ Yes' : v === 'no' ? '❌ No' : '⚠️ Partially'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Rate your experience</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setR(c.id, { stars: s })}>
                      <Star className={`h-6 w-6 transition-colors ${s <= r.stars ? 'text-warning fill-warning' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <Textarea placeholder="Additional comments..." value={r.comment} onChange={e => setR(c.id, { comment: e.target.value })} rows={2} />
              <Button variant="hero" size="sm" onClick={() => handleSubmit(c.id)}>Submit Feedback</Button>
            </div>
          );
        })}

        {pending.length === 0 && completed.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">No resolved complaints to provide feedback on yet.</p>
        )}

        {completed.length > 0 && <h2 className="font-heading font-semibold">Completed Feedback</h2>}
        {completed.map(c => (
          <div key={c.id} className="card-elevated p-4 opacity-80">
            <div className="flex items-center gap-2 mb-1">
              <span className="mono-id">{c.id}</span>
              <span className="text-sm font-medium">{c.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-warning">{'⭐'.repeat(c.feedback?.rating || 0)}</span>
              <span className="text-xs text-muted-foreground">{c.feedback?.comment}</span>
            </div>
          </div>
        ))}
      </div>
    </CitizenLayout>
  );
}