import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import { ToastProvider } from "./context/ToastProvider";
import ProtectedRoute from "./components/common/ProtectedRoute";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import Dashboard from "./pages/dashboard/Dashboard";
import TeamAccess from "./pages/team/TeamAccess";
import MastersList from "./pages/masters/MastersList";
import MasterDetail from "./pages/masters/MasterDetail";
import LoanApplicationsList from "./pages/applications/LoanApplicationsList";
import LoanApplicationDetail from "./pages/applications/LoanApplicationDetail";
import CustomersList from "./pages/customers/CustomersList";
import RejectedLoans from "./pages/rejected/RejectedLoans";
import LocationMasterAdmin from "./pages/masters/LocationMasterAdmin";
import FranchiseList from "./pages/franchises/FranchiseList";
import FranchiseDetail from "./pages/franchises/FranchiseDetail";
import FranchiseCustomers from "./pages/franchises/FranchiseCustomers";
import FranchisePlans from "./pages/franchises/FranchisePlans";

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Team & loan-access management — super admins only */}
            <Route
              path="/team"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <TeamAccess />
                </ProtectedRoute>
              }
            />

            {/* Customers / masters / franchise are super-admin sections */}
            <Route
              path="/customers"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <CustomersList />
                </ProtectedRoute>
              }
            />

            {/* Sabhi products ki rejections — reject reason highlight ke saath.
                `/rejected-loans/customer`, `/franchise-customer`, `/franchise`
                wahi page khulte hain, bas channel filter pehle se laga hota hai. */}
            <Route
              path="/rejected-loans"
              element={
                <ProtectedRoute>
                  <RejectedLoans />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rejected-loans/:channel"
              element={
                <ProtectedRoute>
                  <RejectedLoans />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchises"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <FranchiseList />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchise-plans"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <FranchisePlans />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchises/:id"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <FranchiseDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchise-customers"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <FranchiseCustomers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchise-customers/stats"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <FranchiseCustomers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchise-customers/:id"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <FranchiseCustomers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/masters"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <MastersList />
                </ProtectedRoute>
              }
            />

            {/* Legacy URL kept alive so old bookmarks keep working */}
            <Route
              path="/masters/states-cities"
              element={<Navigate to="/masters/locations" replace />}
            />

            <Route
              path="/masters/locations"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <LocationMasterAdmin />
                </ProtectedRoute>
              }
            />

            {/* Type-addressed master detail — stable across re-seeds */}
            <Route
              path="/masters/type/:type"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <MasterDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/masters/:id"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <MasterDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/applications/:loanType/:id"
              element={
                <ProtectedRoute>
                  <LoanApplicationDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/applications/:loanType"
              element={
                <ProtectedRoute>
                  <LoanApplicationsList />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
