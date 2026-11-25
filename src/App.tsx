import type { ReactNode } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import { useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastProvider";
import ProtectedRoute from "./components/common/ProtectedRoute";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import Dashboard from "./pages/dashboard/Dashboard";
import DashboardRoute from "./pages/dashboard/DashboardRoute";
import WorkspaceShell from "./pages/workspace/WorkspaceShell";
import TeamAccess from "./pages/team/TeamAccess";
import AdminUpdates from "./pages/activity/AdminUpdates";
import ReviewQueue from "./pages/review/ReviewQueue";
import MastersList from "./pages/masters/MastersList";
import MasterDetail from "./pages/masters/MasterDetail";
import LoanApplicationsList from "./pages/applications/LoanApplicationsList";
import LoanApplicationDetail from "./pages/applications/LoanApplicationDetail";
import CustomersList from "./pages/customers/CustomersList";
import CustomerDetail from "./pages/customers/CustomerDetail";
import RejectedLoans from "./pages/rejected/RejectedLoans";
import LocationMasterAdmin from "./pages/masters/LocationMasterAdmin";
import FranchiseList from "./pages/franchises/FranchiseList";
import FranchiseDetail from "./pages/franchises/FranchiseDetail";
import FranchiseCustomers from "./pages/franchises/FranchiseCustomers";
import FranchisePlans from "./pages/franchises/FranchisePlans";
import ContactEnquiries from "./pages/contact/ContactEnquiries";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import EligibilityChecks from "./pages/eligibility/EligibilityChecks";
import { loanRouteName, loanSlugFromRouteParam, resolveLoanSlug } from "./constants/loanTypes";

/**
 * Landing route: har account apne workspace ke URL par jaata hai
 * (`/dashboard`, `/dashboard/sub-admin`, `/dashboard/admin`, …).
 */
const RootRedirect = () => {
  const { dashboardPath } = useAuth();
  return <Navigate to={dashboardPath} replace />;
};

/**
 * Purana flat URL → scope ke andar wala URL. Query string aur hash bache rehte
 * hain, is liye `/customers?customer=…` jaisi deep links kaam karti hain.
 */
const ScopedRedirect = ({ to }: { to: string }) => {
  const { workspacePath } = useAuth();
  const params = useParams();
  const { search, hash } = useLocation();
  /* `:id` / `:channel` / `:type` placeholders ko asli params se bharte hain. */
  const path = Object.entries(params).reduce(
    (value, [key, param]) =>
      value.replace(`:${key}`, param ? encodeURIComponent(param) : ""),
    to
  );
  return <Navigate to={`${workspacePath}${path}${search}${hash}`} replace />;
};

/** `/applications/personal-loan/:id` → `/dashboard/admin/personalloan/:id`. */
const ScopedLoanRedirect = () => {
  const { loanType, id } = useParams<{ loanType?: string; id?: string }>();
  const { workspacePath } = useAuth();
  const { search, hash } = useLocation();
  const slug = loanSlugFromRouteParam(loanType) ?? resolveLoanSlug(loanType);
  if (!slug) return <Navigate to={workspacePath} replace />;
  return (
    <Navigate
      to={`${workspacePath}/${loanRouteName(slug)}${id ? `/${id}` : ""}${search}${hash}`}
      replace
    />
  );
};

/** Scope ke andar sirf known loan names hi chalte hain. */
const LoanScopeGuard = ({ children }: { children: ReactNode }) => {
  const { loanType } = useParams<{ loanType?: string }>();
  const { dashboardPath } = useAuth();
  if (!loanSlugFromRouteParam(loanType)) return <Navigate to={dashboardPath} replace />;
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Plain `/dashboard` sirf super admin ka hai. */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardRoute />
                </ProtectedRoute>
              }
            />

            {/*

            Har account ka poora workspace apne scope ke andar:
              /dashboard/super-admin/customers
              /dashboard/admin/personalloan
              /dashboard/sub-admin/review

            */}
            <Route
              path="/dashboard/:scope"
              element={
                <ProtectedRoute>
                  <WorkspaceShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />

              <Route
                path="profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />

              {/* Notification inbox — bell ka "View all" yahan aata hai. Audience
                  server decide karta hai, isliye har signed-in admin ke liye khula hai. */}
              <Route
                path="notifications"
                element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                }
              />

              {/* Team & loan-access management — super admins only */}
              <Route
                path="team"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <TeamAccess />
                  </ProtectedRoute>
                }
              />

              {/* Admin updates feed — super admin sab dekhta hai, sub admin apne
                  scope me (permission: updates.view). */}
              <Route
                path="activity"
                element={
                  <ProtectedRoute requirePermission="updates.view">
                    <AdminUpdates />
                  </ProtectedRoute>
                }
              />

              {/* Sub admin ka review queue — verify / return / escalate */}
              <Route
                path="review"
                element={
                  <ProtectedRoute requirePermission="updates.review">
                    <ReviewQueue />
                  </ProtectedRoute>
                }
              />

              {/* Website contact form ki enquiries — super admin, ya jise
                  `contacts.manage` permission mili ho. */}
              <Route
                path="contact"
                element={
                  <ProtectedRoute requirePermission="contacts.manage">
                    <ContactEnquiries />
                  </ProtectedRoute>
                }
              />

              {/* Website eligibility calculator ke checks — super admin only. */}
              <Route
                path="eligibility-checks"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <EligibilityChecks />
                  </ProtectedRoute>
                }
              />

              {/* Customer module access is independent of loan-product access. */}
              <Route
                path="customers"
                element={
                  <ProtectedRoute requireModule="customers">
                    <CustomersList />
                  </ProtectedRoute>
                }
              />

              <Route
                path="customers/:id"
                element={
                  <ProtectedRoute requireModule="customers">
                    <CustomerDetail />
                  </ProtectedRoute>
                }
              />

              {/* Sabhi products ki rejections — channel filter URL me. */}
              <Route
                path="rejected-loans"
                element={
                  <ProtectedRoute>
                    <RejectedLoans />
                  </ProtectedRoute>
                }
              />
              <Route
                path="rejected-loans/:channel"
                element={
                  <ProtectedRoute>
                    <RejectedLoans />
                  </ProtectedRoute>
                }
              />

              <Route
                path="franchises"
                element={
                  <ProtectedRoute requireModule="franchises">
                    <FranchiseList />
                  </ProtectedRoute>
                }
              />

              <Route
                path="franchise-plans"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <FranchisePlans />
                  </ProtectedRoute>
                }
              />

              <Route
                path="franchises/:id"
                element={
                  <ProtectedRoute requireModule="franchises">
                    <FranchiseDetail />
                  </ProtectedRoute>
                }
              />

              <Route
                path="franchise-customers"
                element={
                  <ProtectedRoute requireModule="franchises">
                    <FranchiseCustomers />
                  </ProtectedRoute>
                }
              />

              <Route
                path="franchise-customers/stats"
                element={
                  <ProtectedRoute requireModule="franchises">
                    <FranchiseCustomers />
                  </ProtectedRoute>
                }
              />

              <Route
                path="franchise-customers/:id"
                element={
                  <ProtectedRoute requireModule="franchises">
                    <FranchiseCustomers />
                  </ProtectedRoute>
                }
              />

              <Route
                path="masters"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <MastersList />
                  </ProtectedRoute>
                }
              />

              <Route
                path="masters/locations"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <LocationMasterAdmin />
                  </ProtectedRoute>
                }
              />

              {/* Type-addressed master detail — stable across re-seeds */}
              <Route
                path="masters/type/:type"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <MasterDetail />
                  </ProtectedRoute>
                }
              />

              <Route
                path="masters/:id"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <MasterDetail />
                  </ProtectedRoute>
                }
              />

              {/*
              Loan product ka apna dashboard URL: name hi URL me, jaise
                /dashboard/admin/personalloan
                /dashboard/admin/personalloan/:id
              */}
              <Route
                path=":loanType"
                element={
                  <ProtectedRoute>
                    <LoanScopeGuard>
                      <LoanApplicationsList />
                    </LoanScopeGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path=":loanType/:id"
                element={
                  <ProtectedRoute>
                    <LoanScopeGuard>
                      <LoanApplicationDetail />
                    </LoanScopeGuard>
                  </ProtectedRoute>
                }
              />
            </Route>

            {/*
            Purane flat URLs zinda hain (bookmarks + andar ke links), par hamesha
            apne scope wale URL par le jaate hain.
            */}
            <Route path="/profile" element={<ScopedRedirect to="/profile" />} />
            <Route path="/notifications" element={<ScopedRedirect to="/notifications" />} />
            <Route path="/team" element={<ScopedRedirect to="/team" />} />
            <Route path="/activity" element={<ScopedRedirect to="/activity" />} />
            <Route path="/review" element={<ScopedRedirect to="/review" />} />
            <Route path="/contact" element={<ScopedRedirect to="/contact" />} />
            <Route
              path="/eligibility-checks"
              element={<ScopedRedirect to="/eligibility-checks" />}
            />
            <Route path="/customers" element={<ScopedRedirect to="/customers" />} />
            <Route path="/customers/:id" element={<ScopedRedirect to="/customers/:id" />} />
            <Route path="/rejected-loans" element={<ScopedRedirect to="/rejected-loans" />} />
            <Route
              path="/rejected-loans/:channel"
              element={<ScopedRedirect to="/rejected-loans/:channel" />}
            />
            <Route path="/franchises" element={<ScopedRedirect to="/franchises" />} />
            <Route path="/franchises/:id" element={<ScopedRedirect to="/franchises/:id" />} />
            <Route path="/franchise-plans" element={<ScopedRedirect to="/franchise-plans" />} />
            <Route
              path="/franchise-customers"
              element={<ScopedRedirect to="/franchise-customers" />}
            />
            <Route
              path="/franchise-customers/stats"
              element={<ScopedRedirect to="/franchise-customers/stats" />}
            />
            <Route
              path="/franchise-customers/:id"
              element={<ScopedRedirect to="/franchise-customers/:id" />}
            />
            <Route path="/masters" element={<ScopedRedirect to="/masters" />} />
            <Route path="/masters/locations" element={<ScopedRedirect to="/masters/locations" />} />
            <Route
              path="/masters/type/:type"
              element={<ScopedRedirect to="/masters/type/:type" />}
            />
            <Route path="/masters/:id" element={<ScopedRedirect to="/masters/:id" />} />
            <Route path="/applications/:loanType/:id" element={<ScopedLoanRedirect />} />
            <Route path="/applications/:loanType" element={<ScopedLoanRedirect />} />

            {/* Legacy URL kept alive so old bookmarks keep working */}
            <Route
              path="/masters/states-cities"
              element={<ScopedRedirect to="/masters/locations" />}
            />

            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
