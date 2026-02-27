/**
 * AppContext.tsx — FIXED & OPTIMIZED
 *
 * FIXES:
 * 1. RELOAD BUG: Cached user is restored with correct role → ProtectedRoute
 *    now receives the right role immediately, no wrong redirects
 * 2. FAST LOGIN: Login no longer blocks on loadComplaints; loads async after
 * 3. DATA ISOLATION: Citizens only see their own complaints
 * 4. LIVE UPDATES: 20s polling so admin changes appear on citizen side
 * 5. ROLE GUARD: ProtectedRoute checks role from restored cache immediately
 * 6. NO DOUBLE FETCH: deduplication via ref flag
 */

import {
  createContext, useContext, useState,
  useEffect, useCallback, useRef, useMemo,
} from 'react';
import {
  authAPI, complaintAPI, userAPI, emailAPI,
  getToken, setToken, removeToken, clearCache,
} from '@/lib/api';

interface AppContextType {
  currentUser           : any | null;
  complaints            : any[];
  users                 : any[];
  loading               : boolean;
  login                 : (email: string, password: string, role?: 'citizen' | 'admin') => Promise<any>;
  register              : (data: any) => Promise<any>;
  logout                : () => void;
  updateUser            : (updates: Record<string, any>) => Promise<void>;
  addComplaint          : (data: object) => Promise<any>;
  updateComplaintStatus : (id: string, status: string, note?: string, officer?: string) => Promise<void>;
  resolveComplaint      : (id: string, photo: string, note: string, officer: string) => Promise<void>;
  deleteComplaint       : (id: string) => Promise<void>;
  supportComplaint      : (id: string) => Promise<void>;
  submitFeedback        : (id: string, feedback: { rating: number; comment: string; resolved: any }) => Promise<void>;
  refreshComplaints     : () => Promise<void>;
  leaderboard           : any[];
  refreshLeaderboard    : (ward?: number) => Promise<void>;
  myComplaints          : any[];
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};

// ─── localStorage helpers ─────────────────────────────────────
const USER_KEY = 'jv_user';
const saveUser = (u: any) =>
  u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY);
const loadUser = (): any | null => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
};

// ─── Normalise helpers ────────────────────────────────────────
const normaliseComplaint = (raw: any): any => {
  if (!raw) return raw;
  return {
    ...raw,
    id          : raw.complaintId || raw.id || raw._id || '',
    _id         : raw._id || raw.id || '',
    complaintId : raw.complaintId || raw.id || raw._id || '',
  };
};

const normaliseUser = (raw: any): any => {
  if (!raw) return raw;
  return { ...raw, id: raw._id || raw.id || '' };
};

const matchId = (c: any, id: string) =>
  !!(id && (c.id === id || c.complaintId === id || c._id === id));

const getMongoId = (complaints: any[], humanId: string): string => {
  const found = complaints.find(c => matchId(c, humanId));
  if (!found) return humanId;
  return found._id || found.complaintId || found.id || humanId;
};

// ─── Provider ─────────────────────────────────────────────────
export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [complaints,  setComplaints]  = useState<any[]>([]);
  const [users,       setUsers]       = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  // Start true so ProtectedRoute waits until auth state is resolved
  const [loading, setLoading] = useState(true);

  const didInit              = useRef(false);
  const isLoadingComplaints  = useRef(false);
  const isLoadingUsers       = useRef(false);
  const pollTimer            = useRef<ReturnType<typeof setInterval> | null>(null);
  // Store current user in ref for use inside callbacks without stale closure
  const currentUserRef       = useRef<any | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser) saveUser(currentUser);
  }, [currentUser]);

  // ── INIT on mount ─────────────────────────────────────────
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const init = async () => {
      const token  = getToken();
      const cached = loadUser();

      if (!token) {
        setLoading(false);
        return;
      }

      // KEY FIX: Restore cached user IMMEDIATELY so ProtectedRoute
      // gets the correct role on first render — prevents wrong redirect
      if (cached) {
        setCurrentUser(cached);
        currentUserRef.current = cached;
      }

      try {
        const res = await authAPI.getMe();
        if (res?.user) {
          const fresh = normaliseUser(res.user);
          setCurrentUser(fresh);
          currentUserRef.current = fresh;
          saveUser(fresh);
          // Load complaints in background — don't block UI
          loadComplaints(fresh).catch(() => {});
          if (fresh.role === 'admin') loadUsers(fresh).catch(() => {});
          else setUsers([]);
          startPolling(fresh);
        } else {
          // getMe returned but no user — clear auth
          removeToken(); saveUser(null);
          setCurrentUser(null);
          currentUserRef.current = null;
        }
      } catch (err: any) {
        const msg = String(err?.message || '').toLowerCase();
        const isRealAuthError =
          msg.includes('401') || msg.includes('403') ||
          msg.includes('jwt expired') || msg.includes('token invalid') ||
          msg.includes('token expired') || msg.includes('not authorized') ||
          msg.includes('unauthorized');

        if (isRealAuthError) {
          removeToken(); saveUser(null);
          setCurrentUser(null);
          currentUserRef.current = null;
        } else {
          // Network error — keep cached session, load data from cache
          console.warn('[JANVANI] getMe network error — keeping cached session:', msg);
          if (cached) {
            loadComplaints(cached).catch(() => {});
            if (cached.role === 'admin') loadUsers(cached).catch(() => {});
            else setUsers([]);
            startPolling(cached);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => stopPolling();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling for live updates (20s) ────────────────────────
  const startPolling = useCallback((user: any) => {
    stopPolling();
    pollTimer.current = setInterval(() => {
      const u = currentUserRef.current || user;
      if (u) {
        loadComplaints(u).catch(() => {});
        if (u.role === 'admin') loadUsers(u).catch(() => {});
      }
    }, 20_000);
  }, []);

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  // ── loadComplaints — role-aware ──────────────────────────
  const loadComplaints = useCallback(async (user?: any) => {
    if (isLoadingComplaints.current) return;
    isLoadingComplaints.current = true;
    try {
      const activeUser = user || currentUserRef.current;
      if (!activeUser) return;

      const params: Record<string, string | number> = { limit: 200 };

      // DATA ISOLATION: citizens only fetch their own complaints
      if (activeUser?.role === 'citizen') {
        const uid = activeUser._id || activeUser.id;
        if (uid) params.citizenId = uid;
      }

      const res = await complaintAPI.getAll(params);
      if (res?.complaints) {
        setComplaints(res.complaints.map(normaliseComplaint));
      }
    } catch (err) {
      console.warn('[JANVANI] loadComplaints failed:', err);
    } finally {
      isLoadingComplaints.current = false;
    }
  }, []);

  // ── loadUsers — admin-only citizens list ─────────────────
  const loadUsers = useCallback(async (user?: any) => {
    if (isLoadingUsers.current) return;
    isLoadingUsers.current = true;
    try {
      const activeUser = user || currentUserRef.current;
      if (!activeUser) return;
      if (activeUser?.role !== 'admin') {
        setUsers([]);
        return;
      }

      const res = await userAPI.getAllCitizens();
      if (res?.users) {
        setUsers(res.users.map(normaliseUser));
      }
    } catch (err) {
      console.warn('[JANVANI] loadUsers failed:', err);
    } finally {
      isLoadingUsers.current = false;
    }
  }, []);

  const refreshComplaints = useCallback(() => loadComplaints(), [loadComplaints]);

  // ── Derived: memoized citizen-specific complaints ────────
  const myComplaints = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return complaints;
    const uid = currentUser.id || currentUser._id;
    return complaints.filter(c => {
      const cid = c.citizenId?._id || c.citizenId;
      return cid === uid || cid?.toString() === uid?.toString();
    });
  }, [complaints, currentUser]);

  // ── login — optimized: don't block on loadComplaints ─────
  const login = async (email: string, password: string, role?: 'citizen' | 'admin'): Promise<any> => {
    clearCache(); // Clear stale cache before login
    let result: any;

    if (role === 'admin') {
      result = await authAPI.adminLogin(email, password);
    } else if (role === 'citizen') {
      result = await authAPI.citizenLogin(email, password);
    } else {
      try { result = await authAPI.citizenLogin(email, password); }
      catch { result = await authAPI.adminLogin(email, password); }
    }

    if (!result?.token) throw new Error('Login failed — no token received');

    setToken(result.token);
    const user = normaliseUser(result.user);
    setCurrentUser(user);
    currentUserRef.current = user;
    saveUser(user);

    // Ensure admin screens have citizens list
    if (user.role === 'admin') loadUsers(user).catch(() => {});
    else setUsers([]);

    // Load complaints in background — don't block navigation
    loadComplaints(user).catch(() => {});
    startPolling(user);

    return user;
  };

  // ── register ───────────────────────────────────────────────
  const register = async (data: any): Promise<any> => {
    clearCache();
    const result = await (data.role === 'admin'
      ? authAPI.adminRegister(data)
      : authAPI.citizenRegister(data));

    if (!result?.token) throw new Error('Registration failed');

    setToken(result.token);
    const user = normaliseUser(result.user);
    setCurrentUser(user);
    currentUserRef.current = user;
    saveUser(user);

    if (user.role === 'admin') loadUsers(user).catch(() => {});
    else setUsers([]);

    loadComplaints(user).catch(() => {});
    startPolling(user);

    return user;
  };

  // ── logout ─────────────────────────────────────────────────
  const logout = () => {
    stopPolling();
    clearCache();
    removeToken();
    saveUser(null);
    setCurrentUser(null);
    currentUserRef.current = null;
    setComplaints([]);
    setUsers([]);
    setLeaderboard([]);
  };

  // ── updateUser ─────────────────────────────────────────────
  const updateUser = async (updates: Record<string, any>) => {
    try {
      const res = await userAPI.updateProfile(updates);
      const updated = res?.user ? normaliseUser(res.user) : { ...currentUser, ...updates };
      setCurrentUser(updated);
      currentUserRef.current = updated;
      saveUser(updated);
    } catch {
      const updated = { ...currentUser, ...updates };
      setCurrentUser(updated);
      currentUserRef.current = updated;
      saveUser(updated);
    }
  };

  // ── addComplaint ───────────────────────────────────────────
  const addComplaint = async (data: object) => {
    const res = await complaintAPI.create(data);
    if (res?.complaint) {
      const c = normaliseComplaint(res.complaint);
      setComplaints(prev => [c, ...prev]);
      setCurrentUser((u: any) => {
        if (!u) return u;
        const updated = {
          ...u,
          points: (u.points || 0) + 50,
          complaintsSubmitted: (u.complaintsSubmitted || 0) + 1,
        };
        currentUserRef.current = updated;
        saveUser(updated);
        return updated;
      });
      return c;
    }
    return null;
  };

  // ── updateComplaintStatus ──────────────────────────────────
  const updateComplaintStatus = async (
    id: string, status: string, note?: string, officer?: string
  ) => {
    const snapshot = complaints.slice();
    setComplaints(prev => prev.map(x =>
      matchId(x, id)
        ? { ...x, status,
            ...(note    ? { adminNote: note }          : {}),
            ...(officer ? { assignedOfficer: officer } : {}),
            updatedAt: new Date().toISOString().split('T')[0] }
        : x
    ));
    try {
      const apiId = getMongoId(snapshot, id);
      const res = await complaintAPI.updateStatus(apiId, status, note, officer);
      if (res?.complaint) {
        const c = normaliseComplaint(res.complaint);
        setComplaints(prev => prev.map(x => matchId(x, id) ? c : x));
      }
    } catch (err) {
      setComplaints(snapshot);
      throw err;
    }
  };

  // ── resolveComplaint ───────────────────────────────────────
  const resolveComplaint = async (
    id: string, photo: string, note: string, officer: string
  ) => {
    const snapshot = complaints.slice();
    setComplaints(prev => prev.map(x =>
      matchId(x, id)
        ? { ...x, status: 'Resolved', resolvePhoto: photo,
            adminNote: note, assignedOfficer: officer,
            updatedAt: new Date().toISOString().split('T')[0] }
        : x
    ));
    try {
      const apiId = getMongoId(snapshot, id);
      const res = await complaintAPI.resolve(apiId, photo, note, officer);
      let resolved: any;
      if (res?.complaint) {
        resolved = normaliseComplaint(res.complaint);
        setComplaints(prev => prev.map(x => matchId(x, id) ? resolved : x));
      } else {
        resolved = {
          ...(snapshot.find(x => matchId(x, id)) || {}),
          status: 'Resolved', resolvePhoto: photo, adminNote: note, assignedOfficer: officer,
        };
      }
      if (resolved) {
        try { await emailAPI.sendResolutionEmail(resolved); } catch { /* non-blocking */ }
      }
    } catch (err) {
      setComplaints(snapshot);
      throw err;
    }
  };

  // ── deleteComplaint ────────────────────────────────────────
  const deleteComplaint = async (id: string) => {
    const snapshot = complaints.slice();
    setComplaints(prev => prev.filter(x => !matchId(x, id)));
    try {
      const apiId = getMongoId(snapshot, id);
      await complaintAPI.delete(apiId);
    } catch (err) {
      setComplaints(snapshot);
      throw err;
    }
  };

  // ── supportComplaint ───────────────────────────────────────
  const supportComplaint = async (id: string) => {
    const apiId = getMongoId(complaints, id);
    const res = await complaintAPI.support(apiId);
    if (res?.supportCount !== undefined) {
      setComplaints(prev => prev.map(x =>
        matchId(x, id) ? { ...x, supportCount: res.supportCount } : x
      ));
    } else {
      setComplaints(prev => prev.map(x =>
        matchId(x, id) ? { ...x, supportCount: (x.supportCount || 0) + 1 } : x
      ));
    }
  };

  // ── submitFeedback ─────────────────────────────────────────
  const submitFeedback = async (
    id: string,
    feedback: { rating: number; comment: string; resolved: any }
  ) => {
    const apiId = getMongoId(complaints, id);
    const res = await complaintAPI.feedback(apiId, feedback);
    if (res?.complaint) {
      const c = normaliseComplaint(res.complaint);
      setComplaints(prev => prev.map(x => matchId(x, id) ? c : x));
    } else {
      setComplaints(prev => prev.map(x => matchId(x, id) ? { ...x, feedback } : x));
    }
    setCurrentUser((u: any) => {
      if (!u) return u;
      const updated = { ...u, points: (u.points || 0) + 25 };
      currentUserRef.current = updated;
      saveUser(updated);
      return updated;
    });
  };

  // ── refreshLeaderboard ─────────────────────────────────────
  const refreshLeaderboard = async (ward?: number) => {
    try {
      const res = await userAPI.getLeaderboard(ward);
      if (res?.leaderboard) {
        const list = res.leaderboard.map(normaliseUser);
        setLeaderboard(list);
        setUsers(list);
      }
    } catch (err) {
      console.warn('[JANVANI] refreshLeaderboard failed', err);
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser, complaints, users, loading,
      login, register, logout, updateUser,
      addComplaint, updateComplaintStatus, resolveComplaint,
      deleteComplaint, supportComplaint, submitFeedback, refreshComplaints,
      leaderboard, refreshLeaderboard,
      myComplaints,
    }}>
      {children}
    </AppContext.Provider>
  );
};