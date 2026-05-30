/**
 * Admin Resolve Page
 * - dept_officer / admin: can resolve complaints + delete any complaint
 * - superAdmin: view only (cannot resolve), but CAN delete
 */

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Camera, CheckCircle, MapPin, Mail,
  ChevronDown, ChevronUp, Clock, Star,
  Loader2, Wrench, Trash2, AlertTriangle,
} from 'lucide-react';
import { getPriorityClass, getStatusClass } from '@/types';

export default function AdminResolve() {
  const { complaints, resolveComplaint, deleteComplaint, currentUser, refreshComplaints, sendDocument } = useApp() as any;
  const { toast } = useToast();

  const isOfficer    = currentUser?.role === 'dept_officer' || currentUser?.role === 'admin';
  const isSuperAdmin = currentUser?.role === 'superAdmin';
  const canDelete    = isOfficer || isSuperAdmin;

  const [tab, setTab] = useState<'pending' | 'resolved'>('pending');

  const pendingList  = complaints.filter(c =>
    c.status === 'Submitted' || c.status === 'Under Review' || c.status === 'In Progress'
  );
  const resolvedList = complaints.filter(c => c.status === 'Resolved');

  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [resolvePhoto,  setResolvePhoto]  = useState('');
  const [beforePhoto,   setBeforePhoto]   = useState('');
  const [note,          setNote]          = useState('');
  const [officer,      setOfficer]      = useState(currentUser?.name || '');
  const [confirming,   setConfirming]   = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);

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

  const handleBeforePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setBeforePhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setConfirming(false);
    setSubmitting(false);
    setResolvePhoto('');
    setBeforePhoto('');
    setNote('');
    const c = complaints.find(x => x.id === id);
    setOfficer(c?.assignedOfficer || currentUser?.name || '');
  };

  const handleResolve = async () => {
    if (!selectedId || submitting) return;
    if (!isOfficer) {
      toast({ title: '🚫 Permission denied', description: 'Only Department Officers can resolve complaints.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await resolveComplaint(selectedId, resolvePhoto, note, officer, beforePhoto);
      if (refreshComplaints) await refreshComplaints();
      toast({ title: '✅ Complaint resolved!', description: `${selectedId} marked as Resolved. Citizen awarded +100 pts.` });
      // Send document notification to citizen
      const resolved = complaints.find(c => c.id === selectedId);
      if (resolved?.citizenId && sendDocument) {
        sendDocument(
          String(resolved.citizenId?._id || resolved.citizenId),
          `Resolution Certificate — ${resolved.title}`,
          resolved.complaintId || selectedId,
        );
      }
      setSelectedId(null); setResolvePhoto(''); setBeforePhoto(''); setNote('');
      setOfficer(currentUser?.name || ''); setConfirming(false);
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      toast({ title: '❌ Resolve failed', description: msg.slice(0, 120), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteComplaint(id);
      setDeleteConfirmId(null);
      if (selectedId === id) setSelectedId(null);
      if (refreshComplaints) await refreshComplaints();
      toast({ title: '🗑️ Complaint deleted', variant: 'destructive' });
    } catch (err: any) {
      toast({ title: '❌ Delete failed', description: (err?.message || '').slice(0, 100), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const sendAck = (c: any) => {
    // Send in-app notification to citizen
    const cid = String(c.citizenId?._id || c.citizenId || '');
    if (cid && sendDocument) {
      sendDocument(cid, `Resolution Certificate — ${c.title}`, c.complaintId || c.id);
    }
    setAckSent(prev => new Set([...prev, c.id]));

    // Fallback: open mailto in new tab (no backend email endpoint needed)
    if (c.citizenEmail) {
      const subject = encodeURIComponent(`JANVANI – Complaint ${c.complaintId || c.id} Resolved`);
      const body = encodeURIComponent(
        `Dear ${c.citizenName},\n\n` +
        `Your complaint "${c.title}" (ID: ${c.complaintId || c.id}) has been resolved.\n\n` +
        `Resolution Note: ${c.adminNote || 'Issue addressed by the municipal team.'}\n` +
        `Officer: ${c.assignedOfficer || 'Municipal Officer'}\n\n` +
        `Thank you for using JANVANI.\nMunicipal Corporation`
      );
      window.open(`mailto:${c.citizenEmail}?subject=${subject}&body=${body}`);
    }

    toast({ title: '📄 Document sent', description: `In-app notification sent to ${c.citizenName}` });
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

        {isOfficer && (
          <div className="flex items-center gap-2 text-xs bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg px-3 py-2 text-sky-700 dark:text-sky-300">
            <Wrench className="h-3.5 w-3.5 flex-shrink-0" />
            You can resolve & delete complaints in <strong>{currentUser?.department}</strong> department.
          </div>
        )}
        {isSuperAdmin && (
          <div className="flex items-center gap-2 text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2 text-yellow-700 dark:text-yellow-300">
            👁️ Super Admin — you can delete complaints but not resolve them.
          </div>
        )}

        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          <button onClick={() => setTab('pending')} className={`px-5 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${tab === 'pending' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
            <Clock className="h-4 w-4" /> Pending
            <span className="bg-warning/20 text-warning text-xs rounded-full px-2 py-0.5 font-semibold">{pendingList.length}</span>
          </button>
          <button onClick={() => setTab('resolved')} className={`px-5 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${tab === 'resolved' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
            <CheckCircle className="h-4 w-4" /> Resolved
            <span className="bg-success/20 text-success text-xs rounded-full px-2 py-0.5 font-semibold">{resolvedList.length}</span>
          </button>
        </div>

        <Input placeholder="Search by ID or title…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />

        {/* ── PENDING TAB ── */}
        {tab === 'pending' && (
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-2 max-h-[72vh] overflow-y-auto pr-1">
              {filteredPending.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No pending complaints</p>}
              {filteredPending.map(c => (
                <div key={c.id} className={`card-elevated p-3 transition-all hover:shadow-md ${selectedId === c.id ? 'ring-2 ring-accent' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button className="flex-1 text-left" onClick={() => handleSelect(c.id)}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="mono-id">{c.id}</span>
                        <span className={getStatusClass(c.status)}>{c.status}</span>
                        {c.isSOS && <span className="text-xs">🚨</span>}
                      </div>
                      <p className="text-sm font-medium truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Zone {c.ward} · {c.category} · {c.citizenName}</p>
                    </button>
                    {canDelete && (
                      <button onClick={() => setDeleteConfirmId(c.id)} disabled={deletingId === c.id}
                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors flex-shrink-0 mt-1" title="Delete">
                        {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 text-destructive animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-3">
              {selected ? (
                <div className="card-elevated p-6 space-y-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="mono-id">{selected.id}</span>
                        <span className={getPriorityClass(selected.priority)}>{selected.priority}</span>
                        <span className={getStatusClass(selected.status)}>{selected.status}</span>
                      </div>
                      <h2 className="text-lg font-heading font-semibold">{selected.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
                    </div>
                    {canDelete && (
                      <button onClick={() => setDeleteConfirmId(selected.id)} disabled={deletingId === selected.id}
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors flex-shrink-0" title="Delete">
                        {deletingId === selected.id ? <Loader2 className="h-4 w-4 text-destructive animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <p><strong>Citizen:</strong> {selected.citizenName}</p>
                    <p><strong>Phone:</strong> {selected.citizenPhone}</p>
                    {selected.citizenEmail && <p className="col-span-2"><strong>Email:</strong> <span className="text-accent">{selected.citizenEmail}</span></p>}
                    <p><strong>Zone:</strong> Zone {selected.ward}</p>
                    <p><strong>Category:</strong> {selected.category}</p>
                  </div>

                  {selected.photo && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-medium">Issue Photo</p>
                      <img src={selected.photo} className="rounded-lg max-h-40 w-full object-cover" alt="Issue" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-2">
                    <MapPin className="h-4 w-4 text-accent flex-shrink-0" />
                    <span className="truncate">{selected.location || 'No location'}</span>
                  </div>

                  {isOfficer ? (
                    <>
                      <hr className="border-border" />
                      <h3 className="font-heading font-semibold">Resolution Details</h3>

                      {/* Before / After Photos */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">📷 Before Photo <span className="opacity-60">(optional)</span></Label>
                          <label className="mt-1 border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center cursor-pointer hover:border-warning transition-colors">
                            {beforePhoto
                              ? <img src={beforePhoto} className="max-h-28 rounded-lg object-cover" alt="Before" />
                              : <><Camera className="h-6 w-6 text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">Before photo</span></>}
                            <input type="file" accept="image/*" className="hidden" onChange={handleBeforePhoto} />
                          </label>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">✅ After Photo (Proof) *</Label>
                          <label className="mt-1 border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center cursor-pointer hover:border-accent transition-colors">
                            {resolvePhoto
                              ? <img src={resolvePhoto} className="max-h-28 rounded-lg object-cover" alt="After" />
                              : <><Camera className="h-6 w-6 text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">After / proof photo</span></>}
                            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                          </label>
                        </div>
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
                          <span>Resolution document will be sent to <strong className="text-blue-600">{selected.citizenEmail}</strong> upon confirmation.</span>
                        </div>
                      )}

                      {!confirming ? (
                        <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => setConfirming(true)} disabled={submitting}>
                          <CheckCircle className="h-4 w-4 mr-2" /> Mark as Resolved
                        </Button>
                      ) : (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium">Confirm resolve: <span className="mono-id">{selected.id}</span>?</p>
                          <p className="text-xs text-muted-foreground">Marks as Resolved and awards 100 pts to {selected.citizenName}.</p>
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
                  <p className="text-sm mt-1">Click any complaint on the left</p>
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
                  <div className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <button className="flex-1 text-left flex items-center gap-3 flex-wrap min-w-0" onClick={() => toggleExpand(c.id)}>
                      <span className="mono-id flex-shrink-0">{c.id}</span>
                      <span className="font-medium text-sm truncate">{c.title}</span>
                      <span className="badge-pill bg-muted text-muted-foreground flex-shrink-0">Zone {c.ward}</span>
                      {c.feedback?.rating && <span className="text-warning text-xs flex-shrink-0">{'⭐'.repeat(c.feedback.rating)}</span>}
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">{c.updatedAt}</span>
                      {canDelete && (
                        <button onClick={() => setDeleteConfirmId(c.id)} disabled={deletingId === c.id}
                          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors" title="Delete">
                          {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 text-destructive animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                        </button>
                      )}
                      <button onClick={() => toggleExpand(c.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>

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
                          {c.photo && <div><p className="text-xs text-muted-foreground mb-1">Issue Photo</p><img src={c.photo} className="rounded-lg max-h-32 object-cover" alt="Issue" /></div>}
                        </div>

                        <div className="space-y-3 text-sm">
                          <h4 className="font-heading font-semibold text-base">Resolution Proof</h4>
                          {c.resolvePhoto
                            ? <img src={c.resolvePhoto} className="rounded-lg max-h-40 w-full object-cover" alt="Resolved" />
                            : <div className="h-24 bg-muted/30 rounded-lg flex items-center justify-center"><p className="text-xs text-muted-foreground">No proof photo uploaded</p></div>}

                          {c.feedback ? (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                              <p className="text-xs font-semibold text-yellow-700 mb-2 flex items-center gap-1"><Star className="h-3.5 w-3.5" /> Citizen Feedback</p>
                              <p className="text-warning">{'⭐'.repeat(c.feedback.rating)} ({c.feedback.rating}/5)</p>
                              {c.feedback.resolved && <p className="text-xs mt-1">Issue resolved: <strong>{c.feedback.resolved}</strong></p>}
                              {c.feedback.comment && <p className="text-xs italic mt-1 text-muted-foreground">"{c.feedback.comment}"</p>}
                            </div>
                          ) : <p className="text-xs text-muted-foreground italic">No feedback submitted yet</p>}

                          <Button variant={wasSent ? 'outline' : 'hero'} size="sm" disabled={wasSent || isLoading} onClick={() => sendAck(c)} className="w-full">
                            {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
                             : wasSent ? <>✓ Resolution Document Sent</>
                             : <><Mail className="h-4 w-4 mr-2" /> Send Resolution Document to Citizen</>}
                          </Button>
                          {wasSent && c.citizenEmail && <p className="text-xs text-center text-muted-foreground">Sent to <span className="text-accent">{c.citizenEmail}</span></p>}
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

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="bg-card rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="font-heading font-semibold">Delete Complaint?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-1"><span className="mono-id">{deleteConfirmId}</span></p>
            <p className="text-xs text-destructive mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)} disabled={!!deletingId}>Cancel</Button>
              <Button variant="destructive" className="flex-1" disabled={!!deletingId} onClick={() => handleDelete(deleteConfirmId)}>
                {deletingId === deleteConfirmId
                  ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Deleting…</>
                  : <><Trash2 className="h-4 w-4 mr-1" /> Delete</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}