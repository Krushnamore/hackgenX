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
  myComplaints: any[];
  updateComplaintStatus: (id: string, status: string) => Promise<void>;
  deleteComplaint: (id: string) => Promise<void>;
  resolveComplaint: (id: string, photo?: string, note?: string, officer?: string) => Promise<void>;
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

async function apiFetch(path: string) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  /* ── COMPLAINTS ── */

  const loadComplaints = useCallback(async () => {
    try {
      const res = await complaintAPI.getAll();
      if (res?.complaints) {
        setComplaints(res.complaints);
        ls.set(COMPLAINTS_KEY, res.complaints);
      }
    } catch (err) { console.warn("Failed loading complaints", err); }
  }, []);

  const refreshComplaints = useCallback(() => loadComplaints(), [loadComplaints]);

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

  /* ── UPDATE STATUS ── */

  const updateComplaintStatus = useCallback(async (id: string, status: string) => {
    await complaintAPI.updateStatus(id, status);
    setComplaints(prev => {
      const updated = prev.map(c => c.id === id || c._id === id ? { ...c, status } : c);
      ls.set(COMPLAINTS_KEY, updated);
      return updated;
    });
  }, []);

  /* ── DELETE ── */

  const deleteComplaint = useCallback(async (id: string) => {
    await complaintAPI.delete(id);
    setComplaints(prev => {
      const updated = prev.filter(c => c.id !== id && c._id !== id);
      ls.set(COMPLAINTS_KEY, updated);
      return updated;
    });
  }, []);

  /* ── RESOLVE ── */

  const resolveComplaint = useCallback(async (id: string, photo?: string, note?: string, officer?: string) => {
    await complaintAPI.resolve(id, { resolvePhoto: photo, adminNote: note, assignedOfficer: officer });
    setComplaints(prev => {
      const updated = prev.map(c =>
        c.id === id || c._id === id
          ? { ...c, status: "Resolved", resolvePhoto: photo, adminNote: note, assignedOfficer: officer }
          : c
      );
      ls.set(COMPLAINTS_KEY, updated);
      return updated;
    });
  }, []);

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
      refreshComplaints, myComplaints,
      updateComplaintStatus, deleteComplaint, resolveComplaint,
      leaderboard, globalTop3, refreshLeaderboard,
    }}>
      {children}
    </AppContext.Provider>
  );
};