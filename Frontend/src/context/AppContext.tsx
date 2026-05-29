import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, useMemo, ReactNode,
} from "react";
import {
  authAPI, complaintAPI,
  getToken, setToken, removeToken, clearCache,
} from "@/lib/api";
import {
  addNotification,
  notifyNewComplaint,
  notifyStatusChange,
  notifyResolved,
  notifyDocumentSent,
  notifyAdminRegistrationPending,
  deptKey,
} from "@/hooks/useNotifications";

/* ================= TYPES ================= */

interface AppContextType {
  currentUser          : any | null;
  complaints           : any[];
  users                : any[];
  loading              : boolean;
  login                : (email: string, password: string, role?: "citizen" | "admin") => Promise<any>;
  register             : (data: any) => Promise<any>;
  logout               : () => void;
  refreshComplaints    : () => Promise<void>;
  refreshCurrentUser   : () => Promise<void>;
  myComplaints         : any[];
  addComplaint         : (data: any) => Promise<any>;
  updateComplaintStatus: (id: string, status: string) => Promise<void>;
  deleteComplaint      : (id: string) => Promise<void>;
  resolveComplaint     : (id: string, photo?: string, note?: string, officer?: string) => Promise<void>;
  sendDocument         : (citizenId: string, documentName: string, complaintId?: string) => void;
  leaderboard          : any[];
  globalTop3           : any[];
  refreshLeaderboard   : (ward?: number, limit?: number) => Promise<void>;
  getPendingAdmins     : () => Promise<any[]>;
  approveAdmin         : (id: string, action: "approve" | "reject") => Promise<void>;
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

/* ================= FETCH HELPER ================= */

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
  if (res.status === 204) return { success: true };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
  return data;
}

const normalize = (c: any) => ({
  ...c,
  id: c.id || c._id?.toString?.() || String(c._id),
});

/* ================= PROVIDER ================= */

export const AppProvider = ({ children }: { children: ReactNode }) => {

  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try { const s = localStorage.getItem(USER_KEY); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const [complaints,  setComplaints]  = useState<any[]>(() => ls.get<any[]>(COMPLAINTS_KEY)  ?? []);
  const [leaderboard, setLeaderboard] = useState<any[]>(() => ls.get<any[]>(LEADERBOARD_KEY) ?? []);
  const [globalTop3,  setGlobalTop3]  = useState<any[]>([]);
  const [users,       setUsers]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);

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
        const normalized = res.complaints.map(normalize);
        setComplaints(normalized);
        ls.set(COMPLAINTS_KEY, normalized);
      }
    } catch (err) { console.warn("loadComplaints failed", err); }
  }, []);

  const refreshComplaints = useCallback(() => loadComplaints(), [loadComplaints]);

  /* ── USERS ── */

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiFetch("/users/leaderboard?limit=500");
      const list: any[] = data?.users ?? data?.leaderboard ?? (Array.isArray(data) ? data : []);
      setUsers(list);
    } catch (err) { console.warn("loadUsers failed", err); }
  }, []);

  /* ── BOOTSTRAP ── */

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const token = getToken();
      if (!token) { if (!cancelled) setLoading(false); return; }
      try {
        const data = await apiFetch("/auth/me");
        const user = data?.user ?? data;
        if (!cancelled) {
          if (user?._id || user?.id) {
            setCurrentUser(user);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            loadComplaints();
            loadUsers();
          } else {
            removeToken();
            localStorage.removeItem(USER_KEY);
            setCurrentUser(null);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = String(err?.message ?? "").toLowerCase();
          if (msg.includes("401") || msg.includes("403") ||
              msg.includes("unauthorized") || msg.includes("jwt") || msg.includes("token")) {
            removeToken();
            localStorage.removeItem(USER_KEY);
            setCurrentUser(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── REFRESH CURRENT USER ── */

  const refreshCurrentUser = useCallback(async () => {
    try {
      const data = await apiFetch("/auth/me");
      const user = data?.user ?? data;
      if (user) { setCurrentUser(user); localStorage.setItem(USER_KEY, JSON.stringify(user)); }
    } catch (err) { console.warn("refreshCurrentUser failed", err); }
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
    } catch (err) { console.warn("refreshLeaderboard failed", err); }
  }, []);

  /* ── LOGIN ── */

  const login = useCallback(async (email: string, password: string, role?: "citizen" | "admin") => {
    clearCache();
    ls.remove(COMPLAINTS_KEY);
    const result = role === "admin"
      ? await authAPI.adminLogin(email, password)
      : await authAPI.citizenLogin(email, password);
    if (!result?.token) throw new Error("Login failed — no token received");
    setToken(result.token);
    const user = result.user;
    setCurrentUser(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    loadComplaints();
    loadUsers();
    return user;
  }, [loadComplaints, loadUsers]);

  /* ── REGISTER ── */

  const register = useCallback(async (data: any) => {
    const adminRoles = ["admin", "dept_officer", "superAdmin"];
    const result = adminRoles.includes(data.role)
      ? await authAPI.adminRegister(data)
      : await authAPI.citizenRegister(data);

    // Department admin / officer pending approval — notify superadmin
    if (result?.pending) {
      notifyAdminRegistrationPending({
        name      : data.name,
        department: data.department,
        email     : data.email,
        userId    : result?.userId ?? result?.user?._id,
      });
      return result;
    }

    if (!result?.token) throw new Error("Registration failed");
    setToken(result.token);
    const user = result.user;
    setCurrentUser(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    loadComplaints();
    return user;
  }, [loadComplaints]);

  /* ── LOGOUT ── */

  const logout = useCallback(() => {
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
  }, []);

  /* ── ADD COMPLAINT ── */

  const addComplaint = useCallback(async (data: any) => {
    const result =
      typeof (complaintAPI as any).create === "function"
        ? await (complaintAPI as any).create(data)
        : await apiFetch("/complaints", { method: "POST", body: JSON.stringify(data) });

    const newC = result?.complaint ?? result;
    if (newC) {
      const norm = normalize(newC);
      setComplaints(prev => {
        const updated = [norm, ...prev];
        ls.set(COMPLAINTS_KEY, updated);
        return updated;
      });
      refreshCurrentUser();

      // Citizen: points earned
      const citizenId = currentUserRef.current?._id || currentUserRef.current?.id;
      if (citizenId) {
        addNotification(citizenId, {
          type   : "points_earned",
          title  : "🏆 +50 Points Earned!",
          message: `Your complaint "${norm.title}" was submitted. You earned 50 points!`,
          link   : "/citizen/rewards",
        });
      }

      // Department admin + generic admins channel
      notifyNewComplaint({
        id         : norm.id,
        complaintId: norm.complaintId,
        title      : norm.title,
        category   : norm.category,
        ward       : norm.ward,
        department : norm.department,       // complaint's assigned department
        citizenName: norm.citizenName ?? currentUserRef.current?.name,
      });

      return norm;
    }
    return newC;
  }, [refreshCurrentUser]);

  /* ── UPDATE STATUS ── */

  const updateComplaintStatus = useCallback(async (id: string, status: string) => {
    typeof (complaintAPI as any).updateStatus === "function"
      ? await (complaintAPI as any).updateStatus(id, status)
      : await apiFetch(`/complaints/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });

    setComplaints(prev => {
      const complaint = prev.find(c => c.id === id || c._id === id);
      if (complaint) {
        const citizenId = complaint.citizenId?.toString?.() || complaint.citizenId;
        if (citizenId) {
          notifyStatusChange({
            citizenId,
            title  : complaint.title,
            status,
            trackId: complaint.complaintId || id,
          });
        }
      }
      const updated = prev.map(c => (c.id === id || c._id === id) ? { ...c, status } : c);
      ls.set(COMPLAINTS_KEY, updated);
      return updated;
    });
  }, []);

  /* ── DELETE ── */

  const deleteComplaint = useCallback(async (id: string) => {
    typeof (complaintAPI as any).delete === "function"
      ? await (complaintAPI as any).delete(id)
      : await apiFetch(`/complaints/${id}`, { method: "DELETE" });
    setComplaints(prev => {
      const updated = prev.filter(c => c.id !== id && c._id !== id);
      ls.set(COMPLAINTS_KEY, updated);
      return updated;
    });
  }, []);

  /* ── RESOLVE ── */

  const resolveComplaint = useCallback(async (
    id: string, photo?: string, note?: string, officer?: string,
  ) => {
    typeof (complaintAPI as any).resolve === "function"
      ? await (complaintAPI as any).resolve(id, { resolvePhoto: photo, adminNote: note, assignedOfficer: officer })
      : await apiFetch(`/complaints/${id}/resolve`, {
          method: "POST",
          body  : JSON.stringify({ resolvePhoto: photo, adminNote: note, assignedOfficer: officer }),
        });

    setComplaints(prev => {
      const resolvedC = prev.find(c => c.id === id || c._id === id);
      if (resolvedC) {
        const citizenId = resolvedC.citizenId?.toString?.() || resolvedC.citizenId;
        if (citizenId) {
          notifyResolved({
            citizenId,
            title      : resolvedC.title,
            trackId    : resolvedC.complaintId || id,
            officer,
            department : resolvedC.department,
            resolvedBy : currentUserRef.current?.name,
          });
        }
      }
      const updated = prev.map(c =>
        c.id === id || c._id === id
          ? { ...c, status: "Resolved", resolvePhoto: photo, adminNote: note, assignedOfficer: officer }
          : c,
      );
      ls.set(COMPLAINTS_KEY, updated);
      return updated;
    });

    refreshLeaderboard();
  }, [refreshLeaderboard]);

  /* ── SEND DOCUMENT TO CITIZEN ── */

  const sendDocument = useCallback((
    citizenId: string,
    documentName: string,
    complaintId?: string,
  ) => {
    notifyDocumentSent({
      citizenId,
      documentName,
      complaintId,
      sentBy: currentUserRef.current?.name,
    });
  }, []);

  /* ── ADMIN APPROVAL ── */

  const getPendingAdmins = useCallback(async (): Promise<any[]> => {
    try {
      const data = await apiFetch("/auth/pending-admins");
      return data?.pending ?? [];
    } catch { return []; }
  }, []);

  const approveAdmin = useCallback(async (id: string, action: "approve" | "reject") => {
    const data = await apiFetch(`/auth/approve-admin/${id}`, {
      method: "PATCH",
      body  : JSON.stringify({ action }),
    });
    const adminUser = data?.user;
    if (adminUser) {
      const notifKey = adminUser._id || adminUser.id;

      // Notify the admin themselves
      addNotification(notifKey, {
        type   : "status_change",
        title  : action === "approve" ? "✅ Account Approved!" : "❌ Account Rejected",
        message: action === "approve"
          ? "Your account has been approved. You can now log in."
          : "Your registration was rejected. Contact the Super Admin.",
        link: "/admin/login",
      });

      // Notify the department channel
      addNotification(deptKey(adminUser.department), {
        type   : "status_change",
        title  : action === "approve" ? "✅ New Admin Joined" : "❌ Admin Registration Rejected",
        message: `${adminUser.name} has been ${action === "approve" ? "approved" : "rejected"} for the ${adminUser.department} department.`,
        link   : "/admin/settings",
      });

      // Notify superadmin
      addNotification("superadmin", {
        type   : "status_change",
        title  : action === "approve" ? "✅ Admin Approved" : "❌ Admin Rejected",
        message: `${adminUser.name} (${adminUser.department}) has been ${action === "approve" ? "approved" : "rejected"}.`,
        link   : "/admin/settings",
      });
    }
  }, []);

  /* ── DERIVED ── */

  const myComplaints = useMemo(() => {
    if (!currentUser) return [];
    return complaints.filter(
      c => c.citizenId === currentUser._id || c.citizenId === currentUser.id,
    );
  }, [complaints, currentUser]);

  /* ── MEMOIZED CONTEXT VALUE ── */

  const value = useMemo<AppContextType>(() => ({
    currentUser, complaints, users, loading,
    login, register, logout,
    refreshComplaints, refreshCurrentUser, myComplaints,
    addComplaint, updateComplaintStatus, deleteComplaint, resolveComplaint,
    sendDocument,
    leaderboard, globalTop3, refreshLeaderboard,
    getPendingAdmins, approveAdmin,
  }), [
    currentUser, complaints, users, loading,
    login, register, logout,
    refreshComplaints, refreshCurrentUser, myComplaints,
    addComplaint, updateComplaintStatus, deleteComplaint, resolveComplaint,
    sendDocument,
    leaderboard, globalTop3, refreshLeaderboard,
    getPendingAdmins, approveAdmin,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};