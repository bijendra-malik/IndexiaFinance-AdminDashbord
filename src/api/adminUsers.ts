import axiosInstance from "./axiosInstance";
import type { LoanTypeSlug } from "../constants/loanTypes";

/**
 * Admin accounts managed by a super admin.
 *
 * The account list itself is backend data (`/admins`); the *loan access* a super
 * admin assigns is kept in a local access map keyed by email, so a restriction
 * still applies even while the backend has no field to store it. See
 * `docs/BACKEND_API.md` §1.1 for the contract the client calls.
 */

export type AdminRole = "super_admin" | "admin";

/** `"all"` means every loan product; otherwise the explicit allowed slugs. */
export type LoanAccess = "all" | LoanTypeSlug[];

export type DirectoryMode = "backend" | "local";

export interface ManagedAdmin {
  id: string;
  /** Sign-in handle, e.g. `admin01`. Accepted by the login form. */
  loginId: string;
  name: string;
  /** Backend login email — the only credential the API accepts. */
  email: string;
  role: AdminRole;
  loanAccess: LoanAccess;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
  /** Where this row is stored: the backend, or this browser. */
  storage: DirectoryMode;
}

export interface CreateAdminInput {
  loginId: string;
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  loanAccess: LoanAccess;
}

export interface ListAdminsResult {
  admins: ManagedAdmin[];
  mode: DirectoryMode;
  /** Set when the backend admin endpoints are not available yet. */
  warning?: string;
}

// ── Local storage keys ───────────────────────────────────────────────────────

const RECORDS_KEY = "loan_admin_team_v1";
const ACCESS_KEY = "loan_admin_access_v1";

interface AccessOverride {
  loginId?: string;
  name?: string;
  role: AdminRole;
  loanAccess: LoanAccess;
  updatedAt: string;
}

const isLoanAccess = (value: unknown): value is LoanAccess =>
  value === "all" || Array.isArray(value);

const normalizeRole = (value: unknown): AdminRole =>
  typeof value === "string" && /super/i.test(value) ? "super_admin" : "admin";

const newId = (): string => {
  try {
    return `local_${crypto.randomUUID()}`;
  } catch {
    return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
};

// ── Local records ────────────────────────────────────────────────────────────

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — the session keeps working from memory */
  }
};

const toManaged = (raw: unknown, storage: DirectoryMode): ManagedAdmin | null => {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const email = typeof value.email === "string" ? value.email : "";
  const loginId =
    (typeof value.loginId === "string" && value.loginId) ||
    (typeof value.username === "string" && value.username) ||
    (email.includes("@") ? email.split("@")[0] : email);
  const id = String(value._id ?? value.id ?? "");
  if (!id || !email) return null;
  const access = value.loanAccess ?? value.loans;
  return {
    id,
    loginId,
    name: typeof value.name === "string" && value.name ? value.name : loginId,
    email,
    role: normalizeRole(value.role),
    loanAccess: isLoanAccess(access) ? access : "all",
    isActive: value.isActive !== false,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    lastLogin: typeof value.lastLogin === "string" ? value.lastLogin : null,
    storage,
  };
};

const readLocalRecords = (): ManagedAdmin[] => {
  const rows = readJson<unknown[]>(RECORDS_KEY, []);
  return rows
    .map((row) => toManaged(row, "local"))
    .filter((row): row is ManagedAdmin => row !== null);
};

const writeLocalRecords = (records: ManagedAdmin[]): void => writeJson(RECORDS_KEY, records);

// ── Access map (works for backend and local accounts alike) ──────────────────

const readOverrides = (): Record<string, AccessOverride> => {
  const raw = readJson<Record<string, AccessOverride>>(ACCESS_KEY, {});
  return raw && typeof raw === "object" ? raw : {};
};

const accessKey = (email: string): string => email.trim().toLowerCase();

const applyOverride = (admin: ManagedAdmin): ManagedAdmin => {
  const override = readOverrides()[accessKey(admin.email)];
  if (!override) return admin;
  return {
    ...admin,
    loginId: override.loginId || admin.loginId,
    name: override.name || admin.name,
    role: override.role ?? admin.role,
    loanAccess: override.loanAccess ?? admin.loanAccess,
  };
};

/**
 * Persist the role + loan access a super admin assigned. Stored by email so it
 * also applies to an account that only exists on the backend.
 */
export const rememberAdminAccess = (admin: {
  email: string;
  loginId?: string;
  name?: string;
  role: AdminRole;
  loanAccess: LoanAccess;
}): void => {
  const email = accessKey(admin.email);
  if (!email) return;
  const overrides = readOverrides();
  overrides[email] = {
    loginId: admin.loginId,
    name: admin.name,
    role: admin.role,
    loanAccess: admin.loanAccess,
    updatedAt: new Date().toISOString(),
  };
  writeJson(ACCESS_KEY, overrides);
};

/**
 * Register the signed-in super admin in the team directory. Without this the
 * default super admin (`admin01`) would have no table row, and the role would be
 * lost as soon as another admin exists.
 */
export const claimSuperAdminRecord = (admin: {
  email?: string;
  name?: string;
  loginId?: string;
}): void => {
  const email = accessKey(admin.email ?? "");
  if (!email) return;
  const loginId = admin.loginId?.trim() || email.split("@")[0];
  rememberAdminAccess({ email, loginId, name: admin.name, role: "super_admin", loanAccess: "all" });

  const records = readLocalRecords();
  if (records.some((record) => accessKey(record.email) === email)) return;
  writeLocalRecords([
    ...records,
    {
      id: newId(),
      loginId,
      name: admin.name?.trim() || loginId,
      email,
      role: "super_admin",
      loanAccess: "all",
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      storage: "local",
    },
  ]);
};

/** Drop the stored role/loan access for an account (used when it is deleted). */
export const forgetAdminAccess = (email: string): void => {
  const overrides = readOverrides();
  const key = accessKey(email);
  if (!(key in overrides)) return;
  delete overrides[key];
  writeJson(ACCESS_KEY, overrides);
};

// ── Synchronous directory (used while signing in) ────────────────────────────

/**
 * Everything this browser knows about admin access: local account records plus
 * access entries for backend accounts that a super admin has edited. The auth
 * provider resolves the signed-in admin against this list, so restrictions apply
 * immediately without waiting for a network round-trip.
 */
export const readManagedAdmins = (): ManagedAdmin[] => {
  const records = readLocalRecords().map(applyOverride);
  const seen = new Set(records.map((record) => accessKey(record.email)));
  const overrides = readOverrides();
  const extra: ManagedAdmin[] = Object.keys(overrides)
    .filter((email) => !seen.has(email))
    .map((email) => {
      const override = overrides[email];
      return {
        id: `access:${email}`,
        loginId: override.loginId || email.split("@")[0],
        name: override.name || email,
        email,
        role: override.role ?? "admin",
        loanAccess: override.loanAccess ?? "all",
        isActive: true,
        createdAt: override.updatedAt ?? "",
        lastLogin: null,
        storage: "local" as const,
      };
    });
  return [...records, ...extra];
};

// ── Backend transport ────────────────────────────────────────────────────────

/** The backend has no admin-management routes yet (404/405/501 or no server). */
const isMissingEndpoint = (error: unknown): boolean => {
  const response = (error as { response?: { status?: number } })?.response;
  if (!response) return true;
  return [404, 405, 501].includes(response.status ?? 0);
};

const isAuthError = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
};

const backendMessage = (error: unknown): string => {
  const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message ?? "";
};

const pickArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  const record = payload as Record<string, unknown> | null;
  for (const key of ["admins", "data", "users"]) {
    const value = record?.[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const pickAdmin = (payload: unknown): unknown => {
  const record = payload as Record<string, unknown> | null;
  return record?.admin ?? record?.data ?? payload;
};

const toBackendPayload = (input: Partial<CreateAdminInput>): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (input.loginId !== undefined) payload.loginId = input.loginId;
  if (input.name !== undefined) payload.name = input.name;
  if (input.email !== undefined) payload.email = input.email;
  if (input.password !== undefined) payload.password = input.password;
  if (input.role !== undefined) payload.role = input.role;
  if (input.loanAccess !== undefined) payload.loanAccess = input.loanAccess;
  return payload;
};

export const listManagedAdmins = async (): Promise<ListAdminsResult> => {
  try {
    const response = await axiosInstance.get("/admins");
    const rows = pickArray(response.data?.admins ?? response.data);
    const admins = rows
      .map((row) => toManaged(row, "backend"))
      .filter((row): row is ManagedAdmin => row !== null)
      .map(applyOverride);
    return { admins, mode: "backend" };
  } catch (error) {
    if (isAuthError(error) || !isMissingEndpoint(error)) throw error;
    return {
      admins: readLocalRecords().map(applyOverride),
      mode: "local",
      warning: backendMessage(error),
    };
  }
};

export const createManagedAdmin = async (
  input: CreateAdminInput
): Promise<ManagedAdmin> => {
  try {
    const response = await axiosInstance.post("/admins", toBackendPayload(input));
    const parsed = toManaged(pickAdmin(response.data), "backend");
    if (!parsed) throw new Error("The backend created the admin but returned no record.");
    rememberAdminAccess(parsed);
    return parsed;
  } catch (error) {
    if (isAuthError(error) || !isMissingEndpoint(error)) throw error;
    const record: ManagedAdmin = {
      id: newId(),
      loginId: input.loginId,
      name: input.name,
      email: input.email,
      role: input.role,
      loanAccess: input.loanAccess,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      storage: "local",
    };
    writeLocalRecords([...readLocalRecords(), record]);
    rememberAdminAccess(record);
    return record;
  }
};

export const updateManagedAdmin = async (
  id: string,
  patch: { name?: string; email?: string; role?: AdminRole; loanAccess?: LoanAccess }
): Promise<ManagedAdmin> => {
  const localRecords = readLocalRecords();
  const local = localRecords.find((record) => record.id === id);

  if (local) {
    const next: ManagedAdmin = { ...local, ...patch };
    writeLocalRecords(localRecords.map((record) => (record.id === id ? next : record)));
    rememberAdminAccess(next);
    return next;
  }

  const response = await axiosInstance.patch(`/admins/${encodeURIComponent(id)}`, patch);
  const parsed = toManaged(pickAdmin(response.data), "backend");
  if (!parsed) throw new Error("The backend updated the admin but returned no record.");
  rememberAdminAccess(parsed);
  return parsed;
};

/**
 * Set a new password for an admin. `currentPassword` is the **signed-in super
 * admin's own password** — the backend verifies it before the new one is saved.
 */
export const resetManagedAdminPassword = async (
  id: string,
  password: string,
  currentPassword: string
): Promise<void> => {
  await axiosInstance.put(`/admins/${encodeURIComponent(id)}/password`, {
    password,
    currentPassword,
  });
};;

export const deleteManagedAdmin = async (id: string): Promise<void> => {
  const localRecords = readLocalRecords();
  const local = localRecords.find((record) => record.id === id);

  if (local) {
    writeLocalRecords(localRecords.filter((record) => record.id !== id));
    forgetAdminAccess(local.email);
    return;
  }

  await axiosInstance.delete(`/admins/${encodeURIComponent(id)}`);
};
