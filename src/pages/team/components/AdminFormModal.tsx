import { useState } from "react";
import { Check, Eye, EyeOff, Loader2, ShieldCheck, X } from "lucide-react";
import { LOAN_TYPES, type LoanTypeSlug } from "../../../constants/loanTypes";
import type { AdminRole, LoanAccess, ManagedAdmin } from "../../../api/adminUsers";

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
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_ID_REGEX = /^[a-z0-9][a-z0-9._-]{2,23}$/i;
const BRAND_GRADIENT = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";

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
  const [name, setName] = useState(admin?.name ?? "");
  const [email, setEmail] = useState(admin?.email ?? "");
  const [password, setPassword] = useState("");
  // Edit mode can change the password too, but only after the super admin's own
  // old password is verified by the backend.
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<AdminRole>(admin?.role ?? "admin");
  // New admins start with nothing assigned — the super admin ticks the products.
  // Editing one who already has every product must show all of them ticked.
  const [selected, setSelected] = useState<LoanTypeSlug[]>(() => {
    if (!admin) return [];
    return admin.loanAccess === "all"
      ? LOAN_TYPES.map((loan) => loan.slug)
      : [...admin.loanAccess];
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isSuperRole = role === "super_admin";
  const allSelected = selected.length === LOAN_TYPES.length;

  const toggle = (slug: LoanTypeSlug) => {
    setSelected((current) =>
      current.includes(slug) ? current.filter((entry) => entry !== slug) : [...current, slug]
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

    if (!isSuperRole && selected.length === 0) {
      next.loans = "Assign at least one loan product.";
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
                ? "Set the credentials and choose exactly which loans this admin handles."
                : "Update the details and the loan products this admin can open."}
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

        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <Field
            label="Admin ID"
            value={loginId}
            onChange={setLoginId}
            placeholder="admin02"
            error={errors.loginId}
            hint="Sign-in handle — the admin can log in with this or the email."
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
                onChange={(event) => setRole(event.target.value as AdminRole)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-[rgb(6,106,156)] focus:outline-none focus:ring-2 focus:ring-[rgba(6,106,156,0.2)]"
              >
                <option value="admin">Admin — only the assigned loans</option>
                <option value="super_admin">Super admin — everything + team management</option>
              </select>
            </div>
          )}
        </div>

        {mode === "create" && (
          <div className="px-6 pb-1">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Role</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { value: "admin", title: "Admin", desc: "Only the loans you assign below" },
                { value: "super_admin", title: "Super admin", desc: "Every loan + team management" },
              ] as const).map((option) => {
                const active = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={`rounded-xl border px-3.5 py-2.5 text-left transition ${
                      active
                        ? "border-[rgb(6,106,156)] bg-[rgba(6,106,156,0.06)] ring-1 ring-[rgba(6,106,156,0.25)]"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                      {option.value === "super_admin" && <ShieldCheck size={14} className="text-[rgb(6,106,156)]" />}
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{option.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Loan assignment */}
        <div className="px-6 pb-5 pt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-700">Loan products</p>
              <p className="text-xs text-slate-500">
                {isSuperRole
                  ? "Super admins always see all 18 products."
                  : `${selected.length} of ${LOAN_TYPES.length} selected`}
              </p>
            </div>
            {!isSuperRole && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelected(LOAN_TYPES.map((loan) => loan.slug))}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {errors.loans && <p className="mb-2 text-xs text-red-600">{errors.loans}</p>}

          <div
            className={`scrollbar-hidden grid max-h-56 gap-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2 sm:grid-cols-2 ${
              isSuperRole ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {LOAN_TYPES.map((loan) => {
              const checked = isSuperRole || selected.includes(loan.slug);
              return (
                <button
                  key={loan.slug}
                  type="button"
                  onClick={() => toggle(loan.slug)}
                  aria-pressed={checked}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition ${
                    checked
                      ? "border-[rgba(6,106,156,0.35)] bg-white text-slate-800 shadow-sm"
                      : "border-transparent text-slate-500 hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-transparent text-white"
                        : "border-slate-300 bg-white"
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
