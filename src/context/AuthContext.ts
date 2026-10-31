import { createContext, useContext } from "react";
import type { ApiAdmin } from "../api/auth";
import type { AdminRole, LoanAccess } from "../api/adminUsers";
import type { LoanTypeDef } from "../constants/loanTypes";

export interface AuthContextType {
  admin: ApiAdmin | null;
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (token: string, admin: ApiAdmin) => void;
  logout: () => void;
  updateAdmin: (admin: ApiAdmin) => void;

  /** Effective role for this session: backend role + team directory. */
  role: AdminRole;
  isSuperAdmin: boolean;
  /** `"all"` or the loan slugs a super admin assigned to this account. */
  loanAccess: LoanAccess;
  accessibleLoanTypes: LoanTypeDef[];
  canAccessLoan: (slug?: string) => boolean;
  /** Re-read the team directory (call after a super admin saves access). */
  refreshAccess: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
