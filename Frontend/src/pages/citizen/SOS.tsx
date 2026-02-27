import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import CitizenLayout from '@/components/CitizenLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Phone, X } from 'lucide-react';
import { getStatusClass } from '@/types';

const SOS_TYPES = [
  { type: 'Fire',         icon: '🔥', color: 'border-destructive hover:bg-destructive/5' },
  { type: 'Flood',        icon: '🌊', color: 'border-accent hover:bg-accent/5' },
  { type: 'Electric',     icon: '⚡', color: 'border-warning hover:bg-warning/5' },
  { type: 'Structural',   icon: '🏗️', color: 'border-foreground/30 hover:bg-muted' },
  { type: 'Road Accident',icon: '🚧', color: 'border-destructive hover:bg-destructive/5' },
  { type: 'Health',       icon: '💊', color: 'border-success hover:bg-success/5' },
];

const HELPLINES = [
  { name: 'Fire',      number: '101',           icon: '🔥' },
  { name: 'Ambulance', number: '108',           icon: '🚑' },
  { name: 'Police',    number: '100',           icon: '🚔' },
  { name: 'NDRF',      number: '011-24363260',  icon: '🆘' },
];

export default function CitizenSOS() {
  const { currentUser, addComplaint, myComplaints } = useApp();
  const { toast } = useToast();
  const [modal, setModal] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // myComplaints already filtered to this citizen
  const mySOSComplaints = myComplaints.filter(c => c.isSOS);

  const handleSOS = async () => {
    if (!currentUser || !modal || submitting) return;
    setSubmitting(true);
    try {
      const complaint = await addComplaint({
        citizenId    : currentUser._id || currentUser.id,
        citizenName  : currentUser.name,
        citizenPhone : currentUser.phone,
        title        : `🚨 SOS: ${modal} Emergency`,
        description  : desc || `Emergency ${modal} situation reported`,
        category     : modal === 'Fire' || modal === 'Electric' ? 'Electricity' : modal === 'Flood' ? 'Water' : 'Other',
        priority     : 'Critical',
        status       : 'Submitted',
        ward         : currentUser.ward || 1,
        location     : `Ward ${currentUser.ward}, Nashik`,
        gpsCoords    : { lat: 20.0059, lng: 73.7897 },
        photo: '', resolvePhoto: '', adminNote: '', assignedOfficer: '', department: 'Emergency',
        mergedCount: 0, supportCount: 0,
        estimatedResolution: new Date().toISOString().split('T')[0],
        timeline: [
          { label: 'Submitted',    done: true,  date: new Date().toISOString().split('T')[0] },
          { label: 'Under Review', done: false, date: null },
          { label: 'In Progress',  done: false, date: null },
          { label: 'Resolved',     done: false, date: null },
        ],
        feedback: null, isSOS: true, sosType: modal,
      });
      toast({ title: '🚨 SOS Alert Sent!', description: `${modal} emergency reported. ID: ${complaint?.id || ''}` });
      setModal(null);
      setDesc('');
    } catch (err: any) {
      toast({ title: '❌ Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CitizenLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
          <div>
            <h1 className="text-xl font-heading font-bold text-destructive">SOS Emergency</h1>
            <p className="text-sm text-muted-foreground">Call <strong>112</strong> for life-threatening emergencies</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SOS_TYPES.map(s => (
            <button key={s.type} onClick={() => setModal(s.type)}
              className={`card-elevated p-6 text-center border-2 transition-all ${s.color}`}>
              <span className="text-4xl block mb-2">{s.icon}</span>
              <span className="font-heading font-semibold text-sm">{s.type}</span>
            </button>
          ))}
        </div>

        <div className="card-elevated p-4">
          <h3 className="font-heading font-semibold mb-3">Emergency Helplines</h3>
          <div className="grid grid-cols-2 gap-2">
            {HELPLINES.map(h => (
              <a key={h.name} href={`tel:${h.number}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <span className="text-xl">{h.icon}</span>
                <div>
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-accent font-mono">{h.number}</p>
                </div>
                <Phone className="h-4 w-4 text-accent ml-auto" />
              </a>
            ))}
          </div>
        </div>

        {mySOSComplaints.length > 0 && (
          <div>
            <h3 className="font-heading font-semibold mb-3">My SOS Reports</h3>
            {mySOSComplaints.map(c => (
              <div key={c.id} className="card-elevated p-4 mb-2 border-l-4 border-l-destructive">
                <div className="flex items-center gap-2">
                  <span className="mono-id">{c.id}</span>
                  <span className={getStatusClass(c.status)}>{c.status}</span>
                </div>
                <p className="text-sm font-medium mt-1">{c.title}</p>
              </div>
            ))}
          </div>
        )}

        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
            <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-lg">🚨 {modal} Emergency</h3>
                <button onClick={() => setModal(null)}><X className="h-5 w-5" /></button>
              </div>
              <p className="text-sm text-muted-foreground mb-3">Quick SOS — auto-tagged as Critical priority</p>
              <Textarea placeholder="Describe the emergency..." value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={handleSOS} disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send SOS Alert'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CitizenLayout>
  );
}