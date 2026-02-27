import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';

interface Props {
  children   : React.ReactNode;
  role?      : 'citizen' | 'admin';
  redirectTo?: string;
}

/**
 * ProtectedRoute — Fixed
 *
 * KEY FIX: On reload, AppContext restores the cached user BEFORE setLoading(false).
 * This means:
 * - loading=true  → show spinner (never redirect)
 * - loading=false + no user → redirect to login
 * - loading=false + user with wrong role → redirect to correct portal
 * - loading=false + user with correct role → render children
 *
 * The cached user now has the correct role from localStorage, so a citizen
 * reloading /citizen/* will NOT be redirected to admin, and vice versa.
 */
export function ProtectedRoute({
  children,
  role,
  redirectTo,
}: Props) {
  const { currentUser, loading } = useApp();
  const location = useLocation();

  // While verifying token → always show spinner, never redirect
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-muted border-t-accent animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading your session…</p>
        </div>
      </div>
    );
  }

  // Not logged in → send to appropriate login
  if (!currentUser) {
    const loginPath = redirectTo ?? (role === 'admin' ? '/admin/login' : '/citizen/login');
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Wrong role → redirect to correct portal, not the other role's login
  if (role && currentUser.role !== role) {
    const correctHome = currentUser.role === 'admin'
      ? '/admin/dashboard'
      : '/citizen/dashboard';
    return <Navigate to={correctHome} replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;