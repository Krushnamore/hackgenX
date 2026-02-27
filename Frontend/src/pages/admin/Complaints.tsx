/**
 * Admin Complaints Page  ─  src/pages/admin/Complaints.tsx
 *
 * FIXES
 * ─────
 * • deleteComplaint: now shows spinner on the delete button while in-flight
 *   and displays the actual backend error message in the toast on failure.
 *
 * • updateComplaintStatus: select is disabled while the update is pending
 *   to prevent double submissions. The status reverts visually if the API
 *   fails (AppContext rolls back state on error).
 *
 * • View modal: uses c.id (normalised complaintId string), guaranteed correct.
 *
 * • All API errors surface the real error message instead of generic "failed".
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Download, Trash2, Eye, X, Users, Link2,
  AlertTriangle, RefreshCw, Loader2,
} from 'lucide-react';
import {
  getPriorityClass, getStatusClass,
  CATEGORIES, STATUSES, PRIORITIES,
  type Status,
} from '@/types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ZONES = [1, 2, 3, 4, 5] as const;

export default function AdminComplaints() {
  const { complaints, updateComplaintStatus, deleteComplaint, refreshComplaints } = useApp();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [catFilter,    setCatFilter]    = useState('');
  const [priFilter,    setPriFilter]    = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [wardFilter,   setWardFilter]   = useState(0);
  const [search,       setSearch]       = useState('');
  const [refreshing,   setRefreshing]   = useState(false);

  const [viewId,          setViewId]          = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Track in-flight operations
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [updatingId,  setUpdatingId]  = useState<string | null>(null);

  // ── Read URL params on first mount ────────────────────────
  useEffect(() => {
    const zone = searchParams.get('zone') ?? searchParams.get('ward');
    const id   = searchParams.get('id');
    if (zone) setWardFilter(Number(zone));
    if (id)   { setSearch(id); setViewId(id); }
    if (zone || id) setSearchParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtering ─────────────────────────────────────────────
  const filtered = complaints.filter(c => {
    if (catFilter    && c.category !== catFilter)       return false;
    if (priFilter    && c.priority !== priFilter)       return false;
    if (statusFilter && c.status   !== statusFilter)    return false;
    if (wardFilter   && Number(c.ward) !== wardFilter)  return false;
    if (search) {
      const q = search.toLowerCase();
      const inId    = (c.id    || '').toLowerCase().includes(q);
      const inTitle = (c.title || '').toLowerCase().includes(q);
      if (!inId && !inTitle) return false;
    }
    return true;
  });

  const viewComp = viewId
    ? complaints.find(c => c.id === viewId) ?? null
    : null;

  const clearFilters = () => {
    setCatFilter(''); setPriFilter(''); setStatusFilter('');
    setWardFilter(0); setSearch('');
  };

  // ── Refresh ───────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshComplaints();
    setRefreshing(false);
    toast({ title: '🔄 Complaints refreshed' });
  };

  // ── Status change ─────────────────────────────────────────
  const handleStatusChange = async (id: string, newStatus: string) => {
    if (updatingId) return; // prevent concurrent updates
    setUpdatingId(id);
    try {
      await updateComplaintStatus(id, newStatus);
      toast({ title: `✅ Status updated → ${newStatus}` });
    } catch (err: any) {
      const msg = err?.message || 'Update failed';
      toast({
        title: '❌ Status update failed',
        description: msg.length > 100 ? msg.slice(0, 100) + '…' : msg,
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteComplaint(id);
      setDeleteConfirmId(null);
      if (viewId === id) setViewId(null);
      toast({
        title: '🗑️ Complaint deleted',
        description: id,
        variant: 'destructive',
      });
    } catch (err: any) {
      const msg = err?.message || 'Delete failed';
      toast({
        title: '❌ Delete failed',
        description: msg.length > 100 ? msg.slice(0, 100) + '…' : msg,
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Excel export ──────────────────────────────────────────
  const exportExcel = () => {
    const rows = filtered.map(c => ({
      'Complaint ID'  : c.id,
      'Title'         : c.title,
      'Description'   : c.description,
      'Category'      : c.category,
      'Priority'      : c.priority,
      'Status'        : c.status,
      'Zone'          : `Zone ${c.ward}`,
      'Location'      : c.location || '',
      'Citizen'       : c.citizenName,
      'Phone'         : c.citizenPhone,
      'Email'         : c.citizenEmail || '',
      'Submitted'     : c.createdAt,
      'Updated'       : c.updatedAt,
      'Officer'       : c.assignedOfficer || '',
      'Admin Note'    : c.adminNote || '',
      'Rating'        : c.feedback?.rating || '',
      'Feedback'      : c.feedback?.comment || '',
      'SOS'           : c.isSOS ? 'Yes' : 'No',
      'Support Count' : c.supportCount || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Complaints');
    XLSX.writeFile(wb, `janvani_complaints_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: '📥 Excel exported', description: `${filtered.length} rows` });
  };

  // ── PDF export ────────────────────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFillColor(29, 78, 216);
    doc.rect(0, 0, 297, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('JANVANI — Complaint Report', 14, 14);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 200, 14);
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    doc.text(`Total: ${filtered.length} complaints${wardFilter ? `  |  Zone ${wardFilter}` : ''}`, 14, 26);
    autoTable(doc, {
      startY: 30,
      head: [['ID', 'Title', 'Category', 'Priority', 'Status', 'Zone', 'Citizen', 'Date', 'Officer']],
      body: filtered.map(c => [
        c.id,
        (c.title || '').slice(0, 38),
        c.category,
        c.priority,
        c.status,
        `Zone ${c.ward}`,
        c.citizenName,
        c.createdAt,
        c.assignedOfficer || '—',
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [29, 78, 216], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 255] },
    });
    doc.save(`janvani_complaints_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: '📥 PDF exported', description: `${filtered.length} complaints` });
  };

  const hasFilters = catFilter || priFilter || statusFilter || wardFilter || search;

  return (
    <AdminLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold">Complaints Management</h1>
            {wardFilter > 0 && (
              <p className="text-sm text-accent mt-0.5 flex items-center gap-1">
                Showing Zone {wardFilter} only
                <button
                  className="ml-1 text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => setWardFilter(0)}
                >✕ clear</button>
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={exportExcel} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={exportPDF} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="card-elevated p-3 flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search ID or title…"
            className="h-9 w-44"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={catFilter}    onChange={e => setCatFilter(e.target.value)}    className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={priFilter}    onChange={e => setPriFilter(e.target.value)}    className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={wardFilter}   onChange={e => setWardFilter(Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value={0}>All Zones</option>
            {ZONES.map(z => <option key={z} value={z}>Zone {z}</option>)}
          </select>
          {hasFilters && (
            <Button size="sm" variant="ghost" className="h-9 text-muted-foreground" onClick={clearFilters}>
              ✕ Clear
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Showing <strong>{filtered.length}</strong> of {complaints.length} complaints
        </p>

        {/* Cards grid */}
        {filtered.length === 0 ? (
          <div className="card-elevated p-12 text-center text-muted-foreground">
            <p className="font-medium">No complaints match your filters</p>
            {hasFilters && (
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>Clear Filters</Button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map(c => {
              const isUpdating = updatingId === c.id;
              const isDeleting = deletingId === c.id;
              return (
                <div
                  key={c.id}
                  className={`card-elevated p-4 space-y-3 ${c.isSOS ? 'border-l-4 border-l-destructive' : ''} ${isDeleting ? 'opacity-50' : ''}`}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="mono-id">{c.id}</span>
                      {c.isSOS && (
                        <span className="badge-pill bg-destructive text-destructive-foreground text-[10px]">🚨 SOS</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />{c.supportCount || 0}
                      {c.mergedCount > 0 && <><Link2 className="h-3 w-3 ml-1" />{c.mergedCount}</>}
                    </div>
                  </div>

                  <h3 className="font-medium text-sm leading-snug">{c.title}</h3>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="badge-pill bg-muted text-muted-foreground">{c.category}</span>
                    <span className={getPriorityClass(c.priority)}>{c.priority}</span>
                    <span className="badge-pill bg-muted text-muted-foreground">Zone {c.ward}</span>
                    <span className="text-xs text-muted-foreground self-center">{c.createdAt}</span>
                  </div>

                  <div className="text-xs text-muted-foreground">👤 {c.citizenName} · {c.citizenPhone}</div>

                  {/* Actions row */}
                  <div className="flex items-center gap-2 pt-1 border-t border-border">
                    {/* Status dropdown */}
                    <div className="flex-1 relative">
                      <select
                        value={c.status}
                        onChange={e => handleStatusChange(c.id, e.target.value as Status)}
                        disabled={isUpdating || isDeleting}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium disabled:opacity-60"
                      >
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                      {isUpdating && (
                        <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground pointer-events-none" />
                      )}
                    </div>

                    {/* View */}
                    <button
                      title="View details"
                      className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent/10 transition-colors"
                      onClick={() => setViewId(c.id)}
                      disabled={isDeleting}
                    >
                      <Eye className="h-4 w-4 text-accent" />
                    </button>

                    {/* Delete */}
                    <button
                      title="Delete complaint"
                      className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      onClick={() => setDeleteConfirmId(c.id)}
                      disabled={isDeleting || !!deletingId}
                    >
                      {isDeleting
                        ? <Loader2 className="h-4 w-4 text-destructive animate-spin" />
                        : <Trash2 className="h-4 w-4 text-destructive" />
                      }
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <span className={getStatusClass(c.status)}>{c.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── View Details Modal ── */}
      {viewComp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={e => { if (e.target === e.currentTarget) setViewId(null); }}
        >
          <div className="bg-card rounded-xl p-6 w-full max-w-lg shadow-2xl animate-fade-in max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-heading font-semibold text-lg">{viewComp.title}</h3>
                <p className="mono-id text-xs mt-1">{viewComp.id}</p>
              </div>
              <button
                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted"
                onClick={() => setViewId(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className={getPriorityClass(viewComp.priority)}>{viewComp.priority}</span>
                <span className={getStatusClass(viewComp.status)}>{viewComp.status}</span>
                <span className="badge-pill bg-muted text-muted-foreground">{viewComp.category}</span>
                {viewComp.isSOS && (
                  <span className="badge-pill bg-destructive text-destructive-foreground">🚨 SOS</span>
                )}
              </div>

              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground font-medium mb-1">Description</p>
                <p>{viewComp.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Citizen</p><p className="font-medium">{viewComp.citizenName}</p></div>
                <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{viewComp.citizenPhone}</p></div>
                {viewComp.citizenEmail && (
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Email</p><p className="font-medium text-accent">{viewComp.citizenEmail}</p></div>
                )}
                <div><p className="text-xs text-muted-foreground">Zone</p><p className="font-medium">Zone {viewComp.ward}</p></div>
                <div><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">{viewComp.location || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Submitted</p><p className="font-medium">{viewComp.createdAt}</p></div>
                <div><p className="text-xs text-muted-foreground">Updated</p><p className="font-medium">{viewComp.updatedAt}</p></div>
              </div>

              {viewComp.gpsCoords && (
                <p className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                  📍 {viewComp.gpsCoords.lat}, {viewComp.gpsCoords.lng}
                </p>
              )}
              {viewComp.assignedOfficer && <p>👷 <strong>{viewComp.assignedOfficer}</strong></p>}
              {viewComp.adminNote && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-600 mb-1">Admin Note</p>
                  <p>{viewComp.adminNote}</p>
                </div>
              )}
              {viewComp.photo && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Issue Photo</p>
                  <img src={viewComp.photo} className="rounded-lg max-h-40 w-full object-cover" alt="Issue" />
                </div>
              )}
              {viewComp.resolvePhoto && (
                <div>
                  <p className="text-xs text-green-600 mb-1 font-medium">✅ Resolution Photo</p>
                  <img src={viewComp.resolvePhoto} className="rounded-lg max-h-40 w-full object-cover" alt="Resolved" />
                </div>
              )}
              {viewComp.feedback && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-yellow-700 mb-1">Citizen Feedback</p>
                  <p>{'⭐'.repeat(viewComp.feedback.rating)} ({viewComp.feedback.rating}/5)</p>
                  {viewComp.feedback.comment && (
                    <p className="text-xs italic mt-1 text-muted-foreground">"{viewComp.feedback.comment}"</p>
                  )}
                </div>
              )}

              {/* Quick status update inside modal */}
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Quick Status Update</p>
                <div className="relative">
                  <select
                    value={viewComp.status}
                    onChange={e => handleStatusChange(viewComp.id, e.target.value)}
                    disabled={updatingId === viewComp.id}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                  >
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  {updatingId === viewComp.id && (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground pointer-events-none" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="bg-card rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="font-heading font-semibold">Delete Complaint?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              <span className="mono-id">{deleteConfirmId}</span>
            </p>
            <p className="text-xs text-destructive mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deletingId === deleteConfirmId}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deletingId === deleteConfirmId}
                onClick={() => handleDelete(deleteConfirmId)}
              >
                {deletingId === deleteConfirmId ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 className="h-4 w-4 mr-1" /> Delete</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}