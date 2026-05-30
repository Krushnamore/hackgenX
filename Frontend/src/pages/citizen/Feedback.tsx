/**
 * Frontend/src/pages/citizen/Feedback.tsx
 * Citizen submits feedback on resolved complaints.
 * Notification sent to: superadmin + dept channel of that complaint.
 */

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import CitizenLayout from '@/components/CitizenLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { complaintAPI } from '@/lib/api';
import { addNotification, deptKey } from '@/hooks/useNotifications';
import { Star, CheckCircle, MessageSquare } from 'lucide-react';

export default function CitizenFeedback() {
  const { myComplaints, currentUser } = useApp();
  const { toast } = useToast();

  const resolved = myComplaints.filter(c => c.status === 'Resolved' && !c.feedback?.rating);
  const [selected,   setSelected]   = useState<any>(null);
  const [rating,     setRating]     = useState(0);
  const [hovered,    setHovered]    = useState(0);
  const [comment,    setComment]    = useState('');
  const [resolved2,  setResolved2]  = useState('yes');
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState<string[]>([]);

  const handleSubmit = async () => {
    if (!selected || !rating) {
      toast({ title: 'Please select a complaint and rating', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await complaintAPI.feedback(selected.id || selected._id, {
        rating,
        comment,
        resolved: resolved2,
      });

      // Notify superadmin
      addNotification('superadmin', {
        type   : 'status_change',
        title  : '⭐ Feedback Received',
        message: `${currentUser?.name || 'Citizen'} rated complaint "${selected.title}" ${rating}/5. ${comment ? `Comment: "${comment}"` : ''}`,
        link   : '/admin/complaints',
        meta   : { complaintId: selected.id, rating },
      });

      // Notify department admin
      if (selected.department) {
        addNotification(deptKey(selected.department), {
          type   : 'status_change',
          title  : '⭐ Feedback on Your Resolved Complaint',
          message: `"${selected.title}" rated ${rating}/5 by ${currentUser?.name || 'Citizen'}. ${comment ? `"${comment}"` : ''}`,
          link   : '/admin/complaints',
          meta   : { complaintId: selected.id, rating },
        });
      }

      // Also notify all admins
      addNotification('admins', {
        type   : 'status_change',
        title  : '⭐ New Feedback',
        message: `"${selected.title}" rated ${rating}/5 by ${currentUser?.name || 'Citizen'}.`,
        link   : '/admin/complaints',
      });

      toast({ title: '✅ Feedback submitted! Thank you.' });
      setDone(prev => [...prev, selected.id]);
      setSelected(null);
      setRating(0);
      setComment('');
    } catch (err: any) {
      toast({ title: '❌ ' + err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const pending = resolved.filter(c => !done.includes(c.id));

  return (
    <CitizenLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">Feedback</h1>
          <p className="text-muted-foreground text-sm mt-1">Rate resolved complaints to help improve our services.</p>
        </div>

        {pending.length === 0 ? (
          <div className="card-elevated p-10 text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No pending feedback</p>
            <p className="text-sm mt-1">You'll be able to rate complaints once they're resolved.</p>
          </div>
        ) : (
          <>
            {/* Complaint selector */}
            <div className="card-elevated p-5 space-y-3">
              <h3 className="font-semibold text-sm">Select Complaint</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pending.map(c => (
                  <button key={c.id} onClick={() => setSelected(c)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selected?.id === c.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}>
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.complaintId || c.id} · {c.category}</p>
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <div className="card-elevated p-5 space-y-5">
                <h3 className="font-semibold">Rate: <span className="text-primary">{selected.title}</span></h3>

                {/* Star rating */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Overall Satisfaction</p>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => (
                      <button key={s}
                        onClick={() => setRating(s)}
                        onMouseEnter={() => setHovered(s)}
                        onMouseLeave={() => setHovered(0)}
                        className="transition-transform hover:scale-110">
                        <Star className={`h-8 w-8 ${
                          s <= (hovered || rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground'
                        }`} />
                      </button>
                    ))}
                    {rating > 0 && (
                      <span className="ml-2 self-center text-sm font-medium text-muted-foreground">
                        {['','Poor','Fair','Good','Very Good','Excellent'][rating]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Was it resolved? */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Was your issue actually resolved?</p>
                  <div className="flex gap-3">
                    {['yes','no','partial'].map(opt => (
                      <button key={opt} onClick={() => setResolved2(opt)}
                        className={`px-4 py-2 rounded-lg border-2 text-sm font-medium capitalize transition-all ${
                          resolved2 === opt ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'
                        }`}>
                        {opt === 'yes' ? '✅ Yes' : opt === 'no' ? '❌ No' : '⚠️ Partially'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Additional Comments <span className="opacity-60">(optional)</span></p>
                  <Textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Share your experience with the resolution process..."
                    rows={3}
                  />
                </div>

                <Button variant="hero" onClick={handleSubmit} disabled={submitting || !rating} className="w-full">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {submitting ? 'Submitting…' : 'Submit Feedback'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </CitizenLayout>
  );
}