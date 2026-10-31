import { useState, type FormEvent } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { loginAdmin } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/apiError";

const Login = () => {
  const { isLoggedIn, login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // The backend accepts an email or an admin ID (`admin02`).
      const res = await loginAdmin({ email: identifier.trim(), password });
      login(res.token, res.admin);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to login. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #eaf5f8 0%, #eefaf5 100%)" }}
    >
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md overflow-hidden">
        <div style={{ height: "4px", background: "linear-gradient(90deg, #066a9c, #26ae90, #f2f231)" }} />
        <div className="p-8">
          <h1 className="text-xl font-semibold mb-1" style={{ color: "rgb(0, 102, 153)" }}>
            Indexia Finance
          </h1>
          <p className="text-sm text-slate-500 mb-6">Admin Panel Login</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Admin ID or Email
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(0,102,153,0.4)]"
                placeholder="admin01 or admin01@indexiafinance.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(0,102,153,0.4)]"
                placeholder="••••••••"
              />
              <div className="flex justify-end mt-1.5">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium hover:underline"
                  style={{ color: "rgb(0, 102, 153)" }}
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-white text-sm font-medium py-2.5 rounded-md transition disabled:opacity-60 hover:brightness-110"
              style={{ background: "linear-gradient(135deg, rgb(6, 106, 156), rgb(38, 174, 144))" }}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
