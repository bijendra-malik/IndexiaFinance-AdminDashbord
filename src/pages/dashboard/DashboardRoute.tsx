import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { parseDashboardScope } from "../../utils/dashboardScope";
import Dashboard from "./Dashboard";

/**
 * `/dashboard` par sirf super admin ka dashboard hai. Baaki har account apne
 * scope wale URL par chala jaata hai (`/dashboard/sub-admin`, `/dashboard/admin`,
 * `/dashboard/customer`, `/dashboard/franchise`). Loan products wala admin bhi
 * `/dashboard/admin` par hi rehta hai.
 *
 * Kisi doosre scope ka URL kholne par bhi wapas apne dashboard par redirect
 * hota hai — URL hamesha batata hai ki dashboard kiska hai, aur galat URL kabhi
 * doosre ka data nahi dikhata.
 */
const DashboardRoute = () => {
  const { scope } = useParams<{ scope?: string }>();
  const { dashboardScope, dashboardPath } = useAuth();

  if (scope === undefined) {
    return dashboardScope === "super-admin" ? <Dashboard /> : <Navigate to={dashboardPath} replace />;
  }

  if (parseDashboardScope(scope) !== dashboardScope) {
    return <Navigate to={dashboardPath} replace />;
  }

  return <Dashboard />;
};

export default DashboardRoute;
