import { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import CitizenLayout from '@/components/CitizenLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Gift, Star, Award, Download, CheckCircle, Lock,
  Sparkles, Medal, Heart, Leaf, Droplets, Users,
  Shield, Copy, X, BadgeIndianRupee, ChevronRight,
  AlertTriangle, FileText,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────
interface Coupon {
  id: string;
  brand: string;
  logo: string;
  category: string;
  discount: string;
  pointsCost: number;
  description: string;
  validTill: string;
  color: string;
  bgColor: string;
}

interface SocialActivity {
  id: string;
  title: string;
  icon: any;
  description: string;
  date: string;
  location: string;
  pointsRequired: number;
  spotsLeft: number;
  color: string;
  category: string;
}

// ─── Static Data ────────────────────────────────────────────────
const GOVERNMENT_COUPONS: Coupon[] = [
  {
    id: 'c1', brand: 'MSRTC Bus Pass', logo: '🚌', category: 'Transport',
    discount: '₹50 Off', pointsCost: 200,
    description: 'Flat ₹50 discount on monthly MSRTC bus pass',
    validTill: '2026-04-30', color: '#1d4ed8', bgColor: '#eff6ff',
  },
  {
    id: 'c2', brand: 'Municipal Water Bill', logo: '💧', category: 'Utilities',
    discount: '₹100 Off', pointsCost: 350,
    description: '₹100 waived off on next monthly water bill',
    validTill: '2026-03-31', color: '#0891b2', bgColor: '#ecfeff',
  },
  {
    id: 'c3', brand: 'Govt Hospital OPD', logo: '🏥', category: 'Healthcare',
    discount: 'Free OPD', pointsCost: 400,
    description: 'Free OPD consultation at Civil Hospital Nashik',
    validTill: '2026-05-31', color: '#059669', bgColor: '#ecfdf5',
  },
  {
    id: 'c4', brand: 'NMC Property Tax', logo: '🏛️', category: 'Taxes',
    discount: '₹200 Off', pointsCost: 600,
    description: '₹200 discount on property tax payment via NMC portal',
    validTill: '2026-06-30', color: '#7c3aed', bgColor: '#f5f3ff',
  },
  {
    id: 'c5', brand: 'Municipal Parking', logo: '🅿️', category: 'Transport',
    discount: '₹75 Off', pointsCost: 250,
    description: '₹75 off on monthly parking pass at any NMC parking lot',
    validTill: '2026-04-15', color: '#b45309', bgColor: '#fffbeb',
  },
  {
    id: 'c6', brand: 'ZP School Stationery', logo: '📚', category: 'Education',
    discount: '₹500 Off', pointsCost: 1200,
    description: '₹500 off on stationery kit for ZP school students',
    validTill: '2026-07-01', color: '#be185d', bgColor: '#fdf2f8',
  },
  {
    id: 'c7', brand: 'ST Bus Season Pass', logo: '🎫', category: 'Transport',
    discount: '₹150 Off', pointsCost: 500,
    description: '₹150 off on quarterly ST bus season pass',
    validTill: '2026-05-15', color: '#0f766e', bgColor: '#f0fdfa',
  },
  {
    id: 'c8', brand: 'Anganwadi Nutrition', logo: '🥗', category: 'Nutrition',
    discount: 'Free Kit', pointsCost: 800,
    description: 'Free nutrition kit for one family member via Anganwadi',
    validTill: '2026-04-30', color: '#c2410c', bgColor: '#fff7ed',
  },
];

const SOCIAL_ACTIVITIES: SocialActivity[] = [
  {
    id: 'a1', title: 'Nashik Green Drive — Plant a Tree',
    icon: Leaf,
    description: 'Plant a sapling in Gangapur Dam area. Your name etched on a dedication board permanently.',
    date: '2026-03-08', location: 'Gangapur Dam, Nashik',
    pointsRequired: 300, spotsLeft: 24, color: '#16a34a', category: 'Environment',
  },
  {
    id: 'a2', title: 'City Blood Donation Camp',
    icon: Heart,
    description: 'Donate blood at Civil Hospital. Receive a Social Hero certificate from the Municipal Commissioner.',
    date: '2026-03-15', location: 'Civil Hospital, Nashik Road',
    pointsRequired: 200, spotsLeft: 50, color: '#dc2626', category: 'Health',
  },
  {
    id: 'a3', title: 'Ward Cleanliness Brigade',
    icon: Sparkles,
    description: 'Lead a cleanliness drive in your ward. Featured in local news and NMC newsletter.',
    date: '2026-03-22', location: 'Your Ward',
    pointsRequired: 150, spotsLeft: 100, color: '#2563eb', category: 'Sanitation',
  },
  {
    id: 'a4', title: 'Water Conservation Workshop',
    icon: Droplets,
    description: 'Teach water conservation methods to school students. Featured in NMC social media.',
    date: '2026-04-05', location: 'Municipal School, Nashik',
    pointsRequired: 250, spotsLeft: 15, color: '#0891b2', category: 'Environment',
  },
  {
    id: 'a5', title: 'Senior Citizen Tech Help Day',
    icon: Users,
    description: 'Help senior citizens learn digital services at the Municipal office. Name on appreciation wall.',
    date: '2026-04-12', location: 'NMC Office, Nashik',
    pointsRequired: 180, spotsLeft: 30, color: '#7c3aed', category: 'Social',
  },
];

// ─── Certificate Modal ──────────────────────────────────────────
function CertificateModal({ user, onClose }: { user: any; onClose: () => void }) {
  const certRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const certNo = `NMC/JANVANI/${new Date().getFullYear()}/${String(user?.points || 0).padStart(6, '0')}`;
  const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const handleDownload = async () => {
    setDownloading(true);
    toast({ title: '⏳ Generating PDF certificate…' });
    try {
      const { default: jsPDF }      = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      if (!certRef.current) return;
      const canvas  = await html2canvas(certRef.current, { scale: 2, useCORS: true, backgroundColor: '#fff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      pdf.save(`JANVANI_Certificate_${user?.name?.replace(/\s+/g, '_')}.pdf`);
      toast({ title: '✅ Certificate downloaded!' });
    } catch {
      // Fallback: browser print
      const printWindow = window.open('', '_blank');
      if (printWindow && certRef.current) {
        printWindow.document.write(
          `<html><head><title>Certificate</title>
           <style>body{margin:0;padding:0;}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style>
           </head><body>${certRef.current.outerHTML}</body></html>`
        );
        printWindow.document.close();
        printWindow.print();
        toast({ title: '🖨️ Print dialog opened' });
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" /> Certificate of Appreciation
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="hero" size="sm" onClick={handleDownload} disabled={downloading}>
              <Download className="h-4 w-4 mr-1" />
              {downloading ? 'Generating…' : 'Download PDF'}
            </Button>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div
            ref={certRef}
            style={{
              background: 'linear-gradient(135deg, #fef9c3 0%, #fff 40%, #fef9c3 100%)',
              border: '12px solid',
              borderColor: '#b45309',
              fontFamily: 'Georgia, serif',
              padding: '40px',
              position: 'relative',
              minHeight: '480px',
            }}
          >
            {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
              <div key={i} className={`absolute ${pos} text-yellow-600 text-2xl opacity-60`}>❋</div>
            ))}

            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-4 mb-3">
                <div className="h-16 w-16 rounded-full bg-amber-100 border-4 border-amber-400 flex items-center justify-center text-2xl">🏛️</div>
                <div>
                  <p style={{ color: '#92400e', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>
                    NASHIK MUNICIPAL CORPORATION
                  </p>
                  <p style={{ color: '#78350f', fontSize: '10px', letterSpacing: '2px', fontFamily: 'Arial, sans-serif' }}>
                    JANVANI — CITIZEN GRIEVANCE PORTAL
                  </p>
                </div>
                <div className="h-16 w-16 rounded-full bg-amber-100 border-4 border-amber-400 flex items-center justify-center text-2xl">🇮🇳</div>
              </div>
              <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #b45309, transparent)', margin: '8px 0' }} />
            </div>

            <div className="text-center mb-6">
              <p style={{ fontSize: '13px', color: '#92400e', letterSpacing: '4px', fontFamily: 'Arial, sans-serif', textTransform: 'uppercase' }}>
                Certificate of Appreciation
              </p>
              <p style={{ fontSize: '11px', color: '#b45309', letterSpacing: '2px', fontFamily: 'Arial, sans-serif' }}>— प्रशस्तिपत्र —</p>
            </div>

            <div className="text-center mb-6">
              <p style={{ fontSize: '14px', color: '#44403c', marginBottom: '12px', fontFamily: 'Georgia, serif' }}>
                This is to proudly certify that
              </p>
              <p style={{
                fontSize: '32px', color: '#78350f', fontWeight: 'bold',
                borderBottom: '2px solid #b45309', display: 'inline-block',
                padding: '0 24px 4px', marginBottom: '12px', fontFamily: 'Georgia, serif',
              }}>
                {user?.name || 'Citizen Name'}
              </p>
              <p style={{ fontSize: '13px', color: '#78350f', marginBottom: '16px', fontFamily: 'Arial, sans-serif' }}>
                Ward {user?.ward || '—'} · JANVANI Citizen ID: {(user?.id || user?._id || '')?.slice(-8)?.toUpperCase() || 'N/A'}
              </p>
              <p style={{ fontSize: '14px', color: '#44403c', lineHeight: '1.8', maxWidth: '520px', margin: '0 auto 16px', fontFamily: 'Georgia, serif' }}>
                has demonstrated exceptional civic responsibility and commitment to urban governance
                by actively participating in the JANVANI platform, reporting civic issues, supporting
                community welfare, and earning the distinguished
              </p>
              <p style={{
                fontSize: '22px', color: '#b45309', fontWeight: 'bold', fontFamily: 'Georgia, serif',
                background: '#fef3c7', display: 'inline-block', padding: '4px 20px', borderRadius: '4px',
                border: '1px solid #f59e0b',
              }}>
                {user?.badge || 'Bronze'} Social Hero
              </p>
              <p style={{ fontSize: '13px', color: '#44403c', marginTop: '12px', fontFamily: 'Arial, sans-serif' }}>
                with a total of <strong style={{ color: '#92400e' }}>{(user?.points || 0).toLocaleString()} Civic Points</strong> earned on the platform.
              </p>
            </div>

            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #b45309, transparent)', margin: '16px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '10px', color: '#92400e', fontFamily: 'Arial, sans-serif' }}>Certificate No.</p>
                <p style={{ fontSize: '10px', color: '#78350f', fontWeight: 'bold', fontFamily: 'monospace' }}>{certNo}</p>
                <p style={{ fontSize: '10px', color: '#92400e', marginTop: '4px', fontFamily: 'Arial, sans-serif' }}>Date: {issueDate}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', border: '2px solid #b45309', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', background: '#fef3c7' }}>
                  <p style={{ fontSize: '9px', color: '#92400e', textAlign: 'center', fontFamily: 'Arial, sans-serif', lineHeight: '1.3' }}>DIGITALLY<br />VERIFIED<br />✓<br />NMC JANVANI</p>
                </div>
                <p style={{ fontSize: '9px', color: '#b45309', marginTop: '4px', fontFamily: 'Arial, sans-serif' }}>Official Seal</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #78350f', paddingBottom: '4px', marginBottom: '4px', width: '140px' }}>
                  <p style={{ fontSize: '11px', color: '#78350f', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Municipal Commissioner</p>
                </div>
                <p style={{ fontSize: '10px', color: '#92400e', fontFamily: 'Arial, sans-serif' }}>Nashik Municipal Corporation</p>
                <p style={{ fontSize: '9px', color: '#b45309', fontFamily: 'Arial, sans-serif' }}>Government of Maharashtra</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Redeem Modal ───────────────────────────────────────────────
function RedeemModal({ coupon, onClose }: { coupon: Coupon; onClose: () => void }) {
  const { toast } = useToast();
  const code = `JANVANI-${coupon.id.toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-4">
          <span className="text-5xl">{coupon.logo}</span>
          <h3 className="font-heading font-bold text-lg mt-2">{coupon.brand}</h3>
          <p className="text-3xl font-black text-accent">{coupon.discount}</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center mb-4">
          <p className="text-xs text-muted-foreground mb-1">Your Voucher Code</p>
          <p className="font-mono font-bold text-base tracking-widest">{code}</p>
          <button
            className="mt-2 text-xs text-accent flex items-center gap-1 mx-auto hover:underline"
            onClick={() => { navigator.clipboard.writeText(code); toast({ title: '📋 Code copied!' }); }}
          >
            <Copy className="h-3 w-3" /> Copy Code
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center mb-4">
          {coupon.description}<br />
          Valid till: {new Date(coupon.validTill).toLocaleDateString('en-IN')}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
          <Button variant="hero" className="flex-1" onClick={() => { navigator.clipboard.writeText(code); toast({ title: '📋 Copied & ready to use!' }); }}>
            <Copy className="h-4 w-4 mr-1" /> Copy & Use
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Coupon Card ────────────────────────────────────────────────
function CouponCard({ coupon, userPoints, onRedeem }: { coupon: Coupon; userPoints: number; onRedeem: (c: Coupon) => void }) {
  const canAfford = userPoints >= coupon.pointsCost;
  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg ${canAfford ? 'border-border hover:border-accent/50' : 'border-border/40 opacity-60'}`}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: coupon.bgColor }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{coupon.logo}</span>
          <div>
            <p className="font-heading font-bold text-sm" style={{ color: coupon.color }}>{coupon.brand}</p>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white inline-block" style={{ backgroundColor: coupon.color }}>{coupon.category}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-heading font-black" style={{ color: coupon.color }}>{coupon.discount}</p>
          <p className="text-[10px] text-muted-foreground">Voucher</p>
        </div>
      </div>
      <div className="p-3 space-y-2 bg-card">
        <p className="text-xs text-muted-foreground">{coupon.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Valid till: <span className="font-medium">{new Date(coupon.validTill).toLocaleDateString('en-IN')}</span>
          </span>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-bold text-yellow-600">{coupon.pointsCost} pts</span>
          </div>
        </div>
        <Button
          size="sm"
          className="w-full text-xs"
          style={canAfford ? { backgroundColor: coupon.color, color: '#fff' } : {}}
          variant={canAfford ? 'default' : 'outline'}
          disabled={!canAfford}
          onClick={() => onRedeem(coupon)}
        >
          {canAfford
            ? <><Gift className="h-3 w-3 mr-1" /> Redeem Now</>
            : <><Lock className="h-3 w-3 mr-1" /> Need {coupon.pointsCost - userPoints} more pts</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Activity Card ──────────────────────────────────────────────
function ActivityCard({ activity, userPoints, onRegister, registered }: {
  activity: SocialActivity; userPoints: number;
  onRegister: (a: SocialActivity) => void; registered: boolean;
}) {
  const canJoin  = userPoints >= activity.pointsRequired;
  const IconComp = activity.icon;
  return (
    <div className="card-elevated p-4 space-y-3 border-l-4 transition-all hover:shadow-md" style={{ borderLeftColor: activity.color }}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: activity.color + '20' }}>
          <IconComp className="h-5 w-5" style={{ color: activity.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: activity.color }}>{activity.category}</span>
            <span className="text-[10px] text-muted-foreground">{activity.spotsLeft} spots left</span>
          </div>
          <h4 className="font-heading font-semibold text-sm">{activity.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>📅 {new Date(activity.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <span>📍 {activity.location}</span>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
          <span className="text-xs font-bold text-yellow-600">{activity.pointsRequired} pts required</span>
        </div>
        {registered ? (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle className="h-3 w-3" /> Registered
          </span>
        ) : (
          <Button
            size="sm"
            className="text-xs h-7"
            style={canJoin ? { backgroundColor: activity.color, color: '#fff' } : {}}
            variant={canJoin ? 'default' : 'outline'}
            disabled={!canJoin}
            onClick={() => onRegister(activity)}
          >
            {canJoin ? 'Register →' : <><Lock className="h-3 w-3 mr-1" />Locked</>}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function CitizenRewards() {
  const { currentUser, myComplaints } = useApp();
  const { toast } = useToast();

  const [activeTab, setActiveTab]           = useState<'coupons' | 'activities' | 'certificate'>('coupons');
  const [showCert, setShowCert]             = useState(false);
  const [redeeming, setRedeeming]           = useState<Coupon | null>(null);
  const [registeredActivities, setRegistered] = useState<Set<string>>(new Set());
  const [catFilter, setCatFilter]           = useState('All');

  // Derive real stats from context — no hardcoded values
  const pts    = currentUser?.points || 0;
  const badge  = currentUser?.badge  || 'Bronze';

  const nextBadge = badge === 'Bronze' ? 'Silver' : badge === 'Silver' ? 'Gold' : null;
  const nextPts   = badge === 'Bronze' ? 500 : badge === 'Silver' ? 1000 : null;
  const progress  = nextPts ? Math.min(100, (pts / nextPts) * 100) : 100;

  // Real SOS count from user's actual complaints
  const sosCount = myComplaints.filter(c => c.isSOS).length;

  const couponCategories = ['All', ...Array.from(new Set(GOVERNMENT_COUPONS.map(c => c.category)))];
  const filteredCoupons  = catFilter === 'All'
    ? GOVERNMENT_COUPONS
    : GOVERNMENT_COUPONS.filter(c => c.category === catFilter);

  const unlockedCount = GOVERNMENT_COUPONS.filter(c => pts >= c.pointsCost).length;

  const handleRedeem = (coupon: Coupon) => {
    if (pts < coupon.pointsCost) return;
    setRedeeming(coupon);
  };

  const handleRegister = (activity: SocialActivity) => {
    if (registeredActivities.has(activity.id)) {
      toast({ title: 'Already registered!', description: activity.title }); return;
    }
    setRegistered(prev => new Set([...prev, activity.id]));
    toast({ title: `✅ Registered for ${activity.title}!`, description: `📅 ${activity.date} · 📍 ${activity.location}` });
  };

  const tabs = [
    { id: 'coupons',     label: 'Govt. Coupons',     icon: BadgeIndianRupee, count: unlockedCount },
    { id: 'activities',  label: 'Social Activities',  icon: Heart,            count: SOCIAL_ACTIVITIES.filter(a => pts >= a.pointsRequired).length },
    { id: 'certificate', label: 'My Certificate',     icon: Award,            count: null },
  ] as const;

  return (
    <CitizenLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Hero Points Card ── */}
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent opacity-95" />
          <div className="relative p-6 text-primary-foreground">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold border border-white/30">
                  {badge === 'Gold' ? '🥇' : badge === 'Silver' ? '🥈' : '🥉'}
                </div>
                <div>
                  <p className="text-primary-foreground/70 text-sm">Your Civic Points</p>
                  <p className="text-4xl font-heading font-black">{pts.toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">{badge} Hero</span>
                    {nextBadge && (
                      <span className="text-xs text-primary-foreground/60">
                        {nextPts! - pts} pts to {nextBadge}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { label: 'Submitted', value: currentUser?.complaintsSubmitted || 0 },
                  { label: 'Resolved',  value: currentUser?.complaintsResolved  || 0 },
                  { label: 'Unlocked',  value: unlockedCount },
                ].map(s => (
                  <div key={s.label}>
                    <p className="text-xl font-heading font-bold">{s.value}</p>
                    <p className="text-[10px] text-primary-foreground/60">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            {nextBadge && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-primary-foreground/70 mb-1">
                  <span>{badge}</span><span>{nextBadge}</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── How to Earn Strip ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: '📋', action: 'Submit complaint', pts: '+50' },
            { icon: '✅', action: 'Get resolved',     pts: '+100' },
            { icon: '⭐', action: 'Give feedback',    pts: '+25' },
            { icon: '👍', action: 'Support issue',    pts: '+10' },
          ].map(e => (
            <div key={e.action} className="card-elevated p-3 text-center">
              <p className="text-xl">{e.icon}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{e.action}</p>
              <p className="text-xs font-bold text-green-600">{e.pts}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === t.id
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
              {t.count !== null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === t.id ? 'bg-accent text-white' : 'bg-muted-foreground/20'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ COUPONS TAB ══ */}
        {activeTab === 'coupons' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-heading font-bold text-lg">Government Vouchers & Coupons</h2>
                <p className="text-xs text-muted-foreground">Redeem your civic points for real government service discounts</p>
              </div>
              <div className="flex gap-1 flex-wrap">
                {couponCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCatFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      catFilter === cat ? 'bg-accent text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
              <Shield className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                All coupons are issued by <strong>Nashik Municipal Corporation</strong> and partnered government departments.
                Voucher codes are valid at respective offices and portals.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {filteredCoupons.map(coupon => (
                <CouponCard key={coupon.id} coupon={coupon} userPoints={pts} onRedeem={handleRedeem} />
              ))}
            </div>
          </div>
        )}

        {/* ══ ACTIVITIES TAB ══ */}
        {activeTab === 'activities' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-heading font-bold text-lg">Social Hero Activities</h2>
              <p className="text-xs text-muted-foreground">Participate in city-wide drives. Your name on permanent boards. Featured in NMC media.</p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">🏆</div>
                <div>
                  <p className="font-heading font-semibold text-green-800 dark:text-green-200">Social Hero Recognition</p>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Participate in activities to get your name on city-wide dedication boards, featured in local news,
                    and receive a personalized Certificate of Appreciation from the Municipal Commissioner.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {SOCIAL_ACTIVITIES.map(activity => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  userPoints={pts}
                  onRegister={handleRegister}
                  registered={registeredActivities.has(activity.id)}
                />
              ))}
            </div>

            {registeredActivities.size > 0 && (
              <div className="card-elevated p-4 bg-green-50/50 dark:bg-green-900/10 border border-green-200">
                <h3 className="font-heading font-semibold text-sm text-green-700 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> You're Registered For
                </h3>
                {SOCIAL_ACTIVITIES.filter(a => registeredActivities.has(a.id)).map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-sm py-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>{a.title}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{a.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ CERTIFICATE TAB ══ */}
        {activeTab === 'certificate' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-heading font-bold text-lg">Certificate of Appreciation</h2>
              <p className="text-xs text-muted-foreground">Your permanent government-authenticated recognition for civic contributions</p>
            </div>

            {/* Preview */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400" />
              <div className="p-6 text-center space-y-4">
                <div className="flex justify-center gap-6 mb-2">
                  <span className="text-4xl">🏛️</span>
                  <span className="text-4xl">📜</span>
                  <span className="text-4xl">🇮🇳</span>
                </div>
                <div>
                  <p className="text-xs tracking-widest text-amber-700 font-medium uppercase">Nashik Municipal Corporation</p>
                  <p className="text-2xl font-heading font-black text-amber-900 mt-1">Certificate of Appreciation</p>
                  <p className="text-amber-700 text-sm mt-1">प्रशस्तिपत्र</p>
                </div>
                <div className="border-t border-b border-amber-300 py-4 my-2">
                  <p className="text-sm text-amber-800">Proudly awarded to</p>
                  <p className="text-3xl font-heading font-black text-amber-900 mt-1">{currentUser?.name}</p>
                  <p className="text-sm text-amber-700 mt-1">Ward {currentUser?.ward} · {badge} Social Hero</p>
                  <p className="text-sm font-semibold text-amber-800 mt-2">{pts.toLocaleString()} Civic Points Earned</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-amber-800">
                  {[
                    { label: 'Permanent', sub: 'Record' },
                    { label: 'Govt.',     sub: 'Authenticated' },
                    { label: 'PDF',       sub: 'Download' },
                  ].map(item => (
                    <div key={item.label} className="bg-amber-100 rounded-lg p-2">
                      <p className="font-bold">{item.label}</p>
                      <p className="text-amber-600">{item.sub}</p>
                    </div>
                  ))}
                </div>
                <Button
                  variant="hero"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => setShowCert(true)}
                >
                  <Award className="h-4 w-4 mr-2" /> View & Download Certificate
                </Button>
              </div>
            </div>

            {/* Achievements — uses real data from context */}
            <div className="card-elevated p-4">
              <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <Medal className="h-4 w-4 text-accent" /> Your Achievements
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Complaints Filed', value: currentUser?.complaintsSubmitted || 0, icon: '📋', unlocked: (currentUser?.complaintsSubmitted || 0) > 0 },
                  { label: 'Issues Resolved',  value: currentUser?.complaintsResolved  || 0, icon: '✅', unlocked: (currentUser?.complaintsResolved  || 0) > 0 },
                  { label: 'Points Earned',    value: pts,                                    icon: '⭐', unlocked: pts > 0 },
                  { label: 'Badge Level',      value: badge,                                  icon: badge === 'Gold' ? '🥇' : badge === 'Silver' ? '🥈' : '🥉', unlocked: true },
                  { label: 'Activities Joined',value: registeredActivities.size,              icon: '🌱', unlocked: registeredActivities.size > 0 },
                  { label: 'SOS Reported',     value: sosCount,                               icon: '🚨', unlocked: sosCount > 0 },
                ].map(a => (
                  <div
                    key={a.label}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      a.unlocked ? 'bg-accent/5 border border-accent/20' : 'bg-muted/30 opacity-50'
                    }`}
                  >
                    <span className="text-xl">{a.icon}</span>
                    <div>
                      <p className="font-bold text-sm">{a.value}</p>
                      <p className="text-xs text-muted-foreground">{a.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {redeeming && <RedeemModal coupon={redeeming} onClose={() => setRedeeming(null)} />}
      {showCert  && <CertificateModal user={currentUser} onClose={() => setShowCert(false)} />}
    </CitizenLayout>
  );
}