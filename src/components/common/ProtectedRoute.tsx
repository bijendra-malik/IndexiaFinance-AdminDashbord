import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ProtectedRoute = ({
  children,
  requireSuperAdmin = false,
  requireModule,
}: {
  children: ReactNode;
  /** Team / access management is reserved for super admins. */
  requireSuperAdmin?: boolean;
  /** Restrict a route to admins assigned this module (super admins included). */
  requireModule?: string;
}) => {
  const { isLoggedIn, isLoading, isSuperAdmin, canAccessModule } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading...
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireModule && !canAccessModule(requireModule)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
