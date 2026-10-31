import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchAdminProfile, type ApiAdmin } from "../api/auth";
import { claimSuperAdminRecord, readManagedAdmins, type ManagedAdmin } from "../api/adminUsers";
import {
  canAccessLoan as loanIsAllowed,
  isSuperAdminSession,
  loanTypesFor,
  resolveLoanAccess,
  resolveRole,
} from "../utils/adminAccess";
import { AuthContext } from "./AuthContext";

const readStoredAdmin = (): ApiAdmin | null => {
  try {
    const stored = localStorage.getItem("admin_user");
    return stored ? (JSON.parse(stored) as ApiAdmin) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<ApiAdmin | null>(readStoredAdmin);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("admin_token"));
  const [isLoading, setIsLoading] = useState<boolean>(() => !!localStorage.getItem("admin_token"));
  const [directory, setDirectory] = useState<ManagedAdmin[]>(readManagedAdmins);

  const refreshAccess = useCallback(() => setDirectory(readManagedAdmins()), []);

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
  }, []);

  const login = useCallback((newToken: string, newAdmin: ApiAdmin) => {
    setToken(newToken);
    setAdmin(newAdmin);
    localStorage.setItem("admin_token", newToken);
    localStorage.setItem("admin_user", JSON.stringify(newAdmin));
    // Register a super admin on their first sign-in so the short `admin01`
    // handle keeps working on this device afterwards.
    if (isSuperAdminSession(readManagedAdmins(), newAdmin)) {
      claimSuperAdminRecord(newAdmin);
    }
    setDirectory(readManagedAdmins());
  }, []);

  const updateAdmin = useCallback((updated: ApiAdmin) => {
    setAdmin(updated);
    localStorage.setItem("admin_user", JSON.stringify(updated));
    // An email change also moves the team-directory row, so re-read it.
    setDirectory(readManagedAdmins());
  }, []);

  // Re-validate a stored token once on mount. State only settles in the promise
  // callbacks, never synchronously inside the effect body.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchAdminProfile()
      .then((res) => {
        if (cancelled) return;
        setAdmin(res.admin);
        localStorage.setItem("admin_user", JSON.stringify(res.admin));
        setDirectory(readManagedAdmins());
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) logout();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const isSuperAdmin = isSuperAdminSession(directory, admin);
  const role = resolveRole(isSuperAdmin);
  const loanAccess = resolveLoanAccess(directory, admin, isSuperAdmin);
  const accessibleLoanTypes = loanTypesFor(loanAccess);
  const canAccessLoan = (slug?: string) => loanIsAllowed(loanAccess, slug);

  return (
    <AuthContext.Provider
      value={{
        admin,
        token,
        isLoggedIn: !!token,
        isLoading,
        login,
        logout,
        updateAdmin,
        role,
        isSuperAdmin,
        loanAccess,
        accessibleLoanTypes,
        canAccessLoan,
        refreshAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
