import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { AdminPermission } from "../../constants/adminPermissions";

const ProtectedRoute = ({
  children,
  requireSuperAdmin = false,
  requireModule,
  requirePermission,
}: {
  children: ReactNode;
  /** Team / access management is reserved for super admins. */
  requireSuperAdmin?: boolean;
  /** Restrict a route to admins assigned this module (super admins included). */
  requireModule?: string;
  /** Sub-admin capability gate (super admins hold every permission). */
  requirePermission?: AdminPermission;
}) => {
  const { isLoggedIn, isLoading, isSuperAdmin, canAccessModule, can } = useAuth();

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

  if (requirePermission && !can(requirePermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
