/**
 * Frontend/src/pages/citizen/Track.tsx
 * Shows complaint status + acknowledgement document when resolved
 */

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import CitizenLayout from '@/components/CitizenLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, FileDown, CheckCircle, Clock, AlertTriangle, XCircle, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STATUS_STEPS = ['Submitted', 'Under Review', 'In Progress', 'Resolved'];

const STATUS_INFO: Record<string, { color: string; icon: any; bg: string }> = {
  'Submitted'   : { color: 'text-blue-600',  icon: Clock,         bg: 'bg-blue-50'   },
  'Under Review': { color: 'text-yellow-600', icon: Eye,           bg: 'bg-yellow-50' },
  'In Progress' : { color: 'text-orange-600', icon: RefreshCw,     bg: 'bg-orange-50' },
  'Resolved'    : { color: 'text-green-600',  icon: CheckCircle,   bg: 'bg-green-50'  },
  'Rejected'    : { color: 'text-red-600',    icon: XCircle,       bg: 'bg-red-50'    },
  'Critical'    : { color: 'text-red-700',    icon: AlertTriangle, bg: 'bg-red-50'    },
};

function AckDocument({ complaint }: { complaint: any }) {
  const ref = useRef<HTMLDivElement>(null);

  const printDoc = () => {
    const content = ref.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head>
        <title>Resolution Certificate — ${complaint.complaintId || complaint.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; }
          .seal { font-size: 48px; }
          h1 { color: #1e40af; margin: 8px 0 4px; }
          .subtitle { color: #64748b; font-size: 14px; }
          .cert-id { background: #f0f9ff; border: 1px solid #bae6fd; padding: 12px 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
          .field { background: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #1e40af; }
          .field label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
          .field p { font-weight: 600; margin: 4px 0 0; color: #0f172a; }
          .photos { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
          .photo-box { text-align: center; }
          .photo-box img { width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; }
          .photo-box p { font-size: 12px; color: #64748b; margin-top: 8px; }
          .note { background: #f0fdf4; border: 1px solid #86efac; padding: 16px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
          .stamp { display: inline-block; border: 3px solid #16a34a; color: #16a34a; padding: 8px 24px; border-radius: 4px; font-weight: 700; font-size: 16px; transform: rotate(-10deg); margin: 16px 0; }
        </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  const resolvedDate = complaint.resolveDate
    ? new Date(complaint.resolveDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(complaint.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header bar */}
      <div className="bg-green-600 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5" />
          <div>
            <p className="font-semibold text-sm">Resolution Certificate</p>
            <p className="text-green-100 text-xs">Official acknowledgement document</p>
          </div>
        </div>
        <Button size="sm" variant="outline"
          className="bg-white text-green-700 hover:bg-green-50 border-white gap-1 text-xs"
          onClick={printDoc}>
          <FileDown className="h-3.5 w-3.5" /> Download / Print
        </Button>
      </div>

      {/* Printable content */}
      <div ref={ref} className="p-6 space-y-5">

        {/* Document header */}
        <div className="text-center border-b border-border pb-5">
          <div className="text-4xl mb-2">🏛️</div>
          <h2 className="text-xl font-bold text-primary">JANVANI Municipal Corporation</h2>
          <p className="text-sm text-muted-foreground">Nashik, Maharashtra</p>
          <h3 className="text-base font-semibold mt-3 text-green-700">COMPLAINT RESOLUTION CERTIFICATE</h3>
        </div>

        {/* Certificate ID */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <p className="text-xs text-blue-600 font-medium">Certificate Reference</p>
          <p className="font-mono font-bold text-blue-800">CERT-{(complaint.complaintId || complaint.id).toUpperCase()}</p>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Complaint ID',      value: complaint.complaintId || complaint.id },
            { label: 'Citizen Name',      value: complaint.citizenName || 'N/A' },
            { label: 'Category',          value: complaint.category },
            { label: 'Priority',          value: complaint.priority },
            { label: 'Ward / Zone',       value: `Zone ${complaint.ward}` },
            { label: 'Resolved By',       value: complaint.assignedOfficer || 'Municipal Officer' },
            { label: 'Date Submitted',    value: new Date(complaint.createdAt).toLocaleDateString('en-IN') },
            { label: 'Date Resolved',     value: resolvedDate },
          ].map(f => (
            <div key={f.label} className="bg-muted/40 rounded-lg p-3 border-l-4 border-primary">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{f.label}</p>
              <p className="font-semibold text-sm mt-0.5">{f.value}</p>
            </div>
          ))}
        </div>

        {/* Complaint title */}
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Complaint Title</p>
          <p className="font-semibold">{complaint.title}</p>
        </div>

        {/* Before / After Photos */}
        {(complaint.beforePhoto || complaint.resolvePhoto) && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Photo Evidence</p>
            <div className="grid grid-cols-2 gap-3">
              {complaint.beforePhoto && (
                <div className="text-center">
                  <img src={complaint.beforePhoto} alt="Before" className="w-full h-36 object-cover rounded-lg border" />
                  <p className="text-xs text-muted-foreground mt-1">📷 Before</p>
                </div>
              )}
              {complaint.resolvePhoto && (
                <div className="text-center">
                  <img src={complaint.resolvePhoto} alt="After (Proof)" className="w-full h-36 object-cover rounded-lg border border-green-300" />
                  <p className="text-xs text-green-600 font-medium mt-1">✅ After (Resolution Proof)</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resolution note */}
        {complaint.adminNote && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Resolution Notes</p>
            <p className="text-sm text-green-900">{complaint.adminNote}</p>
          </div>
        )}

        {/* Official stamp */}
        <div className="text-center py-4">
          <div className="inline-block border-4 border-green-600 text-green-600 px-8 py-2 rounded font-bold text-lg"
            style={{ transform: 'rotate(-8deg)' }}>
            ✅ RESOLVED
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground border-t border-border pt-4 space-y-1">
          <p>This is an official document issued by JANVANI Municipal Corporation, Nashik.</p>
          <p>Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p className="font-mono text-[10px]">Verification: {complaint.id}</p>
        </div>
      </div>
    </div>
  );
}

export default function CitizenTrack() {
  const [searchParams] = useSearchParams();
  const { myComplaints, refreshComplaints } = useApp();
  const { t } = useTranslation();
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    refreshComplaints();
  }, []); // eslint-disable-line

  const idParam    = searchParams.get('id');
  const [selected, setSelected] = useState<string | null>(idParam || null);

  const safe       = Array.isArray(myComplaints) ? myComplaints : [];
  const complaint  = selected ? safe.find(c => c.complaintId === selected || c.id === selected) : null;

  // Auto-refresh every 15s for live status
  useEffect(() => {
    const interval = setInterval(() => refreshComplaints(), 15_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  const stepIndex  = complaint ? STATUS_STEPS.indexOf(complaint.status) : -1;
  const isResolved = complaint?.status === 'Resolved';
  const isRejected = complaint?.status === 'Rejected';
  const info       = complaint ? (STATUS_INFO[complaint.status] || STATUS_INFO['Submitted']) : null;

  return (
    <CitizenLayout>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          {selected && (
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="text-2xl font-heading font-bold">{t('citizen.track.title', 'Issue Tracking')}</h1>
        </div>

        {/* Complaint list */}
        {!selected && (
          <div className="space-y-3">
            {safe.length === 0 ? (
              <div className="card-elevated p-10 text-center text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No complaints yet</p>
                <p className="text-sm mt-1">Submit a complaint to start tracking it here.</p>
              </div>
            ) : safe.map(c => (
              <button key={c.id} onClick={() => setSelected(c.complaintId || c.id)}
                className="w-full card-elevated p-4 flex items-center gap-4 hover:shadow-md transition-shadow text-left">
                <div className={`h-3 w-3 rounded-full flex-shrink-0 ${
                  c.status === 'Resolved'     ? 'bg-green-500' :
                  c.status === 'In Progress'  ? 'bg-blue-500 animate-pulse' :
                  c.status === 'Under Review' ? 'bg-yellow-500 animate-pulse' :
                  c.status === 'Rejected'     ? 'bg-red-500' : 'bg-gray-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{c.complaintId || c.id}</p>
                  <p className="font-medium text-sm truncate mt-0.5">{c.title}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{c.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                      c.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>{c.status}</span>
                    {c.status === 'Resolved' && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">📄 Doc available</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Complaint detail */}
        {selected && complaint && (
          <div className="space-y-5">

            {/* Status card */}
            <div className={`card-elevated p-5 border-l-4 ${isResolved ? 'border-green-500' : isRejected ? 'border-red-500' : 'border-primary'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-mono text-xs text-muted-foreground">{complaint.complaintId || complaint.id}</p>
                  <h2 className="font-heading font-bold text-lg mt-1">{complaint.title}</h2>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{complaint.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      complaint.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                      complaint.priority === 'High'     ? 'bg-orange-100 text-orange-700' :
                      complaint.priority === 'Medium'   ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>{complaint.priority}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Zone {complaint.ward}</span>
                  </div>
                </div>
                {info && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${info.bg}`}>
                    <info.icon className={`h-4 w-4 ${info.color}`} />
                    <span className={`text-sm font-semibold ${info.color}`}>{complaint.status}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            {!isRejected && (
              <div className="card-elevated p-5">
                <p className="text-sm font-semibold mb-4">Live Status Tracking
                  <span className="ml-2 text-xs text-green-500 font-normal">● Live — auto-updates every 15s</span>
                </p>
                <div className="flex items-center justify-between">
                  {STATUS_STEPS.map((step, i) => {
                    const done    = stepIndex >= i;
                    const current = stepIndex === i;
                    return (
                      <div key={step} className="flex-1 flex flex-col items-center relative">
                        {i < STATUS_STEPS.length - 1 && (
                          <div className={`absolute left-1/2 top-4 h-0.5 w-full transition-colors ${done && stepIndex > i ? 'bg-green-500' : 'bg-muted'}`} />
                        )}
                        <div className={`relative z-10 h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all ${
                          done    ? 'bg-green-500 border-green-500 text-white' :
                          current ? 'bg-primary border-primary text-white animate-pulse' :
                                    'bg-background border-muted text-muted-foreground'
                        }`}>
                          {done ? <CheckCircle className="h-4 w-4" /> : <span className="text-xs font-bold">{i+1}</span>}
                        </div>
                        <p className={`text-[10px] mt-2 text-center font-medium ${done ? 'text-green-600' : 'text-muted-foreground'}`}>{step}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Complaint description */}
            <div className="card-elevated p-5 space-y-3 text-sm">
              <h3 className="font-semibold">Complaint Details</h3>
              <p className="text-muted-foreground leading-relaxed">{complaint.description}</p>
              {complaint.location && (
                <p className="text-muted-foreground">📍 {complaint.location}, Ward {complaint.ward}, Nashik</p>
              )}
              <p className="text-muted-foreground text-xs">Submitted: {new Date(complaint.createdAt).toLocaleString()}</p>
              {complaint.image && (
                <img src={complaint.image} alt="Complaint" className="w-full max-h-60 object-cover rounded-lg border" />
              )}
            </div>

            {/* Admin response */}
            {(complaint.adminNote || complaint.assignedOfficer || complaint.estimatedResolution) && (
              <div className="card-elevated p-5 space-y-2">
                <h3 className="font-semibold text-sm">Admin Response</h3>
                {complaint.estimatedResolution && (
                  <p className="text-sm text-muted-foreground">🗓️ Est. resolution: {new Date(complaint.estimatedResolution).toLocaleDateString()}</p>
                )}
                {complaint.assignedOfficer && (
                  <p className="text-sm">👷 Assigned Officer: <span className="font-medium">{complaint.assignedOfficer}</span></p>
                )}
                {complaint.adminNote && (
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Note from admin:</p>
                    <p className="text-sm">{complaint.adminNote}</p>
                  </div>
                )}
              </div>
            )}

            {/* ✅ Resolution proof photo — visible directly on track page */}
            {isResolved && complaint.resolvePhoto && (
              <div className="card-elevated overflow-hidden">
                <div className="bg-green-600 text-white px-4 py-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <p className="font-semibold text-sm">Resolution Proof Photo</p>
                </div>
                <div className={`p-4 ${complaint.beforePhoto ? 'grid grid-cols-2 gap-4' : ''}`}>
                  {complaint.beforePhoto && (
                    <div className="text-center">
                      <img src={complaint.beforePhoto} alt="Before"
                        className="w-full h-48 object-cover rounded-lg border" />
                      <p className="text-xs text-muted-foreground mt-2 font-medium">📷 Before</p>
                    </div>
                  )}
                  <div className="text-center">
                    <img src={complaint.resolvePhoto} alt="After — Resolution Proof"
                      className="w-full h-48 object-cover rounded-lg border-2 border-green-400" />
                    <p className="text-xs text-green-600 mt-2 font-semibold">✅ After — Resolution Proof</p>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ ACKNOWLEDGEMENT DOCUMENT — shown when resolved */}
            {isResolved && <AckDocument complaint={complaint} />}

            {/* Rejected state */}
            {isRejected && (
              <div className="card-elevated p-5 bg-red-50 border border-red-200">
                <div className="flex items-center gap-2 text-red-700 mb-2">
                  <XCircle className="h-5 w-5" />
                  <h3 className="font-semibold">Complaint Rejected</h3>
                </div>
                <p className="text-sm text-red-600">
                  {complaint.adminNote || 'Your complaint was reviewed and could not be processed. Please contact the municipal office for more information.'}
                </p>
              </div>
            )}

          </div>
        )}

        {/* Complaint not found */}
        {selected && !complaint && (
          <div className="card-elevated p-10 text-center text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Complaint not found</p>
            <p className="text-sm mt-1">ID: {selected}</p>
            <button onClick={() => setSelected(null)} className="mt-4 text-sm text-primary hover:underline">
              ← Back to list
            </button>
          </div>
        )}

      </div>
    </CitizenLayout>
  );
}