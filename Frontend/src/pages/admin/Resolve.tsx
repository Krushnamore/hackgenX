/**
 * Admin Resolve Page — Department-scoped for officers
 *
 * KEY FIX: currentUser.role (not adminType) matches what the backend returns.
 * dept_officer can resolve complaints in their department.
 */

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { emailAPI } from '@/lib/api';
import {
  Camera, CheckCircle, MapPin, Mail,
  ChevronDown, ChevronUp, Clock, Star, Loader2, Wrench,
} from 'lucide-react';
import { getPriorityClass, getStatusClass } from '@/types';

export default function AdminResolve() {
  const { complaints, resolveComplaint, currentUser } = useApp();
  const { toast } = useToast();

  // ── Role detection — uses backend `role` field ──────────────────────────────
  const isOfficer    = currentUser?.role === 'dept_officer' || currentUser?.role === 'admin';
  const isSuperAdmin = currentUser?.role === 'superAdmin';

  const [tab, setTab] = useState<'pending' | 'resolved'>('pending');

  const pendingList  = complaints.filter(c =>
    c.status === 'Submitted' || c.status === 'Under Review' || c.status === 'In Progress'
  );
  const resolvedList = complaints.filter(c => c.status === 'Resolved');

  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [resolvePhoto, setResolvePhoto] = useState('');
  const [note,         setNote]         = useState('');
  const [officer,      setOfficer]      = useState(currentUser?.name || '');
  const [confirming,   setConfirming]   = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  const [ackSent,    setAckSent]    = useState<Set<string>>(new Set());
  const [ackLoading, setAckLoading] = useState<Set<string>>(new Set());
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());

  const selected = selectedId ? complaints.find(c => c.id === selectedId) ?? null : null;

  const filteredPending = pendingList.filter(c => {
    const q = search.toLowerCase();
    return (c.title || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q);
  });

  const filteredResolved = resolvedList.filter(c => {
    const q = search.toLowerCase();
    return (c.title || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q);
  });

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setResolvePhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setConfirming(false);
    setSubmitting(false);
    setResolvePhoto('');
    setNote('');
    const c = complaints.find(x => x.id === id);
    setOfficer(c?.assignedOfficer || currentUser?.name || '');
  };

  const handleResolve = async () => {
    if (!selectedId || submitting) return;

    if (!isOfficer) {
      toast({
        title: '🚫 Permission denied',
        description: 'Only Department Officers can resolve complaints.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await resolveComplaint(selectedId, resolvePhoto, note, officer);
      const c = complaints.find(x => x.id === selectedId);
      const citizenContact = c?.citizenEmail
        ? `email sent to ${c.citizenEmail}`
        : c?.citizenPhone ? `SMS notification to ${c.citizenPhone}` : 'citizen notified';
      toast({ title: '✅ Complaint resolved!', description: `${selectedId} marked as Resolved. ${citizenContact}.` });
      setSelectedId(null); setResolvePhoto(''); setNote('');
      setOfficer(currentUser?.name || ''); setConfirming(false);
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      toast({ title: '❌ Resolve failed', description: msg.slice(0, 120), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const sendAck = async (c: any) => {
    setAckLoading(prev => new Set([...prev, c.id]));
    try {
      await emailAPI.sendResolutionEmail(c);
      setAckSent(prev => new Set([...prev, c.id]));
      toast({ title: '📧 Resolution document sent', description: `Sent to ${c.citizenName}` });
    } catch {
      toast({ title: '❌ Email failed', description: 'Could not send acknowledgement.', variant: 'destructive' });
    } finally {
      setAckLoading(prev => { const s = new Set(prev); s.delete(c.id); return s; });
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          Resolve & Upload Proof
          {isOfficer && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 px-2 py-0.5 rounded-full">
              <Wrench className="h-3 w-3" /> {currentUser?.department}
            </span>
          )}
          {isSuperAdmin && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 px-2 py-0.5 rounded-full">
              👁️ View Only
            </span>
          )}
        </h1>

        {/* Scope notices */}
        {isOfficer && (
          <div className="flex items-center gap-2 text-xs bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg px-3 py-2 text-sky-700 dark:text-sky-300">
            <Wrench className="h-3.5 w-3.5 flex-shrink-0" />
            You can resolve complaints assigned to <strong>{currentUser?.department}</strong> department only.
          </div>
        )}
        {isSuperAdmin && (
          <div className="flex items-center gap-2 text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2 text-yellow-700 dark:text-yellow-300">
            👁️ Super Admin view — only Department Officers can resolve complaints.
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('pending')}
            className={`px-5 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${tab === 'pending' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
          >
            <Clock className="h-4 w-4" />
            Pending
            <span className="bg-warning/20 text-warning text-xs rounded-full px-2 py-0.5 font-semibold">{pendingList.length}</span>
          </button>
          <button
            onClick={() => setTab('resolved')}
            className={`px-5 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${tab === 'resolved' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
          >
            <CheckCircle className="h-4 w-4" />
            Resolved
            <span className="bg-success/20 text-success text-xs rounded-full px-2 py-0.5 font-semibold">{resolvedList.length}</span>
          </button>
        </div>

        <Input
          placeholder="Search by ID or title…" value={search}
          onChange={e => setSearch(e.target.value)} className="max-w-xs"
        />

        {/* ── PENDING TAB ── */}
        {tab === 'pending' && (
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-2 max-h-[72vh] overflow-y-auto pr-1">
              {filteredPending.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No pending complaints</p>
              )}
              {filteredPending.map(c => (
                <button
                  key={c.id} onClick={() => handleSelect(c.id)}
                  className={`w-full text-left card-elevated p-3 transition-all hover:shadow-md ${selectedId === c.id ? 'ring-2 ring-accent' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="mono-id">{c.id}</span>
                    <span className={getStatusClass(c.status)}>{c.status}</span>
                    {c.isSOS && <span className="text-xs">🚨</span>}
                  </div>
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Zone {c.ward} · {c.category} · {c.citizenName}</p>
                </button>
              ))}
            </div>

            <div className="lg:col-span-3">
              {selected ? (
                <div className="card-elevated p-6 space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="mono-id">{selected.id}</span>
                      <span className={getPriorityClass(selected.priority)}>{selected.priority}</span>
                      <span className={getStatusClass(selected.status)}>{selected.status}</span>
                    </div>
                    <h2 className="text-lg font-heading font-semibold">{selected.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <p><strong>Citizen:</strong> {selected.citizenName}</p>
                    <p><strong>Phone:</strong> {selected.citizenPhone}</p>
                    {selected.citizenEmail && (
                      <p className="col-span-2">
                        <strong>Email:</strong> <span className="text-accent">{selected.citizenEmail}</span>
                        <span className="text-xs text-muted-foreground ml-1">(resolution doc will be sent here)</span>
                      </p>
                    )}
                    <p><strong>Zone:</strong> Zone {selected.ward}</p>
                    <p><strong>Category:</strong> {selected.category}</p>
                    {selected.estimatedResolution && (
                      <p className="col-span-2"><strong>Est. Resolution:</strong> {selected.estimatedResolution}</p>
                    )}
                  </div>

                  {selected.photo && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-medium">Issue Photo</p>
                      <img src={selected.photo} className="rounded-lg max-h-40 w-full object-cover" alt="Issue" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-2">
                    <MapPin className="h-4 w-4 text-accent flex-shrink-0" />
                    <span className="truncate">
                      {selected.location || 'No location'}{' '}
                      {selected.gpsCoords?.lat ? `(${selected.gpsCoords.lat}, ${selected.gpsCoords.lng})` : ''}
                    </span>
                  </div>

                  {(selected.timeline || []).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-2">Progress</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {(selected.timeline || []).map((t: any, i: number) => (
                          <div key={i} className="flex items-center gap-1">
                            <div className={`h-3 w-3 rounded-full flex-shrink-0 ${t.done ? 'bg-accent' : 'bg-muted'}`} />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t.label}</span>
                            {i < 3 && <div className={`w-6 h-0.5 ${t.done ? 'bg-accent' : 'bg-muted'}`} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Only dept_officer can resolve */}
                  {isOfficer ? (
                    <>
                      <hr className="border-border" />
                      <h3 className="font-heading font-semibold">Resolution Details</h3>

                      <div>
                        <Label>Upload Resolution Photo</Label>
                        <label className="mt-2 border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center cursor-pointer hover:border-accent transition-colors">
                          {resolvePhoto ? (
                            <img src={resolvePhoto} className="max-h-32 rounded-lg object-cover" alt="Preview" />
                          ) : (
                            <><Camera className="h-8 w-8 text-muted-foreground mb-2" /><span className="text-sm text-muted-foreground">Click to upload photo proof</span></>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                        </label>
                      </div>

                      <div>
                        <Label>Resolution Notes</Label>
                        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Describe what was done…" rows={3} className="mt-1" />
                      </div>

                      <div>
                        <Label>Assigned Officer</Label>
                        <Input value={officer} onChange={e => setOfficer(e.target.value)} placeholder="Officer name" className="mt-1" />
                      </div>

                      {selected.citizenEmail && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                          <Mail className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span>A resolution document will be sent to <strong className="text-blue-600">{selected.citizenEmail}</strong> upon confirmation.</span>
                        </div>
                      )}

                      {!confirming ? (
                        <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => setConfirming(true)} disabled={submitting}>
                          <CheckCircle className="h-4 w-4 mr-2" /> Mark as Resolved
                        </Button>
                      ) : (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium">Confirm resolve: <span className="mono-id">{selected.id}</span>?</p>
                          <p className="text-xs text-muted-foreground">Marks as Resolved, awards 100 pts to {selected.citizenName}, and sends resolution document to citizen.</p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={submitting}>Cancel</Button>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleResolve} disabled={submitting}>
                              {submitting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Resolving…</> : <>✅ Confirm Resolve</>}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2">
                        👁️ Super Admin view — only Department Officers can resolve complaints
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card-elevated p-12 text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">Select a complaint to {isOfficer ? 'resolve' : 'view'}</p>
                  <p className="text-sm mt-1">Click any complaint on the left to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RESOLVED TAB ── */}
        {tab === 'resolved' && (
          <div className="space-y-3">
            {filteredResolved.length === 0 && (
              <div className="card-elevated p-12 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No resolved complaints yet</p>
              </div>
            )}

            {filteredResolved.map(c => {
              const isExpanded = expanded.has(c.id);
              const wasSent    = ackSent.has(c.id);
              const isLoading  = ackLoading.has(c.id);
              return (
                <div key={c.id} className="card-elevated overflow-hidden">
                  <button
                    className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                    onClick={() => toggleExpand(c.id)}
                  >
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <span className="mono-id flex-shrink-0">{c.id}</span>
                      <span className="font-medium text-sm truncate">{c.title}</span>
                      <span className="badge-pill bg-muted text-muted-foreground flex-shrink-0">Zone {c.ward}</span>
                      {c.feedback?.rating && <span className="text-warning text-xs flex-shrink-0">{'⭐'.repeat(c.feedback.rating)}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">{c.updatedAt}</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-4">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-3 text-sm">
                          <h4 className="font-heading font-semibold text-base">Complaint Details</h4>
                          <p className="text-muted-foreground">{c.description}</p>
                          <div className="space-y-1">
                            <p><strong>Citizen:</strong> {c.citizenName}</p>
                            <p><strong>Phone:</strong> {c.citizenPhone}</p>
                            {c.citizenEmail && <p><strong>Email:</strong> <span className="text-accent">{c.citizenEmail}</span></p>}
                            <p><strong>Zone:</strong> Zone {c.ward}</p>
                            <p><strong>Location:</strong> {c.location || '—'}</p>
                            <p><strong>Submitted:</strong> {c.createdAt}</p>
                            <p><strong>Resolved:</strong> {c.updatedAt}</p>
                            {c.assignedOfficer && <p><strong>Officer:</strong> {c.assignedOfficer}</p>}
                          </div>
                          {c.adminNote && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                              <p className="text-xs font-semibold text-blue-600 mb-1">Resolution Notes</p>
                              <p>{c.adminNote}</p>
                            </div>
                          )}
                          {c.photo && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Issue Photo</p>
                              <img src={c.photo} className="rounded-lg max-h-32 object-cover" alt="Issue" />
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 text-sm">
                          <h4 className="font-heading font-semibold text-base">Resolution Proof</h4>
                          {c.resolvePhoto ? (
                            <img src={c.resolvePhoto} className="rounded-lg max-h-40 w-full object-cover" alt="Resolved" />
                          ) : (
                            <div className="h-24 bg-muted/30 rounded-lg flex items-center justify-center">
                              <p className="text-xs text-muted-foreground">No proof photo uploaded</p>
                            </div>
                          )}

                          {c.feedback ? (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                              <p className="text-xs font-semibold text-yellow-700 mb-2 flex items-center gap-1">
                                <Star className="h-3.5 w-3.5" /> Citizen Feedback
                              </p>
                              <p className="text-warning">{'⭐'.repeat(c.feedback.rating)} ({c.feedback.rating}/5)</p>
                              {c.feedback.resolved && <p className="text-xs mt-1">Issue resolved: <strong>{c.feedback.resolved}</strong></p>}
                              {c.feedback.comment && <p className="text-xs italic mt-1 text-muted-foreground">"{c.feedback.comment}"</p>}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No feedback submitted yet</p>
                          )}

                          <Button
                            variant={wasSent ? 'outline' : 'hero'} size="sm"
                            disabled={wasSent || isLoading} onClick={() => sendAck(c)} className="w-full"
                          >
                            {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
                             : wasSent ? <>✓ Resolution Document Sent</>
                             : <><Mail className="h-4 w-4 mr-2" /> Send Resolution Document to Citizen</>}
                          </Button>

                          {wasSent && c.citizenEmail && (
                            <p className="text-xs text-center text-muted-foreground">
                              Sent to <span className="text-accent">{c.citizenEmail}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}