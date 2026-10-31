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

/*
Session keys live in sessionStorage so every tab keeps its own signed-in admin.
With localStorage a second tab overwrote the first tab's session, so refreshing
one tab silently switched it to whichever admin logged in last. The team
directory stays in localStorage because it is shared data, not a session.
*/
const TOKEN_KEY = "admin_token";
const USER_KEY = "admin_user";

/** Move a pre-existing localStorage session into this tab exactly once. */
const migrateLegacySession = (): void => {
  try {
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      const legacyToken = localStorage.getItem(TOKEN_KEY);
      if (legacyToken) {
        sessionStorage.setItem(TOKEN_KEY, legacyToken);
        const legacyUser = localStorage.getItem(USER_KEY);
        if (legacyUser) sessionStorage.setItem(USER_KEY, legacyUser);
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* private mode / storage disabled — the provider keeps working from memory */
  }
};

migrateLegacySession();

const readSession = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeSession = (key: string, value: string): void => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* quota / private mode — the session keeps working from memory */
  }
};

const clearSession = (): void => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
};

const readStoredAdmin = (): ApiAdmin | null => {
  try {
    const stored = readSession(USER_KEY);
    return stored ? (JSON.parse(stored) as ApiAdmin) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<ApiAdmin | null>(readStoredAdmin);
  const [token, setToken] = useState<string | null>(() => readSession(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(() => !!readSession(TOKEN_KEY));
  const [directory, setDirectory] = useState<ManagedAdmin[]>(readManagedAdmins);

  const refreshAccess = useCallback(() => setDirectory(readManagedAdmins()), []);

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
    clearSession();
  }, []);

  const login = useCallback((newToken: string, newAdmin: ApiAdmin) => {
    setToken(newToken);
    setAdmin(newAdmin);
    writeSession(TOKEN_KEY, newToken);
    writeSession(USER_KEY, JSON.stringify(newAdmin));
    // Register a super admin on their first sign-in so the short `admin01`
    // handle keeps working on this device afterwards.
    if (isSuperAdminSession(readManagedAdmins(), newAdmin)) {
      claimSuperAdminRecord(newAdmin);
    }
    setDirectory(readManagedAdmins());
  }, []);

  const updateAdmin = useCallback((updated: ApiAdmin) => {
    setAdmin(updated);
    writeSession(USER_KEY, JSON.stringify(updated));
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
        writeSession(USER_KEY, JSON.stringify(res.admin));
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
