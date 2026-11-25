import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { parseDashboardScope } from "../../utils/dashboardScope";

/**
 * `/dashboard/:scope/...` ka shell.
 *
 * Signed-in account ka apna scope hi URL me chal sakta hai — kisi doosre scope
 * ka URL kholne par wapas apne dashboard par redirect hota hai. Admin ka poora
 * kaam isi prefix ke andar chalta hai, jaise:
 *
 *   /dashboard/admin/customers
 *   /dashboard/admin/personalloan
 *   /dashboard/sub-admin/review
 */
const WorkspaceShell = () => {
  const { scope } = useParams<{ scope?: string }>();
  const { dashboardScope, dashboardPath } = useAuth();

  if (parseDashboardScope(scope) !== dashboardScope) {
    return <Navigate to={dashboardPath} replace />;
  }

  return <Outlet />;
};

export default WorkspaceShell;
