import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff, Loader2, ShieldCheck, Sparkles, UserCog, X } from "lucide-react";
import { LOAN_TYPES, type LoanTypeSlug } from "../../../constants/loanTypes";
import {
  DEFAULT_SUB_ADMIN_PERMISSIONS,
  appliesToAnyScope,
  filterPermissionsForScopes,
  matchPermissionPreset,
  PERMISSION_PRESETS,
  permissionsForScopes,
  presetPermissionsFor,
  scopeLabels,
  type AdminPermission,
  type PermissionPresetKey,
  type PermissionScope,
} from "../../../constants/adminPermissions";
import { accessSummary, roleLabel } from "../../../utils/accessSummary";
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

/* ---------------------------------------------------------------- wizard steps */

type StepKey = "role" | "scope" | "permissions" | "details";

const STEP_TITLE: Record<StepKey, string> = {
  role: "Role",
  scope: "Scope",
  permissions: "Permissions",
  details: "Login details",
};

/**
 * Role pehle — kyunki role hi decide karta hai ki aage kaunse step relevant
 * hain. Super admin ko scope/permissions poochhna hi nahi; normal admin ko
 * permissions dikhana galat hai.
 */
const stepsForRole = (role: AdminRole): StepKey[] =>
  role === "super_admin"
    ? ["role", "details"]
    : role === "sub_admin"
      ? ["role", "scope", "permissions", "details"]
      : ["role", "scope", "details"];

const ROLE_CARDS: Array<{ value: AdminRole; title: string; desc: string }> = [
  {
    value: "admin",
    title: "Normal admin",
    desc: "Works on the assigned products — notes, verification and recommendations. Cannot record the final decision.",
  },
  {
    value: "sub_admin",
    title: "Sub admin",
    desc: "Reviews normal admins' work — limited to the permissions you grant.",
  },
  {
    value: "super_admin",
    title: "Super admin",
    desc: "Everything — all products, modules, the review queue and team management.",
  },
];

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
  if (role === "super_admin") return withFreeSuffix("super", ID_SUFFIX, takenIds);
  if (role === "sub_admin") return withFreeSuffix("sub", ID_SUFFIX, takenIds);
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

/* ---------------------------------------------------------------------- fields */

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

const CheckBox = ({ checked }: { checked: boolean }) => (
  <span
    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
      checked ? "border-transparent text-white" : "border-slate-300 bg-white"
    }`}
    style={checked ? { background: BRAND_GRADIENT } : undefined}
  >
    {checked && <Check size={11} strokeWidth={3} />}
  </span>
);

/**
 * Create / edit an admin, role-first.
 *
 * Step 1 Role → Step 2 Scope → Step 3 Permissions (sirf sub admin) → Step 4
 * Login + summary. Har step ke neeche ek plain sentence dikhti hai ("ye admin
 * kya karega"), isliye super admin ko tick-boxes ka matlab yaad rakhne ki
 * zaroorat nahi padti.
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
  const [role, setRole] = useState<AdminRole>(admin?.role ?? "admin");
  const [stepKey, setStepKey] = useState<StepKey>("role");

  const [loginId, setLoginId] = useState(admin?.loginId ?? "");
  // Create mode starts with an auto ID: it follows the role and scope ticked
  // above until the super admin types their own handle.
  const [autoLoginId, setAutoLoginId] = useState(mode === "create");
  const [name, setName] = useState(admin?.name ?? "");
  const [email, setEmail] = useState(admin?.email ?? "");
  const [password, setPassword] = useState("");
  // Edit mode can change the password too, but only after the super admin's own
  // old password is verified by the backend.
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Sub admin ke capabilities. Create me safe defaults (review loop, final
  // decision nahi) — super admin preset badal sakta hai.
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
  // Loan products sit behind one compact dropdown, so the step stays short.
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
  const activePreset = matchPermissionPreset(permissions, selectedScopes);
  const [customOpen, setCustomOpen] = useState(activePreset === "custom");

  const steps = stepsForRole(role);
  const activeStep = steps.includes(stepKey) ? stepKey : steps[0];
  const activeIndex = steps.indexOf(activeStep);
  const isLastStep = activeIndex === steps.length - 1;

  /** Live access: "all" once everything is ticked, warna explicit list. */
  const loanAccess: LoanAccess = isSuperRole || allSelected ? "all" : selected;
  const moduleAccess: ModuleAccess = isSuperRole || allModulesSelected ? "all" : selectedModules;
  const summary = accessSummary({
    role,
    loanAccess,
    moduleAccess,
    permissions: isSubRole ? filterPermissionsForScopes(permissions, selectedScopes) : [],
  });

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
    // Role badalne se steps badal jaate hain — us step par ruko jo ab bhi hai.
    if (!stepsForRole(next).includes(activeStep)) setStepKey(next === "super_admin" ? "role" : "scope");
    setErrors({});
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

  const applyPreset = (preset: PermissionPresetKey) => {
    setPermissions(presetPermissionsFor(preset, selectedScopes));
    setCustomOpen(false);
    setErrors({});
  };

  /* --------------------------------------------------------------- validation */

  const validateScope = (): boolean => {
    if (isSuperRole) return true;
    if (selected.length === 0 && selectedModules.length === 0) {
      setErrors({
        access: "Pick at least one loan product or module (Customers / Franchises).",
      });
      return false;
    }
    setErrors({});
    return true;
  };

  const validatePermissions = (): boolean => {
    if (!isSubRole) return true;
    if (selectedScopes.length === 0) {
      setErrors({ permissions: "Assign at least one loan product or module to the sub admin first." });
      return false;
    }
    if (!permissions.some((key) => appliesToAnyScope(key, selectedScopes))) {
      setErrors({ permissions: "Pick at least one permission that applies to the selected area." });
      return false;
    }
    setErrors({});
    return true;
  };

  const validateDetails = (): boolean => {
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

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep = (key: StepKey): boolean => {
    if (key === "scope") return validateScope();
    if (key === "permissions") return validatePermissions();
    if (key === "details") return validateDetails();
    setErrors({});
    return true;
  };

  const goNext = () => {
    if (!validateStep(activeStep)) return;
    setStepKey(steps[Math.min(activeIndex + 1, steps.length - 1)]);
  };

  const goBack = () => {
    if (activeIndex === 0) return;
    setErrors({});
    setStepKey(steps[activeIndex - 1]);
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    // Har validator ek hi baar chalta hai; jo pehle fail ho usi step par le jao.
    const failing: StepKey | null = !validateScope()
      ? "scope"
      : !validatePermissions()
        ? "permissions"
        : !validateDetails()
          ? "details"
          : null;
    if (failing) {
      setStepKey(failing);
      return;
    }
    onSubmit({
      loginId: loginId.trim().toLowerCase(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      ...(mode === "edit" ? { currentPassword } : {}),
      role,
      loanAccess,
      moduleAccess,
      permissions: isSubRole ? filterPermissionsForScopes(permissions, selectedScopes) : [],
    });
  };

  /* ------------------------------------------------------------------ render */

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

        {/* Header + stepper */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {mode === "create" ? "Create admin login" : `Edit ${admin?.name ?? "admin"}`}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {mode === "create"
                ? "A few short steps — role, scope, permissions, then login details."
                : "Update the role, scope and permissions — login details are in the last step."}
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

        <div className="px-6 pt-4">
          <ol className="flex flex-wrap items-center gap-1.5">
            {steps.map((key, index) => {
              const done = index < activeIndex;
              const current = index === activeIndex;
              return (
                <li key={key} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (index <= activeIndex) setStepKey(key);
                    }}
                    aria-current={current ? "step" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      current
                        ? "text-white"
                        : done
                          ? "bg-[rgba(6,106,156,0.08)] text-[rgb(6,106,156)]"
                          : "bg-slate-100 text-slate-400"
                    }`}
                    style={current ? { background: BRAND_GRADIENT } : undefined}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                        current ? "bg-white/25 text-white" : done ? "bg-white text-[rgb(6,106,156)]" : "bg-white/70 text-slate-400"
                      }`}
                    >
                      {done ? <Check size={9} strokeWidth={4} /> : index + 1}
                    </span>
                    {STEP_TITLE[key]}
                  </button>
                  {index < steps.length - 1 && <span className="text-slate-300">›</span>}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="px-6 py-5">
          {/* ------------------------------------------------ Step 1: role */}
          {activeStep === "role" && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-500">
                Pick the role first — only the questions that matter for that role are asked after
                this.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {ROLE_CARDS.map((option) => {
                  const active = role === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => applyRole(option.value)}
                      aria-pressed={active}
                      className={`rounded-xl border px-3.5 py-3 text-left transition ${
                        active
                          ? "border-[rgb(6,106,156)] bg-[rgba(6,106,156,0.06)] ring-1 ring-[rgba(6,106,156,0.25)]"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                        {option.value === "super_admin" ? (
                          <ShieldCheck size={14} className="text-amber-600" />
                        ) : option.value === "sub_admin" ? (
                          <UserCog size={14} className="text-sky-600" />
                        ) : (
                          <Eye size={14} className="text-slate-400" />
                        )}
                        {option.title}
                      </span>
                      <span className="mt-1 block text-[11px] leading-snug text-slate-500">
                        {option.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ------------------------------------------------ Step 2: scope */}
          {activeStep === "scope" && (
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">Loan products</p>
                  <p className="text-[11px] font-medium text-slate-400">
                    {selected.length} of {LOAN_TYPES.length} selected
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setLoanMenuOpen((open) => !open)}
                  aria-expanded={loanMenuOpen}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[rgba(6,106,156,0.2)]"
                >
                  <span
                    className={`min-w-0 flex-1 truncate ${
                      selected.length === 0 ? "text-slate-400" : "font-medium text-slate-700"
                    }`}
                  >
                    {selected.length === 0
                      ? "Select loan products"
                      : LOAN_TYPES.filter((loan) => selected.includes(loan.slug))
                          .map((loan) => loan.label)
                          .join(", ")}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 transition ${loanMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {loanMenuOpen && (
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
                            <CheckBox checked={checked} />
                            <span className="truncate">{loan.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">Customers &amp; Franchises</p>
                  <p className="text-[11px] font-medium text-slate-400">
                    {selectedModules.length} of {MODULE_OPTIONS.length} selected
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MODULE_OPTIONS.map((mod) => {
                    const checked = selectedModules.includes(mod.key);
                    return (
                      <button
                        key={mod.key}
                        type="button"
                        onClick={() => toggleModule(mod.key)}
                        aria-pressed={checked}
                        title={mod.description}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          checked
                            ? "border-[rgba(6,106,156,0.35)] bg-[rgba(6,106,156,0.06)] text-[rgb(6,106,156)]"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <CheckBox checked={checked} />
                        {mod.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  Products and modules can be assigned together. Only the ticked products and
                  modules appear for this admin — the rest of the app stays hidden.
                </p>
              </div>

              {errors.access && <p className="text-xs text-red-600">{errors.access}</p>}

            </div>
          )}

          {/* ------------------------------------------ Step 3: permissions */}
          {activeStep === "permissions" && (
            <div className="space-y-3">
              {selectedScopes.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                  Tick <span className="font-semibold">loan products</span> or{" "}
                  <span className="font-semibold">modules</span> in the previous step first. The
                  applicable permissions appear here after that.
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    Areas:{" "}
                    <span className="font-semibold text-slate-600">{scopeLabels(selectedScopes)}</span>{" "}
                    — these permissions apply to normal admins working in these areas.
                  </p>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        { key: "view" as const, icon: Eye },
                        { key: "review" as const, icon: UserCog },
                        { key: "manage" as const, icon: ShieldCheck },
                      ]
                    ).map(({ key, icon: Icon }) => {
                      const preset = PERMISSION_PRESETS.find((entry) => entry.key === key);
                      if (!preset) return null;
                      const active = activePreset === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyPreset(key)}
                          aria-pressed={active}
                          className={`rounded-xl border px-3 py-2.5 text-left transition ${
                            active
                              ? "border-[rgb(6,106,156)] bg-[rgba(6,106,156,0.06)] ring-1 ring-[rgba(6,106,156,0.25)]"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <Icon size={13} className="text-[rgb(6,106,156)]" />
                            {preset.label}
                          </span>
                          <span className="mt-1 block text-[11px] leading-snug text-slate-500">
                            {preset.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCustomOpen((open) => !open)}
                    aria-expanded={customOpen}
                    className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-[11px] font-semibold text-slate-500 transition hover:text-[rgb(6,106,156)]"
                  >
                    <span>
                      Fine-tune permissions
                      {activePreset === "custom" && (
                        <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                          Custom
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`transition ${customOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {customOpen && (
                    <div className="grid gap-1.5 sm:grid-cols-2">
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
                            <span className="mt-0.5">
                              <CheckBox checked={checked} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold">
                                {permission.label}
                              </span>
                              <span className="block text-[10px] font-normal leading-snug text-slate-400">
                                {permission.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400">
                    {scopedSelectedCount} of {scopedPermissionDefs.length} permissions granted
                    {activePreset !== "custom" && " — selected by preset."}
                  </p>
                </>
              )}
              {errors.permissions && (
                <p className="text-xs text-red-600">{errors.permissions}</p>
              )}
            </div>
          )}

          {/* ---------------------------------------------- Step 4: details */}
          {activeStep === "details" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Admin ID"
                  value={loginId}
                  onChange={changeLoginId}
                  placeholder="project-admin"
                  error={errors.loginId}
                  hint={
                    mode === "create" && autoLoginId
                      ? "Auto-generated from the role and scope — you can still edit it."
                      : "Sign-in handle — the admin can log in with this or the email."
                  }
                  disabled={mode === "edit"}
                  autoFocus={mode === "create"}
                />
                <Field
                  label="Full name"
                  value={name}
                  onChange={setName}
                  placeholder="Riya Sharma"
                  error={errors.name}
                />
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="admin02@indexiafinance.com"
                  error={errors.email}
                />
                {mode === "create" && (
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
                )}
              </div>

              {mode === "edit" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-sm font-semibold text-slate-700">Change password (optional)</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Leave all three blank to keep {admin?.loginId}&apos;s current password.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
            </div>
          )}
        </div>

        {/* Plain-language summary — har step par, taaki result hamesha saamne ho */}
        <div className="mx-6 mb-4 flex items-start gap-2 rounded-xl border border-[rgba(6,106,156,0.18)] bg-[rgba(6,106,156,0.04)] px-3.5 py-2.5">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-[rgb(6,106,156)]" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[rgb(6,106,156)]">
              {roleLabel(role)} — what this admin can do
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{summary}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={activeIndex === 0 ? onClose : goBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            {activeIndex > 0 && <ArrowLeft size={14} />}
            {activeIndex === 0 ? "Cancel" : "Back"}
          </button>
          {isLastStep ? (
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
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
              style={{ background: BRAND_GRADIENT }}
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminFormModal;
