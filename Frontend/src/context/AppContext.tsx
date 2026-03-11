import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import {
  authAPI,
  complaintAPI,
  getToken,
  setToken,
  removeToken,
  clearCache,
} from "@/lib/api";
import { addNotification, getNotifications } from "@/hooks/useNotifications";

/* ================= TYPES ================= */

interface AppContextType {
  currentUser: any | null;
  complaints: any[];
  users: any[];
  loading: boolean;
  login: (email: string, password: string, role?: "citizen" | "admin") => Promise<any>;
  register: (data: any) => Promise<any>;
  logout: () => void;
  refreshComplaints: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  myComplaints: any[];
  updateComplaintStatus: (id: string, status: string) => Promise<void>;
  deleteComplaint: (id: string) => Promise<void>;
  resolveComplaint: (id: string, photo?: string, note?: string, officer?: string) => Promise<void>;
  addComplaint: (data: any) => Promise<any>;
  leaderboard: any[];
  globalTop3: any[];
  refreshLeaderboard: (ward?: number, limit?: number) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
};

/* ================= LOCAL STORAGE ================= */

const USER_KEY        = "jv_user";
const COMPLAINTS_KEY  = "jv_complaints";
const LEADERBOARD_KEY = "jv_leaderboard";
const CACHE_MAX_AGE   = 5 * 60 * 1000;

const ls = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.__ts && Date.now() - parsed.__ts > CACHE_MAX_AGE) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed?.data ?? parsed;
    } catch { return null; }
  },
  set(key: string, data: any) {
    try { localStorage.setItem(key, JSON.stringify({ data, __ts: Date.now() })); } catch {}
  },
  remove(key: string) {
    try { localStorage.removeItem(key); } catch {}
  },
};

/* ================= RAW FETCH HELPER ================= */
// Used for endpoints not covered by the api.ts wrappers (e.g. leaderboard)

const BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:5000/api";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

/* ================= PROVIDER ================= */

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
    catch { return null; }
  });

  const [complaints,  setComplaints]  = useState<any[]>(() => ls.get<any[]>(COMPLAINTS_KEY)  || []);
  const [leaderboard, setLeaderboard] = useState<any[]>(() => ls.get<any[]>(LEADERBOARD_KEY) || []);
  const [globalTop3,  setGlobalTop3]  = useState<any[]>([]);
  const [users,       setUsers]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(false);

  const currentUserRef = useRef<any>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser) localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  }, [currentUser]);

  // On mount: if user is already logged in (page refresh), reload data
  useEffect(() => {
    if (getToken()) {
      loadComplaints();
      loadUsers();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── COMPLAINTS ── */

  const loadComplaints = useCallback(async () => {
    try {
      const res = await complaintAPI.getAll();
      if (res?.complaints) {
        // Normalize _id → id so UI can always use c.id
        const normalized = res.complaints.map((c: any) => ({
          ...c,
          id: c.id || c._id?.toString(),
        }));
        setComplaints(normalized);
        ls.set(COMPLAINTS_KEY, normalized);
      }
    } catch (err) { console.warn("Failed loading complaints", err); }
  }, []);

  const refreshComplaints = useCallback(() => loadComplaints(), [loadComplaints]);

  /* ── USERS (for admin dashboard citizens count) ── */

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiFetch('/users/leaderboard?limit=500');
      const list: any[] = data?.users ?? data?.leaderboard ?? (Array.isArray(data) ? data : []);
      setUsers(list);
    } catch (err) { console.warn('Failed loading users', err); }
  }, []);

  /* ── LEADERBOARD ── */

  const refreshLeaderboard = useCallback(async (ward?: number, limit = 100) => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (ward) params.set("ward", String(ward));

      const data = await apiFetch(`/users/leaderboard?${params}`);

      // Backend returns { success, users, total }
      const list: any[] = data?.users ?? data?.leaderboard ?? (Array.isArray(data) ? data : []);

      setLeaderboard(list);
      ls.set(LEADERBOARD_KEY, list);

      if (!ward) {
        // No ward filter → first 3 ARE the global top 3
        setGlobalTop3(list.slice(0, 3));
      } else {
        // Fetch global top 3 separately (unfiltered, limit=3)
        try {
          const global = await apiFetch("/users/leaderboard?limit=3");
          const gList: any[] = global?.users ?? global?.leaderboard ?? (Array.isArray(global) ? global : []);
          setGlobalTop3(gList.slice(0, 3));
        } catch {
          // fallback: keep whatever globalTop3 already is
        }
      }
    } catch (err) {
      console.warn("Failed loading leaderboard", err);
    }
  }, []);

  /* ── REFRESH CURRENT USER (get fresh points/badge from server) ── */

  const refreshCurrentUser = useCallback(async () => {
    try {
      const data = await apiFetch('/auth/me');
      const user = data?.user ?? data;
      if (user) {
        setCurrentUser(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
    } catch (err) {
      console.warn('Failed refreshing user', err);
    }
  }, []);

  /* ── LOGIN ── */

  const login = async (email: string, password: string, role?: "citizen" | "admin") => {
    clearCache();
    ls.remove(COMPLAINTS_KEY);

    const result = role === "admin"
      ? await authAPI.adminLogin(email, password)
      : await authAPI.citizenLogin(email, password);

    if (!result?.token) throw new Error("Login failed");
    setToken(result.token);
    setCurrentUser(result.user);
    await loadComplaints();
    await loadUsers();
    return result.user;
  };

  /* ── REGISTER ── */

  const register = async (data: any) => {
    const adminRoles = ["admin", "dept_officer", "superAdmin"];
    const result = adminRoles.includes(data.role)
      ? await authAPI.adminRegister(data)
      : await authAPI.citizenRegister(data);

    if (!result?.token) throw new Error("Registration failed");
    setToken(result.token);
    setCurrentUser(result.user);
    await loadComplaints();
    return result.user;
  };

  /* ── LOGOUT ── */

  const logout = () => {
    clearCache();
    removeToken();
    localStorage.removeItem(USER_KEY);
    ls.remove(COMPLAINTS_KEY);
    ls.remove(LEADERBOARD_KEY);
    setCurrentUser(null);
    setComplaints([]);
    setLeaderboard([]);
    setGlobalTop3([]);
    setUsers([]);
  };

  /* ── ADD COMPLAINT ── */

  const addComplaint = useCallback(async (data: any) => {
    // Try complaintAPI.create first, fall back to direct fetch
    let result: any;
    try {
      if (typeof (complaintAPI as any).create === 'function') {
        result = await (complaintAPI as any).create(data);
      } else {
        result = await apiFetch('/complaints', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      }
    } catch (err) {
      throw err;
    }
    const newComplaint = result?.complaint ?? result;
    if (newComplaint) {
      const normalized = { ...newComplaint, id: newComplaint.id || newComplaint._id?.toString() };
      setComplaints(prev => {
        const updated = [normalized, ...prev];
        ls.set(COMPLAINTS_KEY, updated);
        return updated;
      });
      // Refresh user so points/badge update immediately in UI
      refreshCurrentUser();

      // 🔔 Notify citizen: points earned
      const citizenId = currentUserRef.current?._id || currentUserRef.current?.id;
      if (citizenId) {
        addNotification(citizenId, {
          type   : 'points_earned',
          title  : '🏆 +50 Points Earned!',
          message: `Your complaint ${normalized.title} was submitted. You earned 50 points!`,
          link   : '/citizen/rewards',
        });
      }

      // 🔔 Notify ALL admins: new complaint filed
      // We store admin notifications under a shared key "admins"
      addNotification('admins', {
        type   : 'new_complaint',
        title  : '📋 New Complaint Filed',
        message: `${normalized.title} — ${normalized.category}, Zone ${normalized.ward} by ${normalized.citizenName || currentUserRef.current?.name}`,
        link   : '/admin/complaints',
        meta   : { complaintId: normalized.id },
      });

      return normalized;
    }
    return newComplaint;
  }, [refreshCurrentUser]);

  /* ── UPDATE STATUS ── */

  const updateComplaintStatus = useCallback(async (id: string, status: string) => {
    // Use direct fetch to avoid dependency on complaintAPI.updateStatus existing
    try {
      if (typeof (complaintAPI as any).updateStatus === 'function') {
        await (complaintAPI as any).updateStatus(id, status);
      } else {
        await apiFetch(`/complaints/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
      }
    } catch (err) { throw err; }
    setComplaints(prev => {
      const updated = prev.map(c => c.id === id || c._id === id ? { ...c, status } : c);
      ls.set(COMPLAINTS_KEY, updated);
      return updated;
    });
  }, []);

  /* ── DELETE ── */

  const deleteComplaint = useCallback(async (id: string) => {
    try {
      if (typeof (complaintAPI as any).delete === 'function') {
        await (complaintAPI as any).delete(id);
      } else {
        await apiFetch(`/complaints/${id}`, { method: 'DELETE' });
      }
    } catch (err) { throw err; }
    setComplaints(prev => {
      const updated = prev.filter(c => c.id !== id && c._id !== id);
      ls.set(COMPLAINTS_KEY, updated);
      return updated;
    });
  }, []);

  /* ── RESOLVE ── */

  const resolveComplaint = useCallback(async (id: string, photo?: string, note?: string, officer?: string) => {
    try {
      if (typeof (complaintAPI as any).resolve === 'function') {
        await (complaintAPI as any).resolve(id, { resolvePhoto: photo, adminNote: note, assignedOfficer: officer });
      } else {
        await apiFetch(`/complaints/${id}/resolve`, {
          method: 'POST',
          body: JSON.stringify({ resolvePhoto: photo, adminNote: note, assignedOfficer: officer }),
        });
      }
    } catch (err) { throw err; }
    // Find the complaint to get citizen info
    const resolvedC = complaints.find((c: any) => c.id === id || c._id === id);

    setComplaints(prev => {
      const updated = prev.map(c =>
        c.id === id || c._id === id
          ? { ...c, status: 'Resolved', resolvePhoto: photo, adminNote: note, assignedOfficer: officer }
          : c
      );
      ls.set(COMPLAINTS_KEY, updated);
      return updated;
    });

    // 🔔 Notify citizen: complaint resolved + points
    if (resolvedC) {
      const citizenId = resolvedC.citizenId?.toString?.() || resolvedC.citizenId;
      if (citizenId) {
        addNotification(citizenId, {
          type   : 'resolved',
          title  : '✅ Your Complaint Was Resolved!',
          message: `${resolvedC.title} has been resolved by ${officer || 'Municipal Officer'}. You earned +100 points!`,
          link   : `/citizen/track?id=${resolvedC.complaintId || id}`,
        });
        addNotification(citizenId, {
          type   : 'points_earned',
          title  : '🏆 +100 Points Earned!',
          message: 'Your complaint was resolved! Check your rewards page to see your updated balance.',
          link   : '/citizen/rewards',
        });
      }
    }

    // Refresh leaderboard so points update for citizen
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  /* ── DERIVED ── */

  const myComplaints = useMemo(() => {
    if (!currentUser) return [];
    return complaints.filter(c =>
      c.citizenId === currentUser._id || c.citizenId === currentUser.id
    );
  }, [complaints, currentUser]);

  return (
    <AppContext.Provider value={{
      currentUser, complaints, users, loading,
      login, register, logout,
      refreshComplaints, refreshCurrentUser, myComplaints,
      addComplaint,
      updateComplaintStatus, deleteComplaint, resolveComplaint,
      leaderboard, globalTop3, refreshLeaderboard,
    }}>
      {children}
    </AppContext.Provider>
  );
};