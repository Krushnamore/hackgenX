/**
 * AppContext.tsx — PERFORMANCE OPTIMIZED
 *
 * KEY IMPROVEMENTS OVER ORIGINAL:
 * 1. INSTANT RENDER: Cached complaints restored from localStorage immediately —
 *    no spinner while waiting for /api/complaints on reload
 * 2. STALE-WHILE-REVALIDATE: Show cached data first, silently refresh in background
 * 3. POLLING: Increased to 30s (was 20s) — reduces server load without hurting UX
 * 4. BADGE UPDATE: Done client-side instantly; no extra User.findById round-trip needed
 * 5. PARALLEL INIT: getMe + loadComplaints fire concurrently instead of sequentially
 * 6. LEADERBOARD CACHE: Cached separately so switching wards doesn't flicker
 * 7. COMPLAINT LIMIT: Reduced to 100 for citizens (they rarely have > 20)
 * 8. DEDUPLICATION: isLoading refs prevent concurrent fetches (kept from original)
 * 9. OPTIMISTIC UPDATES: All mutations update UI before API responds (kept + extended)
 * 10. NO STALE CLOSURE: currentUserRef pattern kept for polling callbacks
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
  globalTop3            : any[];
  refreshLeaderboard    : (ward?: number, limit?: number) => Promise<void>;
  myComplaints          : any[];
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};

// ─── localStorage helpers ─────────────────────────────────────
const USER_KEY        = 'jv_user';
const COMPLAINTS_KEY  = 'jv_complaints';
const LEADERBOARD_KEY = 'jv_leaderboard';
const CACHE_MAX_AGE   = 5 * 60 * 1000; // 5 minutes — stale-while-revalidate threshold

const ls = {
  get: <T>(key: string): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Invalidate if older than CACHE_MAX_AGE
      if (parsed?.__ts && Date.now() - parsed.__ts > CACHE_MAX_AGE) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed?.data ?? parsed;
    } catch { return null; }
  },
  set: (key: string, data: any) => {
    try { localStorage.setItem(key, JSON.stringify({ data, __ts: Date.now() })); } catch {}
  },
  remove: (key: string) => { try { localStorage.removeItem(key); } catch {} },
};

// Backwards-compat: jv_user was stored without __ts wrapper
const loadUser = (): any | null => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
};
const saveUser = (u: any) =>
  u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY);

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

// ─── Badge calc (client-side — avoids extra DB round-trip) ───
const calcBadge = (points: number): 'Bronze' | 'Silver' | 'Gold' =>
  points >= 1000 ? 'Gold' : points >= 500 ? 'Silver' : 'Bronze';

// ─── Provider ─────────────────────────────────────────────────
export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  // ── Seed state from localStorage immediately — zero flicker ──
  const [currentUser, setCurrentUser] = useState<any | null>(loadUser);
  const [complaints,  setComplaints]  = useState<any[]>(() => ls.get<any[]>(COMPLAINTS_KEY) || []);
  const [users,       setUsers]       = useState<any[]>([]);
  const [leaderboard,  setLeaderboard]  = useState<any[]>(() => ls.get<any[]>(LEADERBOARD_KEY) || []);
  const [globalTop3,   setGlobalTop3]   = useState<any[]>(() => ls.get<any[]>('jv_top3') || []);
  // If we already have a cached user + token, skip the loading spinner
  const [loading, setLoading] = useState(() => !!(getToken() && !loadUser()));

  const didInit             = useRef(false);
  const isLoadingComplaints = useRef(false);
  const isLoadingUsers      = useRef(false);
  const pollTimer           = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserRef      = useRef<any | null>(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser) saveUser(currentUser);
  }, [currentUser]);

  // ── INIT on mount ──────────────────────────────────────────
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

      // Restore cached user immediately — ProtectedRoute can render right away
      if (cached) {
        setCurrentUser(cached);
        currentUserRef.current = cached;
        // Stagger background loads — don't hammer Atlas simultaneously
        loadComplaints(cached).catch(() => {});
        if (cached.role === 'admin') {
          // Give complaints a 2s head-start before loading users
          setTimeout(() => loadUsers(cached).catch(() => {}), 2_000);
        }
        startPolling(cached);
      }

      // Validate session in background — don't block UI
      try {
        const res = await authAPI.getMe();
        if (res?.user) {
          const fresh = normaliseUser(res.user);
          setCurrentUser(fresh);
          currentUserRef.current = fresh;
          saveUser(fresh);
          // Refresh complaints with fresh user context
          loadComplaints(fresh).catch(() => {});
          if (fresh.role === 'admin') {
            setTimeout(() => loadUsers(fresh).catch(() => {}), 2_000);
          }
          else setUsers([]);
          startPolling(fresh);
        } else {
          removeToken(); saveUser(null);
          setCurrentUser(null);
          currentUserRef.current = null;
          setComplaints([]);
          ls.remove(COMPLAINTS_KEY);
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
          setComplaints([]);
          ls.remove(COMPLAINTS_KEY);
        }
        // Network error: cached data already shown — just keep it
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => stopPolling();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling — 30s (was 20s, reduced server load) ─────────
  const startPolling = useCallback((user: any) => {
    stopPolling();
    pollTimer.current = setInterval(() => {
      const u = currentUserRef.current || user;
      if (u) {
        loadComplaints(u).catch(() => {});
        if (u.role === 'admin') loadUsers(u).catch(() => {});
      }
    }, 30_000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopPolling = () => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  };

  // ── loadComplaints — role-aware, caches to localStorage ──
  const loadComplaints = useCallback(async (user?: any, attempt = 1) => {
    if (isLoadingComplaints.current) return;
    isLoadingComplaints.current = true;
    try {
      const activeUser = user || currentUserRef.current;
      if (!activeUser) return;

      // Citizens fetch 100; admins fetch 200
      const limit = activeUser.role === 'citizen' ? 100 : 200;
      const params: Record<string, string | number> = { limit };

      const res = await complaintAPI.getAll(params);
      if (res?.complaints) {
        const normalised = res.complaints.map(normaliseComplaint);
        setComplaints(normalised);
        ls.set(COMPLAINTS_KEY, normalised);
      }
    } catch (err: any) {
      const isTimeout = String(err?.message || '').toLowerCase().includes('timed out');
      console.warn(`[JANVANI] loadComplaints failed (attempt ${attempt}):`, err);
      // Auto-retry once after 4s on timeout — Atlas cold-start can be slow
      if (isTimeout && attempt < 3) {
        isLoadingComplaints.current = false;
        setTimeout(() => loadComplaints(user, attempt + 1), 4_000);
        return;
      }
    } finally {
      isLoadingComplaints.current = false;
    }
  }, []);

  // ── loadUsers — admin-only ─────────────────────────────────
  const loadUsers = useCallback(async (user?: any) => {
    if (isLoadingUsers.current) return;
    isLoadingUsers.current = true;
    try {
      const activeUser = user || currentUserRef.current;
      if (!activeUser || activeUser.role !== 'admin') { setUsers([]); return; }

      const res = await userAPI.getAllCitizens();
      if (res?.users) setUsers(res.users.map(normaliseUser));
    } catch (err) {
      console.warn('[JANVANI] loadUsers failed:', err);
    } finally {
      isLoadingUsers.current = false;
    }
  }, []);

  const refreshComplaints = useCallback(() => loadComplaints(), [loadComplaints]);

  // ── myComplaints — memoized, derived from complaints ──────
  const myComplaints = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return complaints;
    const uid = currentUser.id || currentUser._id;
    return complaints.filter(c => {
      const cid = c.citizenId?._id || c.citizenId;
      return cid === uid || cid?.toString() === uid?.toString();
    });
  }, [complaints, currentUser]);

  // ── login ─────────────────────────────────────────────────
  const login = async (email: string, password: string, role?: 'citizen' | 'admin'): Promise<any> => {
    clearCache();
    ls.remove(COMPLAINTS_KEY);
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

    if (user.role === 'admin') loadUsers(user).catch(() => {});
    else setUsers([]);

    loadComplaints(user).catch(() => {});
    startPolling(user);

    return user;
  };

  // ── register ──────────────────────────────────────────────
  const register = async (data: any): Promise<any> => {
    clearCache();
    ls.remove(COMPLAINTS_KEY);
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

  // ── logout ────────────────────────────────────────────────
  const logout = () => {
    stopPolling();
    clearCache();
    removeToken();
    saveUser(null);
    ls.remove(COMPLAINTS_KEY);
    ls.remove(LEADERBOARD_KEY);
    setCurrentUser(null);
    currentUserRef.current = null;
    setComplaints([]);
    setUsers([]);
    setLeaderboard([]);
  };

  // ── updateUser ────────────────────────────────────────────
  const updateUser = async (updates: Record<string, any>) => {
    // Optimistic update first
    const optimistic = { ...currentUser, ...updates };
    setCurrentUser(optimistic);
    currentUserRef.current = optimistic;
    saveUser(optimistic);
    try {
      const res = await userAPI.updateProfile(updates);
      if (res?.user) {
        const fresh = normaliseUser(res.user);
        setCurrentUser(fresh);
        currentUserRef.current = fresh;
        saveUser(fresh);
      }
    } catch {
      // Optimistic update already applied — keep it
    }
  };

  // ── addComplaint ──────────────────────────────────────────
  const addComplaint = async (data: object) => {
    const res = await complaintAPI.create(data);
    if (res?.complaint) {
      const c = normaliseComplaint(res.complaint);
      setComplaints(prev => {
        const updated = [c, ...prev];
        ls.set(COMPLAINTS_KEY, updated);
        return updated;
      });
      setCurrentUser((u: any) => {
        if (!u) return u;
        const pts = (u.points || 0) + 50;
        const updated = {
          ...u,
          points: pts,
          badge: calcBadge(pts),
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

  // ── updateComplaintStatus ─────────────────────────────────
  const updateComplaintStatus = async (
    id: string, status: string, note?: string, officer?: string
  ) => {
    const snapshot = complaints.slice();
    const optimistic = snapshot.map(x =>
      matchId(x, id)
        ? { ...x, status,
            ...(note    ? { adminNote: note }          : {}),
            ...(officer ? { assignedOfficer: officer } : {}),
            updatedAt: new Date().toISOString().split('T')[0] }
        : x
    );
    setComplaints(optimistic);
    ls.set(COMPLAINTS_KEY, optimistic);
    try {
      const apiId = getMongoId(snapshot, id);
      const res = await complaintAPI.updateStatus(apiId, status, note, officer);
      if (res?.complaint) {
        const c = normaliseComplaint(res.complaint);
        setComplaints(prev => {
          const updated = prev.map(x => matchId(x, id) ? c : x);
          ls.set(COMPLAINTS_KEY, updated);
          return updated;
        });
      }
    } catch (err) {
      setComplaints(snapshot);
      ls.set(COMPLAINTS_KEY, snapshot);
      throw err;
    }
  };

  // ── resolveComplaint ──────────────────────────────────────
  const resolveComplaint = async (
    id: string, photo: string, note: string, officer: string
  ) => {
    const snapshot = complaints.slice();
    const optimistic = snapshot.map(x =>
      matchId(x, id)
        ? { ...x, status: 'Resolved', resolvePhoto: photo,
            adminNote: note, assignedOfficer: officer,
            updatedAt: new Date().toISOString().split('T')[0] }
        : x
    );
    setComplaints(optimistic);
    ls.set(COMPLAINTS_KEY, optimistic);
    try {
      const apiId = getMongoId(snapshot, id);
      const res = await complaintAPI.resolve(apiId, photo, note, officer);
      let resolved: any;
      if (res?.complaint) {
        resolved = normaliseComplaint(res.complaint);
        setComplaints(prev => {
          const updated = prev.map(x => matchId(x, id) ? resolved : x);
          ls.set(COMPLAINTS_KEY, updated);
          return updated;
        });
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
      ls.set(COMPLAINTS_KEY, snapshot);
      throw err;
    }
  };

  // ── deleteComplaint ───────────────────────────────────────
  const deleteComplaint = async (id: string) => {
    const snapshot = complaints.slice();
    const updated = snapshot.filter(x => !matchId(x, id));
    setComplaints(updated);
    ls.set(COMPLAINTS_KEY, updated);
    try {
      const apiId = getMongoId(snapshot, id);
      await complaintAPI.delete(apiId);
    } catch (err) {
      setComplaints(snapshot);
      ls.set(COMPLAINTS_KEY, snapshot);
      throw err;
    }
  };

  // ── supportComplaint ──────────────────────────────────────
  const supportComplaint = async (id: string) => {
    const apiId = getMongoId(complaints, id);
    // Optimistic
    setComplaints(prev => prev.map(x =>
      matchId(x, id) ? { ...x, supportCount: (x.supportCount || 0) + 1 } : x
    ));
    try {
      const res = await complaintAPI.support(apiId);
      if (res?.supportCount !== undefined) {
        setComplaints(prev => prev.map(x =>
          matchId(x, id) ? { ...x, supportCount: res.supportCount } : x
        ));
      }
    } catch (err) {
      // Revert optimistic
      setComplaints(prev => prev.map(x =>
        matchId(x, id) ? { ...x, supportCount: Math.max(0, (x.supportCount || 1) - 1) } : x
      ));
      throw err;
    }
  };

  // ── submitFeedback ────────────────────────────────────────
  const submitFeedback = async (
    id: string,
    feedback: { rating: number; comment: string; resolved: any }
  ) => {
    const apiId = getMongoId(complaints, id);
    const res = await complaintAPI.feedback(apiId, feedback);
    if (res?.complaint) {
      const c = normaliseComplaint(res.complaint);
      setComplaints(prev => {
        const updated = prev.map(x => matchId(x, id) ? c : x);
        ls.set(COMPLAINTS_KEY, updated);
        return updated;
      });
    } else {
      setComplaints(prev => prev.map(x => matchId(x, id) ? { ...x, feedback } : x));
    }
    // Award +25 pts client-side — no extra round-trip
    setCurrentUser((u: any) => {
      if (!u) return u;
      const pts = (u.points || 0) + 25;
      const updated = { ...u, points: pts, badge: calcBadge(pts) };
      currentUserRef.current = updated;
      saveUser(updated);
      return updated;
    });
  };

  // ── refreshLeaderboard — ward list + global top3 ────────────
  const refreshLeaderboard = async (ward?: number, limit?: number) => {
    try {
      // Always fetch city-wide top 3 in parallel with ward list
      const [res, top3Res] = await Promise.all([
        userAPI.getLeaderboard(ward, limit),
        userAPI.getTopCitywide(),
      ]);
      if (res?.leaderboard) {
        const list = res.leaderboard.map(normaliseUser);
        setLeaderboard(list);
        setUsers(list);
        if (!ward) ls.set(LEADERBOARD_KEY, list);
      }
      if (top3Res?.leaderboard) {
        const top3 = top3Res.leaderboard.map(normaliseUser);
        setGlobalTop3(top3);
        ls.set('jv_top3', top3);
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
      leaderboard, globalTop3, refreshLeaderboard,
      myComplaints,
    }}>
      {children}
    </AppContext.Provider>
  );
};