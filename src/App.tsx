import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import Dashboard from "./pages/dashboard/Dashboard";
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

            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <CustomersList />
                </ProtectedRoute>
              }
            />

            {/* Sabhi products ki rejections — reject reason highlight ke saath */}
            <Route
              path="/rejected-loans"
              element={
                <ProtectedRoute>
                  <RejectedLoans />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchises"
              element={
                <ProtectedRoute>
                  <FranchiseList />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchise-plans"
              element={
                <ProtectedRoute>
                  <FranchisePlans />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchises/:id"
              element={
                <ProtectedRoute>
                  <FranchiseDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchise-customers"
              element={
                <ProtectedRoute>
                  <FranchiseCustomers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchise-customers/stats"
              element={
                <ProtectedRoute>
                  <FranchiseCustomers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/franchise-customers/:id"
              element={
                <ProtectedRoute>
                  <FranchiseCustomers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/masters"
              element={
                <ProtectedRoute>
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
                <ProtectedRoute>
                  <LocationMasterAdmin />
                </ProtectedRoute>
              }
            />

            {/* Type-addressed master detail — stable across re-seeds */}
            <Route
              path="/masters/type/:type"
              element={
                <ProtectedRoute>
                  <MasterDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/masters/:id"
              element={
                <ProtectedRoute>
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
