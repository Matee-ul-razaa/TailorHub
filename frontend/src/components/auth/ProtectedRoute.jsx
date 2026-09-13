import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * ProtectedRoute — wraps pages that require authentication and/or a specific role.
 *
 * Usage:
 *   <ProtectedRoute>                        → requires auth only
 *   <ProtectedRoute requiredRole="admin">   → requires auth + admin role
 */
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div
          className="border-4 rounded-circle"
          style={{
            width: 36,
            height: 36,
            borderStyle: 'solid',
            borderColor: 'var(--th-accent) transparent transparent transparent',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
