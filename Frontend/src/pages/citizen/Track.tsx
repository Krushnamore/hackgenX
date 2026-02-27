import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import CitizenLayout from '@/components/CitizenLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Search, ThumbsUp, CheckCircle, Circle, Clock,
  ChevronRight, ArrowLeft, RefreshCw, MapPin,
} from 'lucide-react';
import { getPriorityClass } from '@/types';

const STATUS_ORDER = ['Submitted', 'Under Review', 'In Progress', 'Resolved'];

const statusDot = (s: string) => {
  if (s === 'Resolved')     return 'bg-green-500';
  if (s === 'In Progress')  return 'bg-blue-500 animate-pulse';
  if (s === 'Under Review') return 'bg-yellow-500 animate-pulse';
  if (s === 'Rejected')     return 'bg-red-500';
  return 'bg-gray-400';
};

const statusBadge = (s: string) => {
  if (s === 'Resolved')     return 'text-green-700 bg-green-50 border-green-200';
  if (s === 'In Progress')  return 'text-blue-700 bg-blue-50 border-blue-200';
  if (s === 'Under Review') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  if (s === 'Rejected')     return 'text-red-700 bg-red-50 border-red-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
};

export default function CitizenTrack() {
  // Use myComplaints (already filtered to this citizen) instead of all complaints
  const { myComplaints, supportComplaint, refreshComplaints } = useApp();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [searchId, setSearchId] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-select from URL
  useEffect(() => {
    const id = params.get('id');
    if (id) {
      const found = myComplaints.find(c => c.id === id || c.complaintId === id || c._id === id);
      if (found) setSelected(found);
      else setSearchId(id);
    }
  }, [params, myComplaints]);

  useEffect(() => { refreshComplaints(); }, []);

  // Keep selected in sync with latest data (live status updates)
  useEffect(() => {
    if (selected) {
      const fresh = myComplaints.find(
        c => c.id === selected.id || c._id === selected._id || c.complaintId === selected.complaintId
      );
      if (fresh && fresh.status !== selected.status) {
        setSelected(fresh);
        toast({ title: `🔄 Status updated: ${fresh.status}` });
      } else if (fresh) {
        setSelected(fresh);
      }
    }
  }, [myComplaints]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayList = searchId.trim()
    ? myComplaints.filter(c =>
        (c.id || '').toLowerCase().includes(searchId.toLowerCase()) ||
        (c.complaintId || '').toLowerCase().includes(searchId.toLowerCase()) ||
        (c.title || '').toLowerCase().includes(searchId.toLowerCase())
      )
    : myComplaints;

  const handleSearch = () => {
    if (!searchId.trim()) return;
    const found = myComplaints.find(c => c.id === searchId.trim() || c.complaintId === searchId.trim());
    if (found) { setSelected(found); }
    else toast({ title: 'Complaint not found', variant: 'destructive' });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshComplaints();
    setRefreshing(false);
    toast({ title: '🔄 Refreshed' });
  };

  const handleSupport = async (c: any) => {
    try {
      await supportComplaint(c.id);
      toast({ title: '👍 Supported! +10 points earned' });
    } catch (err: any) {
      toast({ title: err.message || 'Already supported', variant: 'destructive' });
    }
  };

  const currentStep = (status: string) => STATUS_ORDER.indexOf(status);

  const stats = [
    { label: 'Total',       value: myComplaints.length, color: 'text-accent' },
    { label: 'Resolved',    value: myComplaints.filter(c => c.status === 'Resolved').length,    color: 'text-green-600'  },
    { label: 'In Progress', value: myComplaints.filter(c => c.status === 'In Progress').length, color: 'text-blue-600'   },
    { label: 'Pending',     value: myComplaints.filter(c => c.status === 'Submitted' || c.status === 'Under Review').length, color: 'text-yellow-600' },
  ];

  return (
    <CitizenLayout>
      <div className="max-w-4xl mx-auto space-y-5">

        <div className="flex items-center gap-3">
          {selected && (
            <button onClick={() => setSelected(null)} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="text-2xl font-heading font-bold flex-1">
            {selected ? 'Issue Tracking' : 'Track Complaints'}
          </h1>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {!selected && (
          <div className="flex gap-2">
            <Input
              placeholder="Search by Complaint ID or title"
              value={searchId}
              onChange={e => setSearchId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button variant="hero" onClick={handleSearch}><Search className="h-4 w-4 mr-1" /> Search</Button>
            {searchId && <Button variant="ghost" onClick={() => setSearchId('')}>✕</Button>}
          </div>
        )}

        {selected ? (
          <div className="space-y-5 animate-fade-in">

            <div className="card-elevated p-6 space-y-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="mono-id text-xs">{selected.complaintId || selected.id}</span>
                    {selected.isSOS && <span className="badge-pill bg-destructive text-destructive-foreground text-[10px]">🚨 SOS</span>}
                  </div>
                  <h2 className="text-xl font-heading font-semibold mt-1">{selected.title}</h2>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleSupport(selected)}>
                  <ThumbsUp className="h-4 w-4 mr-1" /> {selected.supportCount || 0} Support
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="badge-pill bg-muted text-muted-foreground">{selected.category}</span>
                <span className={getPriorityClass(selected.priority)}>{selected.priority}</span>
                <span className={`badge-pill border text-xs ${statusBadge(selected.status)}`}>{selected.status}</span>
                <span className="badge-pill bg-muted text-muted-foreground">Ward {selected.ward}</span>
              </div>

              <p className="text-sm text-muted-foreground">{selected.description}</p>

              {selected.location && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  <MapPin className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                  <span>{selected.location}</span>
                </div>
              )}
              {selected.photo && <img src={selected.photo} className="rounded-lg max-h-48 w-full object-cover" alt="Issue" />}
              <p className="text-xs text-muted-foreground">Submitted: {selected.createdAt}</p>
            </div>

            {/* Live Status Progress */}
            <div className="card-elevated p-6">
              <h3 className="font-heading font-semibold mb-1 flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" /> Live Status Tracking
                <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-normal">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Live
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mb-8">Auto-updates every 15 seconds when admin changes status.</p>

              {selected.status === 'Rejected' ? (
                <div className="rounded-lg p-4 border border-red-200 bg-red-50 text-red-700">
                  <p className="font-semibold">❌ Complaint Rejected</p>
                  <p className="text-sm mt-1">{selected.adminNote || 'This complaint was not accepted.'}</p>
                </div>
              ) : (
                <>
                  <div className="relative mb-8">
                    <div className="absolute top-5 left-0 right-0 h-1 bg-muted rounded-full" />
                    <div
                      className="absolute top-5 left-0 h-1 bg-accent rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(0, (currentStep(selected.status) / 3) * 100)}%` }}
                    />
                    <div className="relative flex justify-between">
                      {STATUS_ORDER.map((step, i) => {
                        const idx = currentStep(selected.status);
                        const isDone    = i < idx;
                        const isCurrent = i === idx;
                        return (
                          <div key={step} className="flex flex-col items-center gap-2 w-1/4">
                            <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center z-10 transition-all
                              ${isDone    ? 'bg-accent border-accent text-white' : ''}
                              ${isCurrent ? 'bg-accent border-accent text-white ring-4 ring-accent/25 scale-110' : ''}
                              ${!isDone && !isCurrent ? 'bg-background border-muted text-muted-foreground' : ''}
                            `}>
                              {isDone ? <CheckCircle className="h-5 w-5" />
                               : isCurrent ? (step === 'Resolved' ? <CheckCircle className="h-5 w-5" /> : <div className="h-3 w-3 rounded-full bg-white animate-pulse" />)
                               : <Circle className="h-4 w-4 opacity-30" />}
                            </div>
                            <div className="text-center">
                              <p className={`text-xs font-semibold ${isDone || isCurrent ? 'text-accent' : 'text-muted-foreground'}`}>{step}</p>
                              {selected.timeline?.[i]?.date && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{selected.timeline[i].date}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={`rounded-lg p-4 border ${statusBadge(selected.status)}`}>
                    <p className="text-sm font-semibold">
                      {selected.status === 'Submitted'    && '📋 Submitted — awaiting review.'}
                      {selected.status === 'Under Review' && '🔍 Admin team is reviewing your complaint.'}
                      {selected.status === 'In Progress'  && '🔧 Municipal team is actively resolving this!'}
                      {selected.status === 'Resolved'     && '✅ Issue resolved! Give feedback to earn +25 points.'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {(selected.adminNote || selected.assignedOfficer || selected.estimatedResolution) && (
              <div className="card-elevated p-5 space-y-2">
                <h4 className="font-heading font-semibold text-sm">Admin Response</h4>
                {selected.assignedOfficer && <p className="text-sm">👷 <strong>Officer:</strong> {selected.assignedOfficer}</p>}
                {selected.estimatedResolution && <p className="text-sm text-muted-foreground">📅 Est. resolution: {selected.estimatedResolution}</p>}
                {selected.adminNote && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-600 mb-1">Note from Admin</p>
                    <p className="text-sm">{selected.adminNote}</p>
                  </div>
                )}
              </div>
            )}

            {selected.resolvePhoto && (
              <div className="card-elevated p-5">
                <h4 className="font-heading font-semibold text-sm mb-3 text-green-600">✅ Resolution Proof</h4>
                <img src={selected.resolvePhoto} className="rounded-lg max-h-48 object-cover w-full" alt="Resolved" />
              </div>
            )}

            {selected.feedback && (
              <div className="card-elevated p-5 bg-green-50/50 dark:bg-green-900/10 border border-green-200">
                <h4 className="font-heading font-semibold text-sm mb-2">Your Feedback</h4>
                <p className="text-warning text-lg">{'⭐'.repeat(selected.feedback.rating)}</p>
                {selected.feedback.comment && <p className="text-sm text-muted-foreground italic mt-1">"{selected.feedback.comment}"</p>}
              </div>
            )}
          </div>

        ) : (
          <div className="space-y-3">
            {myComplaints.length > 0 && !searchId && (
              <div className="grid grid-cols-4 gap-3">
                {stats.map(s => (
                  <div key={s.label} className="card-elevated p-3 text-center">
                    <p className={`text-xl font-heading font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {displayList.length === 0 ? (
              <div className="card-elevated p-12 text-center text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{searchId ? 'No complaints found' : 'No complaints submitted yet'}</p>
                <p className="text-sm mt-1">{searchId ? 'Try a different ID or title' : 'Use Report to submit your first complaint'}</p>
              </div>
            ) : (
              <>
                {!searchId && (
                  <p className="text-xs text-muted-foreground px-1">
                    {myComplaints.length} complaint{myComplaints.length !== 1 ? 's' : ''} — click any to see live tracking
                  </p>
                )}
                {displayList.map(c => (
                  <button
                    key={c.id || c._id}
                    onClick={() => setSelected(c)}
                    className="w-full text-left card-elevated p-4 hover:shadow-md transition-all flex items-center gap-4 group"
                  >
                    <div className={`h-3 w-3 rounded-full flex-shrink-0 ${statusDot(c.status)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="mono-id text-xs">{c.complaintId || c.id}</span>
                        {c.isSOS && <span className="text-destructive text-[10px] font-bold">🚨</span>}
                      </div>
                      <p className="font-medium text-sm truncate">{c.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-muted-foreground">
                        <span>{c.category}</span><span>·</span>
                        <span>Ward {c.ward}</span><span>·</span>
                        <span>{c.createdAt}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`badge-pill border text-xs ${statusBadge(c.status)}`}>{c.status}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </CitizenLayout>
  );
}