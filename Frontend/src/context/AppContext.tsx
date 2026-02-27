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
  userAPI,
  emailAPI,
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
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
};

/* ================= LOCAL STORAGE ================= */

const USER_KEY = "jv_user";
const COMPLAINTS_KEY = "jv_complaints";
const CACHE_MAX_AGE = 5 * 60 * 1000;

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
    } catch {
      return null;
    }
  },

  set(key: string, data: any) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ data, __ts: Date.now() })
      );
    } catch {}
  },

  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

/* ================= PROVIDER ================= */

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  });

  const [complaints, setComplaints] = useState<any[]>(
    () => ls.get<any[]>(COMPLAINTS_KEY) || []
  );

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const currentUserRef = useRef<any | null>(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    }
  }, [currentUser]);

  /* ================= LOAD COMPLAINTS ================= */

  const loadComplaints = useCallback(async () => {
    try {
      const res = await complaintAPI.getAll();
      if (res?.complaints) {
        setComplaints(res.complaints);
        ls.set(COMPLAINTS_KEY, res.complaints);
      }
    } catch (err) {
      console.warn("Failed loading complaints", err);
    }
  }, []);

  const refreshComplaints = useCallback(async () => {
    await loadComplaints();
  }, [loadComplaints]);

  /* ================= LOGIN ================= */

  const login = async (
    email: string,
    password: string,
    role?: "citizen" | "admin"
  ) => {
    clearCache();
    ls.remove(COMPLAINTS_KEY);

    let result: any;

    if (role === "admin") {
      result = await authAPI.adminLogin(email, password);
    } else {
      result = await authAPI.citizenLogin(email, password);
    }

    if (!result?.token) throw new Error("Login failed");

    setToken(result.token);
    setCurrentUser(result.user);

    await loadComplaints();

    return result.user;
  };

  /* ================= REGISTER ================= */

  const register = async (data: any) => {
    const result =
      data.role === "admin"
        ? await authAPI.adminRegister(data)
        : await authAPI.citizenRegister(data);

    if (!result?.token) throw new Error("Registration failed");

    setToken(result.token);
    setCurrentUser(result.user);

    await loadComplaints();

    return result.user;
  };

  /* ================= LOGOUT ================= */

  const logout = () => {
    clearCache();
    removeToken();
    localStorage.removeItem(USER_KEY);
    ls.remove(COMPLAINTS_KEY);
    setCurrentUser(null);
    setComplaints([]);
    setUsers([]);
  };

  /* ================= DERIVED ================= */

  const myComplaints = useMemo(() => {
    if (!currentUser) return [];
    return complaints.filter(
      (c) => c.citizenId === currentUser._id
    );
  }, [complaints, currentUser]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        complaints,
        users,
        loading,
        login,
        register,
        logout,
        refreshComplaints,
        myComplaints,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};