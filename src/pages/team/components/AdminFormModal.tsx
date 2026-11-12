import { useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Loader2, ShieldCheck, X } from "lucide-react";
import { LOAN_TYPES, type LoanTypeSlug } from "../../../constants/loanTypes";
import {
  DEFAULT_SUB_ADMIN_PERMISSIONS,
  appliesToAnyScope,
  filterPermissionsForScopes,
  permissionsForScopes,
  scopeLabels,
  type AdminPermission,
  type PermissionScope,
} from "../../../constants/adminPermissions";
import type { AdminRole, LoanAccess, ManagedAdmin, ModuleAccess, ModuleKey } from "../../../api/adminUsers";

export interface AdminFormValues {
  loginId: string;
  name: string;
  email: string;
  /** New password — only sent when the edit form's password block is used. */
  password: string;
  /** Signed-in super admin's own password; required with `password` on edit. */
  currentPassword?: string;
  role: AdminRole;
  loanAccess: LoanAccess;
  moduleAccess?: ModuleAccess;
  /** Sub-admin capabilities; ignored for every other role. */
  permissions: AdminPermission[];
}

const MODULE_OPTIONS: Array<{ key: ModuleKey; label: string; description: string }> = [
  { key: "customers", label: "Customers", description: "Registered customers list" },
  { key: "franchises", label: "Franchises", description: "Franchises, plans & franchise customers" },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_ID_REGEX = /^[a-z0-9][a-z0-9._-]{2,23}$/i;
const BRAND_GRADIENT = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";

/** Readable token per loan product — used first so the ID stays human-friendly. */
const LOAN_ID_WORDS: Record<LoanTypeSlug, string> = {
  "personal-loan": "personal",
  "business-loan": "business",
  "home-loan": "home",
  "loan-against-property": "property",
  "balance-transfer": "transfer",
  "project-loan": "project",
  "car-loan": "car",
  "education-loan": "education",
  "credit-card": "card",
  "working-capital": "capital",
  "commercial-purchase": "commercial",
  "lease-rental-discounting": "lease",
  "odcc-limit": "odcc",
  "loan-against-share": "share",
  "npa-loan": "npa",
  "gold-loan": "gold",
  "fdi-loan": "fdi",
  "film-funding": "film",
};

/** Short codes — the fallback when the readable names do not fit in 24 chars. */
const LOAN_ID_CODES: Record<LoanTypeSlug, string> = {
  "personal-loan": "pl",
  "business-loan": "bl",
  "home-loan": "hl",
  "loan-against-property": "lap",
  "balance-transfer": "bt",
  "project-loan": "pj",
  "car-loan": "cl",
  "education-loan": "el",
  "credit-card": "cc",
  "working-capital": "wc",
  "commercial-purchase": "cp",
  "lease-rental-discounting": "lrd",
  "odcc-limit": "odcc",
  "loan-against-share": "las",
  "npa-loan": "npa",
  "gold-loan": "gl",
  "fdi-loan": "fdi",
  "film-funding": "ff",
};

/** Every generated handle ends in this, so the role is visible in the ID itself. */
const ID_SUFFIX = "admin";

const MAX_LOGIN_ID = 24;

/**
 * Admin ID that follows the role and the loan products a super admin ticked:
 * `project-admin`, `business-home-admin`, `super-admin`, and short codes only
 * when the readable names would break the 24-char limit (`bl-hl-pj-el-admin`).
 * A taken handle gets a number before the suffix (`project-2-admin`).
 */
const buildAutoLoginId = (
  selected: LoanTypeSlug[],
  modules: ModuleKey[],
  role: AdminRole,
  takenIds: string[]
): string => {
  // A super admin sees every product, so the handle is `super-admin` — never a
  // product list.
  if (role === "super_admin") return withFreeSuffix("super", ID_SUFFIX, takenIds);
  if (role === "sub_admin") return withFreeSuffix("sub", ID_SUFFIX, takenIds);
  // Module access (`customers-admin` / `franchises-admin` / `all-modules-admin`) —
  // loans aur modules dono ek saath bhi assign ho sakte hain, tab ID loan list
  // se banti hai.
  if (selected.length === 0) {
    if (modules.length === MODULE_OPTIONS.length) {
      return withFreeSuffix("all-modules", ID_SUFFIX, takenIds);
    }
    return modules.length === 1 ? withFreeSuffix(modules[0], ID_SUFFIX, takenIds) : "";
  }

  const ordered = LOAN_TYPES.filter((loan) => selected.includes(loan.slug));
  const stems =
    ordered.length === LOAN_TYPES.length
      ? ["all-loans"]
      : [
          ordered.map((loan) => LOAN_ID_WORDS[loan.slug]).join("-"),
          ordered.map((loan) => LOAN_ID_CODES[loan.slug]).join("-"),
          `${ordered.length}-loans`,
        ];

  const stem =
    stems.find((candidate) => `${candidate}-${ID_SUFFIX}`.length <= MAX_LOGIN_ID) ??
    stems[stems.length - 1];

  return withFreeSuffix(stem, ID_SUFFIX, takenIds);
};

/** `stem-admin`, or `stem-2-admin` when another admin already owns the handle. */
const withFreeSuffix = (stem: string, suffix: string, takenIds: string[]): string => {
  const used = new Set(takenIds.filter(Boolean).map((id) => id.trim().toLowerCase()));
  let candidate = `${stem}-${suffix}`;
  for (let n = 2; used.has(candidate.toLowerCase()); n += 1) {
    candidate = `${stem}-${n}-${suffix}`;
  }
  return candidate;
};

const Field = ({
  label, value, onChange, placeholder, type = "text", error, hint, disabled, autoFocus, showToggle = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  showToggle?: boolean;
}) => {
  const [show, setShow] = useState(false);
  const inputType = showToggle && type === "password" ? (show ? "text" : "password") : type;
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 ${
            showToggle ? "pr-10" : ""
          } ${
            disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : "bg-white"
          } ${
            error
              ? "border-red-400 focus:ring-red-200"
              : "border-slate-200 focus:border-[rgb(6,106,156)] focus:ring-[rgba(6,106,156,0.2)]"
          }`}
        />
        {showToggle && type === "password" && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
};

/**
 * Create / edit an admin. In create mode the super admin sets the sign-in handle
 * and password as well as the loan products this admin may work on.
 */
const AdminFormModal = ({
  mode, admin, existing, isSubmitting, onClose, onSubmit,
}: {
  mode: "create" | "edit";
  admin?: ManagedAdmin;
  existing: ManagedAdmin[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: AdminFormValues) => void;
}) => {
  const [loginId, setLoginId] = useState(admin?.loginId ?? "");
  // Create mode starts with an auto ID: it follows the loan products ticked below
  // until the super admin types their own handle.
  const [autoLoginId, setAutoLoginId] = useState(mode === "create");
  const [name, setName] = useState(admin?.name ?? "");
  const [email, setEmail] = useState(admin?.email ?? "");
  const [password, setPassword] = useState("");
  // Edit mode can change the password too, but only after the super admin's own
  // old password is verified by the backend.
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<AdminRole>(admin?.role ?? "admin");
  // Sub admin ke capabilities. Create me khaali; role switch par safe defaults
  // (review loop, final decision nahi) — super admin baad me badal sakta hai.
  const [permissions, setPermissions] = useState<AdminPermission[]>(() =>
    admin?.role === "sub_admin" ? admin.permissions ?? DEFAULT_SUB_ADMIN_PERMISSIONS : []
  );
  // New admins start with nothing assigned — the super admin ticks the products.
  // Editing one who already has every product must show all of them ticked.
  const [selected, setSelected] = useState<LoanTypeSlug[]>(() => {
    if (!admin) return [];
    return admin.loanAccess === "all"
      ? LOAN_TYPES.map((loan) => loan.slug)
      : [...admin.loanAccess];
  });
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>(() => {
    if (!admin || !admin.moduleAccess) return [];
    return admin.moduleAccess === "all" ? MODULE_OPTIONS.map((m) => m.key) : [...admin.moduleAccess];
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Loan products sit behind one compact dropdown, so the modal stays short.
  const [loanMenuOpen, setLoanMenuOpen] = useState(false);

  const isSuperRole = role === "super_admin";
  const isSubRole = role === "sub_admin";
  const allSelected = selected.length === LOAN_TYPES.length;
  const allModulesSelected = selectedModules.length === MODULE_OPTIONS.length;

  const takenIds = existing
    .filter((record) => record.id !== admin?.id)
    .map((record) => record.loginId);

  /*
  Sub admin ko dono areas mil sakte hain — loan products aur Customers /
  Franchises. Isliye dono selections independent hain aur permissions dono ke
  union par valid rehti hain (`loans.decide` sirf loan side par).
  */
  const selectedScopes: PermissionScope[] = [
    ...(selected.length > 0 ? (["loans"] as const) : []),
    ...(selectedModules.length > 0 ? (["modules"] as const) : []),
  ];
  const scopedPermissionDefs = permissionsForScopes(selectedScopes);
  const scopedSelectedCount = scopedPermissionDefs.filter((def) =>
    permissions.includes(def.key)
  ).length;

  /**
   * Tick/untick a loan product. While the ID is still auto, it is regenerated so
   * the handle always matches the current selection.
   */
  const applyLoans = (next: LoanTypeSlug[]) => {
    setSelected(next);
    if (autoLoginId) setLoginId(buildAutoLoginId(next, selectedModules, role, takenIds));
  };

  /** The role is part of the generated handle, so switching it re-generates the ID. */
  const applyRole = (next: AdminRole) => {
    setRole(next);
    if (next === "sub_admin") {
      setPermissions((current) => (current.length > 0 ? current : DEFAULT_SUB_ADMIN_PERMISSIONS));
    }
    if (autoLoginId) setLoginId(buildAutoLoginId(selected, selectedModules, next, takenIds));
  };

  const toggle = (slug: LoanTypeSlug) => {
    applyLoans(
      selected.includes(slug)
        ? selected.filter((entry) => entry !== slug)
        : [...selected, slug]
    );
  };

  /** Typing a custom handle stops the auto ID; clearing the field turns it back on. */
  const changeLoginId = (value: string) => {
    setLoginId(value);
    setAutoLoginId(value.trim() === "");
  };
  /**
   * Module access loan access ke saath bhi chalta hai. Customers aur Franchises
   * dono independently tick hote hain.
   */
  const toggleModule = (key: ModuleKey) => {
    if (isSuperRole) return;
    const nextModules: ModuleKey[] = selectedModules.includes(key)
      ? selectedModules.filter((entry) => entry !== key)
      : [...selectedModules, key];
    setSelectedModules(nextModules);
    if (autoLoginId) setLoginId(buildAutoLoginId(selected, nextModules, role, takenIds));
  };

  const togglePermission = (key: AdminPermission) => {
    setPermissions((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const handle = loginId.trim().toLowerCase();
    const mail = email.trim().toLowerCase();

    if (!LOGIN_ID_REGEX.test(handle)) {
      next.loginId = "3–24 characters, letters, numbers, dot, dash or underscore.";
    } else if (
      existing.some(
        (record) => record.loginId.toLowerCase() === handle && record.id !== admin?.id
      )
    ) {
      next.loginId = "This admin ID is already taken.";
    }

    if (name.trim().length < 2) next.name = "Enter the admin's name.";
    if (!EMAIL_REGEX.test(mail)) next.email = "Enter a valid email address.";
    else if (
      existing.some((record) => record.email.toLowerCase() === mail && record.id !== admin?.id)
    ) {
      next.email = "An admin with this email already exists.";
    }

    if (mode === "create" && password.length < 6) {
      next.password = "Use at least 6 characters.";
    }

    if (mode === "edit") {
      const wantsNewPassword = Boolean(currentPassword || password || confirmPassword);
      if (wantsNewPassword) {
        if (!currentPassword) {
          next.currentPassword = "Enter your current password to confirm the change.";
        }
        if (password.length < 6) {
          next.password = "Use at least 6 characters.";
        }
        if (confirmPassword !== password) {
          next.confirmPassword = "Both passwords must match.";
        }
      }
    }

    if (!isSuperRole && selected.length === 0 && selectedModules.length === 0) {
      next.access = "Kam se kam ek loan product ya module (Customers / Franchises) chuno.";
    }

    if (isSubRole) {
      if (selectedScopes.length === 0) {
        next.access = next.access || "Sub admin ke liye pehle loan product ya module assign karo.";
      } else if (!permissions.some((key) => appliesToAnyScope(key, selectedScopes))) {
        next.permissions = "Kam se kam ek permission chuno jo selected area par lagti ho.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (isSubmitting || !validate()) return;
    onSubmit({
      loginId: loginId.trim().toLowerCase(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      ...(mode === "edit" ? { currentPassword } : {}),
      role,
      loanAccess: isSuperRole || allSelected ? "all" : selected,
      moduleAccess: isSuperRole || allModulesSelected ? "all" : selectedModules,
      permissions: isSubRole ? filterPermissionsForScopes(permissions, selectedScopes) : [],
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1.5" style={{ background: BRAND_GRADIENT }} />
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {mode === "create" ? "Create admin login" : `Edit ${admin?.name ?? "admin"}`}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {mode === "create"
                ? "Pick the loan products and modules first — the admin ID and sign-in details follow."
                : "Update the details and the loan products and modules this admin can access."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Access: loan products aur modules dono ek saath assign ho sakte hain */}
        <div className="px-6 pt-5">
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            Loan products aur Customers / Franchises — dono ek saath assign kar sakte hain. Jo tick
            karo, sirf wahi access milta hai. Sub admin ke liye permissions neeche dikhti hain.
          </p>
          {errors.access && <p className="mt-1.5 text-xs text-red-600">{errors.access}</p>}
        </div>

        {/* Loan assignment — one compact dropdown instead of the tall grid */}
        <div className="px-6 pb-4 pt-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">Loan products</p>
            <p className="text-[11px] font-medium text-slate-400">
              {isSuperRole
                ? `All ${LOAN_TYPES.length} products`
                : `${selected.length} of ${LOAN_TYPES.length} selected`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setLoanMenuOpen((open) => !open)}
            disabled={isSuperRole}
            aria-expanded={loanMenuOpen}
            className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[rgba(6,106,156,0.2)] ${
              isSuperRole
                ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span
              className={`min-w-0 flex-1 truncate ${
                isSuperRole || selected.length === 0 ? "text-slate-400" : "font-medium text-slate-700"
              }`}
            >
              {isSuperRole
                ? "Every product is included"
                : selected.length === 0
                    ? "Select loan products"
                    : LOAN_TYPES.filter((loan) => selected.includes(loan.slug))
                        .map((loan) => loan.label)
                        .join(", ")}
            </span>
            {!isSuperRole && (
              <ChevronDown
                size={16}
                className={`shrink-0 text-slate-400 transition ${loanMenuOpen ? "rotate-180" : ""}`}
              />
            )}
          </button>

          {loanMenuOpen && !isSuperRole && (
            <div className="mt-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold text-slate-400">
                  {selected.length} of {LOAN_TYPES.length} selected
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => applyLoans(LOAN_TYPES.map((loan) => loan.slug))}
                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-[rgb(6,106,156)] transition hover:bg-[rgba(6,106,156,0.08)]"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => applyLoans([])}
                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="scrollbar-hidden grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
                {LOAN_TYPES.map((loan) => {
                  const checked = selected.includes(loan.slug);
                  return (
                    <button
                      key={loan.slug}
                      type="button"
                      onClick={() => toggle(loan.slug)}
                      aria-pressed={checked}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition ${
                        checked
                          ? "border-[rgba(6,106,156,0.35)] bg-[rgba(6,106,156,0.05)] text-slate-800"
                          : "border-transparent text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked ? "border-transparent text-white" : "border-slate-300 bg-white"
                        }`}
                        style={checked ? { background: BRAND_GRADIENT } : undefined}
                      >
                        {checked && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="truncate">{loan.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Module assignment — dono modules ek saath select ho sakte hain */}
        <div className="px-6 pb-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">Customers &amp; Franchises</p>
            <p className="text-[11px] font-medium text-slate-400">
              {isSuperRole ? "All modules" : `${selectedModules.length} of ${MODULE_OPTIONS.length} selected`}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MODULE_OPTIONS.map((mod) => {
              const checked = isSuperRole || selectedModules.includes(mod.key);
              return (
                <button
                  key={mod.key}
                  type="button"
                  onClick={() => toggleModule(mod.key)}
                  disabled={isSuperRole}
                  aria-pressed={checked}
                  title={mod.description}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    checked
                      ? "border-[rgba(6,106,156,0.35)] bg-[rgba(6,106,156,0.06)] text-[rgb(6,106,156)]"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  } ${isSuperRole ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? "border-transparent text-white" : "border-slate-300 bg-white"
                    }`}
                    style={checked ? { background: BRAND_GRADIENT } : undefined}
                  >
                    {checked && <Check size={11} strokeWidth={3} />}
                  </span>
                  {mod.label}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "create" && (
          <div className="px-6 pb-1">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Role</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                { value: "admin", title: "Admin", desc: "Only the loans you assign" },
                { value: "sub_admin", title: "Sub admin", desc: "Supervises admins, permission ke andar" },
                { value: "super_admin", title: "Super admin", desc: "Every loan + team management" },
              ] as const).map((option) => {
                const active = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => applyRole(option.value)}
                    className={`rounded-xl border px-3.5 py-2.5 text-left transition ${
                      active
                        ? "border-[rgb(6,106,156)] bg-[rgba(6,106,156,0.06)] ring-1 ring-[rgba(6,106,156,0.25)]"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                      {option.value === "super_admin" && <ShieldCheck size={14} className="text-[rgb(6,106,156)]" />}
                      {option.value === "sub_admin" && <ShieldCheck size={14} className="text-sky-600" />}
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{option.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sub-admin capabilities — sirf tab dikhte hain jab role sub admin ho */}
        {isSubRole && (
          <div className="px-6 pb-1">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">Supervision permissions</p>
              <p className="text-[11px] font-medium text-slate-400">
                {selectedScopes.length > 0
                  ? `${scopedSelectedCount} of ${scopedPermissionDefs.length} · ${scopeLabels(selectedScopes)}`
                  : "Area chuno"}
              </p>
            </div>
            {selectedScopes.length > 0 ? (
              <>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Areas:{" "}
                  <span className="font-semibold text-slate-600">
                    {scopeLabels(selectedScopes)}
                  </span>{" "}
                  — ye permissions in areas ke admin kaam par lagti hain. Area hataane par sirf
                  wahan lagne wali permissions bachti hain.
                </p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {scopedPermissionDefs.map((permission) => {
                const checked = permissions.includes(permission.key);
                return (
                  <button
                    key={permission.key}
                    type="button"
                    onClick={() => togglePermission(permission.key)}
                    aria-pressed={checked}
                    title={permission.description}
                    className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition ${
                      checked
                        ? "border-[rgba(6,106,156,0.35)] bg-[rgba(6,106,156,0.05)] text-slate-800"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked ? "border-transparent text-white" : "border-slate-300 bg-white"
                      }`}
                      style={checked ? { background: BRAND_GRADIENT } : undefined}
                    >
                      {checked && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{permission.label}</span>
                      <span className="block text-[10px] font-normal leading-snug text-slate-400">
                        {permission.description}
                      </span>
                    </span>
                  </button>
                );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                Pehle upar se <span className="font-semibold">loan products</span> ya{" "}
                <span className="font-semibold">modules</span> tick karo. Uske baad applicable
                permissions yahan dikhengi.
              </p>
            )}
            {errors.permissions && (
              <p className="mt-1.5 text-xs text-red-600">{errors.permissions}</p>
            )}
          </div>
        )}

        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <Field
            label="Admin ID"
            value={loginId}
            onChange={changeLoginId}
            placeholder="project-admin"
            error={errors.loginId}
            hint={
              mode === "create" && autoLoginId
                ? "Auto-generated from the role and loan products — ends with admin or super-admin. You can still edit it."
                : "Sign-in handle — the admin can log in with this or the email."
            }
            disabled={mode === "edit"}
            autoFocus={mode === "create"}
          />
          <Field label="Full name" value={name} onChange={setName} placeholder="Riya Sharma" error={errors.name} />
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="admin02@indexiafinance.com"
            error={errors.email}
          />
          {mode === "create" ? (
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••"
              error={errors.password}
              hint="Minimum 6 characters. Share it with the admin securely."
              showToggle
            />
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Role</label>
              <select
                value={role}
                onChange={(event) => applyRole(event.target.value as AdminRole)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-[rgb(6,106,156)] focus:outline-none focus:ring-2 focus:ring-[rgba(6,106,156,0.2)]"
              >
                <option value="admin">Admin — only the assigned loans</option>
                <option value="sub_admin">Sub admin — supervises admins within permissions</option>
                <option value="super_admin">Super admin — everything + team management</option>
              </select>
            </div>
          )}
        </div>

        {/* Change password (edit only) — the super admin's own old password
            is required before the new one is saved. */}
        {mode === "edit" && (
          <div className="px-6 pb-1">
            <p className="text-sm font-semibold text-slate-700">Change password (optional)</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Leave all three blank to keep {admin?.loginId}&apos;s current password.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field
                label="Your current password"
                type="password"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="••••••"
                error={errors.currentPassword}
                hint="Your (super admin) password — required to set a new one."
                showToggle
              />
              <Field
                label="New password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••"
                error={errors.password}
                hint="Minimum 6 characters."
                showToggle
              />
              <Field
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="••••••"
                error={errors.confirmPassword}
                showToggle
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
            style={{ background: BRAND_GRADIENT }}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {mode === "create" ? "Create admin" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminFormModal;
