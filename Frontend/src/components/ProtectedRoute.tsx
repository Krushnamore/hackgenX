/**
 * Frontend/src/components/ProtectedRoute.tsx
 *
 * CHANGED: 'admin' role prop now allows superAdmin, dept_officer, and legacy admin.
 */

import { Navigate } from 'react-router-dom';
import { useApp }   from '@/context/AppContext';
import { isAdminRole } from '@/types';

interface Props {
  children : React.ReactNode;
  role     : 'citizen' | 'admin';
}

export function ProtectedRoute({ children, role }: Props) {
  const { currentUser, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to={role === 'admin' ? '/admin/login' : '/citizen/login'} replace />;
  }

  // 'admin' role prop → allow superAdmin, dept_officer, legacy admin
  if (role === 'admin' && !isAdminRole(currentUser.role)) {
    return <Navigate to="/admin/login" replace />;
  }

  // 'citizen' role prop → only citizens
  if (role === 'citizen' && currentUser.role !== 'citizen') {
    return <Navigate to="/citizen/login" replace />;
  }

  return <>{children}</>;
}