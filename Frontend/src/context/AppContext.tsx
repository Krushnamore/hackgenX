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
import { addNotification } from "@/hooks/useNotifications";

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

  // ── FIX 1: Restore user from localStorage immediately so no flicker ──
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [complaints,  setComplaints]  = useState<any[]>(() => ls.get<any[]>(COMPLAINTS_KEY)  || []);
  const [leaderboard, setLeaderboard] = useState<any[]>(() => ls.get<any[]>(LEADERBOARD_KEY) || []);
  const [globalTop3,  setGlobalTop3]  = useState<any[]>([]);
  const [users,       setUsers]       = useState<any[]>([]);

  // ── FIX 2: loading=true on mount so ProtectedRoute waits ──
  const [loading, setLoading] = useState(true);

  const currentUserRef = useRef<any>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser) localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  }, [currentUser]);

  // ── FIX 3: On mount, verify token is still valid ──
  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        // Verify token with backend and get fresh user data
        const data = await apiFetch('/auth/me');
        const user = data?.user ?? data;
        if (user) {
          setCurrentUser(user);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
          // Load data in background — don't block UI
          loadComplaints();
          loadUsers();
        } else {
          // Token invalid — clear everything
          removeToken();
          localStorage.removeItem(USER_KEY);
          setCurrentUser(null);
        }
      } catch (err: any) {
        const msg = String(err?.message || '').toLowerCase();
        const isAuthError = msg.includes('401') || msg.includes('403') ||
          msg.includes('unauthorized') || msg.includes('jwt') || msg.includes('token');

        if (isAuthError) {
          // Real auth error — log out
          removeToken();
          localStorage.removeItem(USER_KEY);
          setCurrentUser(null);
        }
        // Network error — keep cached user, they'll see stale data
        // but won't be logged out unexpectedly
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── COMPLAINTS ── */

  const loadComplaints = useCallback(async () => {
    try {
      const res = await complaintAPI.getAll();
      if (res?.complaints) {
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

  /* ── USERS ── */

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
      const list: any[] = data?.users ?? data?.leaderboard ?? (Array.isArray(data) ? data : []);
      setLeaderboard(list);
      ls.set(LEADERBOARD_KEY, list);
      if (!ward) {
        setGlobalTop3(list.slice(0, 3));
      } else {
        try {
          const global = await apiFetch("/users/leaderboard?limit=3");
          const gList: any[] = global?.users ?? global?.leaderboard ?? (Array.isArray(global) ? global : []);
          setGlobalTop3(gList.slice(0, 3));
        } catch {}
      }
    } catch (err) { console.warn("Failed loading leaderboard", err); }
  }, []);

  /* ── REFRESH CURRENT USER ── */

  const refreshCurrentUser = useCallback(async () => {
    try {
      const data = await apiFetch('/auth/me');
      const user = data?.user ?? data;
      if (user) {
        setCurrentUser(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
    } catch (err) { console.warn('Failed refreshing user', err); }
  }, []);

  /* ── LOGIN ── */

  const login = async (email: string, password: string, role?: "citizen" | "admin") => {
    clearCache();
    ls.remove(COMPLAINTS_KEY);

    const result = role === "admin"
      ? await authAPI.adminLogin(email, password)
      : await authAPI.citizenLogin(email, password);

    if (!result?.token) throw new Error("Login failed — no token received");

    setToken(result.token);
    const user = result.user;
    setCurrentUser(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user)); // ← persist immediately

    // Load in background
    loadComplaints();
    loadUsers();

    return user;
  };

  /* ── REGISTER ── */

  const register = async (data: any) => {
    const adminRoles = ["admin", "dept_officer", "superAdmin"];
    const result = adminRoles.includes(data.role)
      ? await authAPI.adminRegister(data)
      : await authAPI.citizenRegister(data);

    if (!result?.token) throw new Error("Registration failed");

    setToken(result.token);
    const user = result.user;
    setCurrentUser(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user)); // ← persist immediately

    loadComplaints();
    return user;
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
    let result: any;
    try {
      if (typeof (complaintAPI as any).create === 'function') {
        result = await (complaintAPI as any).create(data);
      } else {
        result = await apiFetch('/complaints', { method: 'POST', body: JSON.stringify(data) });
      }
    } catch (err) { throw err; }

    const newComplaint = result?.complaint ?? result;
    if (newComplaint) {
      const normalized = { ...newComplaint, id: newComplaint.id || newComplaint._id?.toString() };
      setComplaints(prev => {
        const updated = [normalized, ...prev];
        ls.set(COMPLAINTS_KEY, updated);
        return updated;
      });
      refreshCurrentUser();

      const citizenId = currentUserRef.current?._id || currentUserRef.current?.id;
      if (citizenId) {
        addNotification(citizenId, {
          type   : 'points_earned',
          title  : '🏆 +50 Points Earned!',
          message: `Your complaint ${normalized.title} was submitted. You earned 50 points!`,
          link   : '/citizen/rewards',
        });
      }
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
    try {
      if (typeof (complaintAPI as any).updateStatus === 'function') {
        await (complaintAPI as any).updateStatus(id, status);
      } else {
        await apiFetch(`/complaints/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
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
          message: 'Your complaint was resolved! Check your rewards page.',
          link   : '/citizen/rewards',
        });
      }
    }
    refreshLeaderboard();
  }, [refreshLeaderboard, complaints]);

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