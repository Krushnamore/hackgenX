import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import CitizenLayout from '@/components/CitizenLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Camera, MapPin, Mic, Sparkles, CheckCircle, Loader2, AlertTriangle, XCircle, Map } from 'lucide-react';
import { CATEGORIES, type Category, type Priority } from '@/types';

// ─── Groq API Key — loaded from .env (NEVER hardcode secrets here) ────────────
const GROQ_API_KEY      = import.meta.env.VITE_GROQ_API_KEY as string;
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'; // vision capable
const GROQ_TEXT_MODEL   = 'llama3-70b-8192';

// ─── Call Groq chat completions ────────────────────────────────────────────────
async function groqChat(
  messages: Array<{ role: string; content: any }>,
  model = GROQ_TEXT_MODEL,
): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method : 'POST',
    headers : {
      'Content-Type'  : 'application/json',
      'Authorization' : `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 1024 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq API error ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Validate + analyse uploaded image via Groq vision ────────────────────────
interface ImageAnalysis {
  valid       : boolean;
  reason      : string;   // if invalid, why
  category    : Category;
  title       : string;
  description : string;
  priority    : Priority;
  severity    : string;   // short human-readable severity label
}

async function analyzeImageWithGroq(base64Image: string): Promise<ImageAnalysis> {
  // Strip the data-URL prefix for the API
  const base64Data = base64Image.split(',')[1] ?? base64Image;
  const mimeMatch  = base64Image.match(/data:(image\/\w+);base64,/);
  const mimeType   = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const systemPrompt = `You are an AI assistant for JANVANI, a civic complaint management system in Nashik, India.
Your job is to:
1. Validate whether the uploaded image actually shows a civic/municipal issue (road damage, water leak, garbage, electrical fault, etc.).
2. If the image is NOT related to a civic issue (e.g. selfie, random object, food, nature scene unrelated to civic problems), mark it invalid.
3. If valid, extract structured information about the issue.

Respond ONLY with a valid JSON object — no markdown, no explanation outside the JSON.

JSON schema:
{
  "valid": boolean,
  "reason": "string — if invalid, explain why in 1 sentence. if valid, leave empty string.",
  "category": "Road" | "Water" | "Sanitation" | "Electricity" | "Other",
  "title": "string — short concise title of the issue (max 60 chars)",
  "description": "string — 2-3 sentence professional description of the issue for municipal records",
  "priority": "Low" | "Medium" | "High" | "Critical",
  "severity": "string — one-word severity label e.g. Moderate, Severe, Critical, Minor"
}`;

  const userMessage = {
    role    : 'user',
    content : [
      {
        type       : 'image_url',
        image_url  : { url: `data:${mimeType};base64,${base64Data}` },
      },
      {
        type : 'text',
        text : 'Analyze this image and respond with the JSON as instructed.',
      },
    ],
  };

  const raw = await groqChat([{ role: 'system', content: systemPrompt }, userMessage], GROQ_VISION_MODEL);

  // Parse — strip possible markdown code fences
  const clean = raw.replace(/```json|```/g, '').trim();
  const parsed: ImageAnalysis = JSON.parse(clean);
  return parsed;
}

// ─── Generate AI description from text context (no image) ─────────────────────
async function generateDescriptionWithGroq(
  category: Category,
  ward: number,
  location: string,
): Promise<{ title: string; description: string; priority: Priority; estimated: string }> {
  const systemPrompt = `You are an AI assistant for JANVANI civic complaint system in Nashik, India.
Generate a professional complaint entry based on the given context.
Respond ONLY with valid JSON — no markdown, no extra text.

JSON schema:
{
  "title": "string (max 60 chars)",
  "description": "string (2-3 professional sentences for municipal records)",
  "priority": "Low" | "Medium" | "High" | "Critical",
  "daysToResolve": number
}`;

  const userMsg = `Category: ${category}\nWard: ${ward}\nLocation: ${location || 'Nashik'}\nGenerate complaint details.`;
  const raw     = await groqChat(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
    GROQ_TEXT_MODEL,
  );
  const clean  = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  const d = new Date();
  d.setDate(d.getDate() + (parsed.daysToResolve || 14));
  const estimated = d.toISOString().split('T')[0];

  return {
    title       : parsed.title,
    description : parsed.description,
    priority    : parsed.priority,
    estimated,
  };
}

// ─── Leaflet lazy-load (no npm install needed) ────────────────────────────────
let leafletReady: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (leafletReady) return leafletReady;
  leafletReady = new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id    = 'leaflet-css';
      link.rel   = 'stylesheet';
      link.href  = 'https://unpkg.com/leaflet/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if ((window as any).L) { resolve((window as any).L); return; }
    const script    = document.createElement('script');
    script.src      = 'https://unpkg.com/leaflet/dist/leaflet.js';
    script.onload   = () => resolve((window as any).L);
    script.onerror  = reject;
    document.head.appendChild(script);
  });
  return leafletReady;
}

// ─── Leaflet Map component ────────────────────────────────────────────────────
interface LeafletMapProps {
  lat      : number;
  lng      : number;
  onSelect : (lat: number, lng: number, address: string) => void;
}

function LeafletMap({ lat, lng, onSelect }: LeafletMapProps) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef   = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  // Reverse geocode via Nominatim
  const reverseGeocode = async (la: number, lo: number): Promise<string> => {
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const data = await res.json();
      const addr = data.address || {};
      const area = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || 'Nashik';
      const road = addr.road ? `${addr.road}, ` : '';
      return `${road}${area}`;
    } catch {
      return `${la.toFixed(4)}, ${lo.toFixed(4)}`;
    }
  };

  // Mount map once
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapRef.current || mapInstance.current) return;
      setLoading(false);

      const map = L.map(mapRef.current).setView([lat, lng], 15);
      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.icon({
        iconUrl     : 'https://unpkg.com/leaflet/dist/images/marker-icon.png',
        iconSize    : [25, 41],
        iconAnchor  : [12, 41],
        popupAnchor : [1, -34],
        shadowUrl   : 'https://unpkg.com/leaflet/dist/images/marker-shadow.png',
        shadowSize  : [41, 41],
      });

      const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map);
      marker.bindPopup('📍 Drag to adjust location').openPopup();
      markerRef.current = marker;

      // Click on map → move marker + reverse geocode
      map.on('click', async (e: any) => {
        const { lat: la, lng: lo } = e.latlng;
        marker.setLatLng([la, lo]);
        const address = await reverseGeocode(la, lo);
        marker.bindPopup(`📍 ${address}`).openPopup();
        onSelect(la, lo, address);
      });

      // Drag marker → reverse geocode
      marker.on('dragend', async () => {
        const { lat: la, lng: lo } = marker.getLatLng();
        const address = await reverseGeocode(la, lo);
        marker.bindPopup(`📍 ${address}`).openPopup();
        onSelect(la, lo, address);
      });

      // Fire initial select to populate location string
      reverseGeocode(lat, lng).then(address => onSelect(lat, lng, address));
    }).catch(() => setLoading(false));

    return () => {
      cancelled = true;
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan + move pin when GPS coords update
  useEffect(() => {
    if (mapInstance.current && markerRef.current) {
      mapInstance.current.setView([lat, lng], 16);
      markerRef.current.setLatLng([lat, lng]);
    }
  }, [lat, lng]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80 rounded-xl">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <span className="ml-2 text-sm">Loading map…</span>
        </div>
      )}
      <div ref={mapRef} style={{ height: '280px', width: '100%' }} />
      <div className="absolute bottom-2 left-2 z-[1000] bg-background/90 backdrop-blur-sm text-xs px-2 py-1 rounded-md border border-border text-muted-foreground pointer-events-none">
        Click map or drag pin to set location
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

export default function CitizenReport() {
  const { currentUser, addComplaint, logout } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep]           = useState(1);
  const [photo, setPhoto]         = useState('');
  const [location, setLocation]   = useState('');
  const [gps, setGps]             = useState({ lat: 20.0059, lng: 73.7897 });
  const [locating, setLocating]   = useState(false);
  // ── NEW: controls whether the Leaflet map is visible ──
  const [showMap, setShowMap]     = useState(false);
  const [category, setCategory]   = useState<Category>('Road');
  const [analyzing, setAnalyzing] = useState(false);
  const [title, setTitle]         = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority]   = useState<Priority>('Medium');
  const [estimated, setEstimated] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);

  // Image validation state
  const [imageValidating, setImageValidating]   = useState(false);
  const [imageValid, setImageValid]             = useState<boolean | null>(null);
  const [imageInvalidReason, setImageInvalidReason] = useState('');
  const [aiAnalysis, setAiAnalysis]             = useState<ImageAnalysis | null>(null);

  // ── Photo upload + immediate Groq vision validation ───────────────────────
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setPhoto(base64);
      setImageValid(null);
      setImageInvalidReason('');
      setAiAnalysis(null);
      setImageValidating(true);

      try {
        const analysis = await analyzeImageWithGroq(base64);
        setAiAnalysis(analysis);
        setImageValid(analysis.valid);

        if (!analysis.valid) {
          setImageInvalidReason(analysis.reason);
          toast({
            title       : '⚠️ Invalid Image',
            description : analysis.reason,
            variant     : 'destructive',
          });
        } else {
          // Pre-fill category from AI analysis
          setCategory(analysis.category);
          toast({ title: '✅ Image verified — civic issue detected' });
        }
      } catch (err: any) {
        // Don't block the user if AI fails — just warn
        console.error('Groq vision error:', err);
        setImageValid(true); // allow proceeding
        toast({ title: '⚠️ AI validation unavailable', description: 'Proceeding without image check.' });
      } finally {
        setImageValidating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── GPS location — original logic preserved + also pans the Leaflet map ──
  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: '❌ Geolocation not supported' });
      return;
    }
    setLocating(true);
    setShowMap(true); // open map so user sees pin move to their position
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setGps({ lat, lng }); // triggers LeafletMap useEffect to pan the pin
        const ward = currentUser?.ward || 1;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } },
          );
          const data = await res.json();
          const addr = data.address || {};
          const area =
            addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || 'Nashik';
          setLocation(`Ward ${ward}, ${area} — ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } catch {
          setLocation(`Ward ${ward}, Nashik — ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
        setLocating(false);
        toast({ title: '📍 Live location detected' });
      },
      (error) => {
        setLocating(false);
        const ward = currentUser?.ward || 1;
        setLocation(`Ward ${ward}, Nashik — ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`);
        toast({ title: '⚠️ Using default location', description: error.message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  // ── Called by LeafletMap when user clicks map or drags pin ───────────────
  const handleMapSelect = (lat: number, lng: number, address: string) => {
    setGps({ lat, lng });
    const ward = currentUser?.ward || 1;
    setLocation(`Ward ${ward}, ${address} — ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };

  // ── Voice typing ──────────────────────────────────────────────────────────
  const startVoiceTyping = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: '❌ Speech Recognition not supported' });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.start();
    setListening(true);
    recognition.onresult = (event: any) => {
      setDescription(prev => prev + ' ' + event.results[0][0].transcript);
    };
    recognition.onend  = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      toast({ title: '❌ Voice error' });
    };
  };

  // ── Step 1 → Step 2: use Groq AI to auto-fill all fields ─────────────────
  const goStep2 = async () => {
    setStep(2);
    setAnalyzing(true);

    try {
      const ward     = currentUser?.ward || 1;
      let aiTitle    = '';
      let aiDesc     = '';
      let aiPriority : Priority = 'Medium';
      let aiEstimated = '';
      let detectedCategory = category;

      if (aiAnalysis?.valid) {
        // Use vision analysis results directly
        aiTitle    = aiAnalysis.title;
        aiDesc     = aiAnalysis.description;
        aiPriority = aiAnalysis.priority;
        detectedCategory = aiAnalysis.category;

        const d = new Date();
        d.setDate(
          d.getDate() +
            (aiPriority === 'Critical' ? 3 : aiPriority === 'High' ? 7 : aiPriority === 'Medium' ? 14 : 21),
        );
        aiEstimated = d.toISOString().split('T')[0];
      } else {
        // No valid image — generate from text context
        const result = await generateDescriptionWithGroq(category, ward, location);
        aiTitle    = result.title;
        aiDesc     = result.description;
        aiPriority = result.priority;
        aiEstimated = result.estimated;
      }

      setCategory(detectedCategory);
      setTitle(aiTitle || `${detectedCategory} Issue — Ward ${ward}`);
      setDescription(aiDesc);
      setPriority(aiPriority);
      setEstimated(aiEstimated);
    } catch (err: any) {
      console.error('Groq text generation error:', err);
      // Graceful fallback
      const ward = currentUser?.ward || 1;
      const descs: Record<Category, string> = {
        Road        : 'Significant road surface damage detected. The pothole/crack poses safety risks to vehicles and pedestrians. Immediate attention recommended.',
        Water       : 'Water supply disruption reported. Multiple households may be affected. Pipeline inspection and repair needed urgently.',
        Sanitation  : 'Waste management issue identified. Garbage accumulation posing hygiene risks. Sanitation team dispatch recommended.',
        Electricity : 'Electrical infrastructure issue reported. Potential safety hazard. Immediate inspection by qualified electrician required.',
        Other       : 'Civic issue reported requiring municipal attention. Detailed assessment needed for appropriate departmental action.',
      };
      setDescription(descs[category]);
      setTitle(`${category} Issue — Ward ${ward}`);
      setPriority(category === 'Electricity' ? 'High' : 'Medium');
      const d = new Date();
      d.setDate(d.getDate() + 14);
      setEstimated(d.toISOString().split('T')[0]);

      toast({ title: '⚠️ AI unavailable', description: 'Using default template. You can edit below.' });
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const complaint = await addComplaint({
        citizenId    : currentUser._id || currentUser.id,
        citizenName  : currentUser.name,
        citizenPhone : currentUser.phone,
        title,
        description,
        category,
        priority,
        status       : 'Submitted',
        ward         : currentUser.ward || 1,
        location     : location || `Ward ${currentUser.ward}, Nashik`,
        gpsCoords    : gps,
        photo,
        estimatedResolution : estimated,
        isSOS        : false,
        department   :
          category === 'Road'        ? 'Roads & Infrastructure'
          : category === 'Water'     ? 'Water Supply'
          : category === 'Sanitation'? 'Sanitation'
          : category === 'Electricity'? 'Electricity'
          : 'General Administration',
      });

      const displayId = complaint?.complaintId || complaint?.id || complaint?._id || 'submitted';
      toast({ title: '🎉 Complaint submitted!', description: `ID: ${displayId} • +50 points earned` });
      navigate(`/citizen/track?id=${displayId}`);
    } catch (err: any) {
      const msg = String(err?.message || '');
      const lower = msg.toLowerCase();

      // If backend says "citizens only", it means the stored token belongs to an admin.
      // This can happen if the session got mismatched; safest recovery is to logout and re-login.
      if (lower.includes('citizens only') || (lower.includes('access denied') && lower.includes('citizen'))) {
        try {
          logout();
        } catch {
          // ignore
        }
        toast({
          title: 'Access denied',
          description: 'Please login as a Citizen to submit a complaint.',
          variant: 'destructive',
        });
        navigate('/citizen/login', { replace: true });
        return;
      }

      toast({
        title       : '❌ Submission failed',
        description : msg || 'Please try again',
        variant     : 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const canProceed =
    !imageValidating &&
    (imageValid === true || imageValid === null) &&
    imageInvalidReason === '';

  return (
    <CitizenLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-heading font-bold mb-6">Report an Issue</h1>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-8">
          {['Capture', 'AI Description', 'Review'].map((s, i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step > i + 1
                    ? 'bg-success text-success-foreground'
                    : step === i + 1
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span
                className={`text-xs hidden sm:inline ${step === i + 1 ? 'font-semibold' : 'text-muted-foreground'}`}
              >
                {s}
              </span>
              {i < 2 && <div className={`flex-1 h-0.5 ${step > i + 1 ? 'bg-success' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Capture ── */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            {/* Photo upload — UNCHANGED */}
            <div>
              <Label>Photo Evidence</Label>
              <label
                className={`mt-2 border-2 border-dashed rounded-lg p-8 flex flex-col items-center cursor-pointer transition-colors ${
                  imageValid === false
                    ? 'border-destructive bg-destructive/5'
                    : imageValid === true
                    ? 'border-success bg-success/5'
                    : 'border-border hover:border-accent'
                }`}
              >
                {photo ? (
                  <div className="relative w-full flex flex-col items-center gap-3">
                    <img
                      src={photo}
                      className="max-h-48 rounded-lg object-cover"
                      alt="Upload"
                    />

                    {/* Validation overlay */}
                    {imageValidating && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                        <span>🤖 AI verifying image…</span>
                      </div>
                    )}

                    {!imageValidating && imageValid === true && (
                      <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg px-3 py-2 w-full">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span>
                          <strong>Civic issue detected:</strong>{' '}
                          {aiAnalysis?.category} — {aiAnalysis?.severity} severity
                        </span>
                      </div>
                    )}

                    {!imageValidating && imageValid === false && (
                      <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 w-full">
                        <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong>Image not accepted:</strong> {imageInvalidReason}
                          <p className="text-xs mt-1 opacity-80">
                            Please upload an image showing the actual civic issue.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <Camera className="h-10 w-10 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click or drag to upload</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      AI will verify the image shows a civic issue
                    </span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            </div>

            {/* ── LOCATION SECTION — only part changed ── */}
            <div className="space-y-2">
              {/* Two buttons: GPS (original) + new Pick on Map toggle */}
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" onClick={detectLocation} disabled={locating}>
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  {locating ? 'Detecting…' : 'Detect Location'}
                </Button>
                <Button
                  type="button"
                  variant={showMap ? 'default' : 'outline'}
                  onClick={() => setShowMap(v => !v)}
                >
                  <Map className="h-4 w-4 mr-1" />
                  {showMap ? 'Hide Map' : 'Pick on Map'}
                </Button>
              </div>

              {/* Location string display — same as original */}
              {location && (
                <p className="text-sm text-success bg-success/10 rounded-lg px-3 py-2">
                  📍 {location}
                </p>
              )}

              {/* Leaflet map — shown only when toggled or after GPS */}
              {showMap && (
                <div className="animate-fade-in">
                  <LeafletMap
                    lat={gps.lat}
                    lng={gps.lng}
                    onSelect={handleMapSelect}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Tap anywhere on the map or drag the pin to set the exact complaint location
                  </p>
                </div>
              )}
            </div>
            {/* ── END LOCATION SECTION ── */}

            {/* Category — UNCHANGED */}
            <div>
              <Label>
                Category
                {aiAnalysis?.valid && (
                  <span className="ml-2 text-xs text-accent font-normal">
                    ✨ AI suggested: {aiAnalysis.category}
                  </span>
                )}
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      category === c
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    {c === 'Road'
                      ? '🛣️'
                      : c === 'Water'
                      ? '💧'
                      : c === 'Sanitation'
                      ? '🗑️'
                      : c === 'Electricity'
                      ? '⚡'
                      : '📋'}{' '}
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Invalid image warning — UNCHANGED */}
            {imageValid === false && (
              <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-sm text-warning-foreground">
                  The uploaded image was not recognised as a civic issue. Please upload a relevant
                  photo or proceed without one (AI will generate a description from context).
                </p>
              </div>
            )}

            <Button
              variant="hero"
              className="w-full"
              onClick={goStep2}
              disabled={imageValidating}
            >
              {imageValidating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying image…
                </>
              ) : (
                'Continue to AI Analysis →'
              )}
            </Button>
          </div>
        )}

        {/* ── STEP 2: AI Description — UNCHANGED ── */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            {analyzing ? (
              <div className="text-center py-16">
                <div className="animate-pulse inline-block h-4 w-4 rounded-full bg-accent mb-4" />
                <p className="text-lg font-heading font-semibold">🤖 Groq AI Analyzing…</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {photo && imageValid
                    ? 'Processing image and generating smart description'
                    : 'Generating description from context'}
                </p>
                <div className="mt-4 space-y-2 max-w-sm mx-auto">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-3 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="font-medium">✨ Groq AI Generated</span>
                  <span className="text-muted-foreground">— you can edit below</span>
                </div>

                <div>
                  <Label>Title</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} />
                </div>

                <div>
                  <Label>Description</Label>
                  <div className="flex gap-2 mt-1">
                    <Textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={4}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startVoiceTyping}
                      className="self-start px-3"
                    >
                      <Mic
                        className={`h-4 w-4 ${listening ? 'text-destructive animate-pulse' : ''}`}
                      />
                    </Button>
                  </div>
                  {listening && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-pulse" />{' '}
                      Listening…
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Priority</Label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value as Priority)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {['Low', 'Medium', 'High', 'Critical'].map(p => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Est. Resolution</Label>
                    <Input
                      type="date"
                      value={estimated}
                      onChange={e => setEstimated(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    ← Back
                  </Button>
                  <Button variant="hero" className="flex-1" onClick={() => setStep(3)}>
                    Review →
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Review & Submit — UNCHANGED ── */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-in">
            <div className="card-elevated p-6 space-y-3">
              <h3 className="font-heading font-semibold text-lg">{title}</h3>
              {photo && (
                <img src={photo} className="rounded-lg max-h-48 object-cover w-full" alt="Issue" />
              )}
              <p className="text-sm text-muted-foreground">{description}</p>
              <div className="flex flex-wrap gap-2">
                <span className="badge-pill bg-muted text-muted-foreground">{category}</span>
                <span
                  className={`badge-pill ${
                    priority === 'High' || priority === 'Critical'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-warning/10 text-warning'
                  }`}
                >
                  {priority}
                </span>
                {location && (
                  <span className="badge-pill bg-success/10 text-success">📍 {location}</span>
                )}
                {aiAnalysis?.valid && (
                  <span className="badge-pill bg-accent/10 text-accent">🤖 AI Verified</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Est. resolution: {estimated}</p>
            </div>

            {/* Notice — UNCHANGED */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex gap-2 items-start">
              <span className="text-blue-500 text-sm">ℹ️</span>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Once submitted, your complaint will immediately appear on the{' '}
                <strong>Admin Dashboard</strong> for processing. You can track its status in
                real-time from the Track page.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded" defaultChecked />
              <span>I confirm all details are correct</span>
            </label>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button
                variant="hero"
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {submitting ? 'Submitting to Admin...' : 'Submit Complaint'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </CitizenLayout>
  );
}