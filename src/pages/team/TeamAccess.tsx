import { useEffect, useState } from "react";
import {
  CheckCircle2, Eye, EyeOff, Info, KeyRound, Loader2, Pencil, ShieldCheck, Trash2, UserPlus, Users,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import PageHeader from "../../components/common/PageHeader";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { TableCard, TableEmpty, TableError, TableSkeleton, Th } from "../../components/common/TableShell";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getApiErrorMessage } from "../../utils/apiError";
import { LOAN_TYPES, getLoanTypeLabel } from "../../constants/loanTypes";
import {
  claimSuperAdminRecord,
  createManagedAdmin,
  deleteManagedAdmin,
  listManagedAdmins,
  resetManagedAdminPassword,
  updateManagedAdmin,
  type AdminRole,
  type ListAdminsResult,
  type ManagedAdmin,
} from "../../api/adminUsers";
import AdminFormModal, { type AdminFormValues } from "./components/AdminFormModal";

const BRAND_GRADIENT = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";

const getInitials = (name?: string) =>
  name ? name.split(" ").slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") : "A";

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const StatPill = ({ label, value }: { label: string; value: string | number }) => (
  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
    {label}: <span className="text-slate-900">{value}</span>
  </span>
);

const LoanAccessCell = ({ admin }: { admin: ManagedAdmin }) => {
  if (admin.role === "super_admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(6,106,156,0.08)] px-2.5 py-1 text-[11px] font-bold text-[rgb(6,106,156)]">
        <ShieldCheck size={11} /> All {LOAN_TYPES.length} products
      </span>
    );
  }

  const slugs = admin.loanAccess === "all" ? LOAN_TYPES.map((loan) => loan.slug) : admin.loanAccess;
  const labels = slugs.map(getLoanTypeLabel);

  if (labels.length === 0) {
    return <span className="text-xs font-medium text-amber-600">No loans assigned</span>;
  }

  return (
    <div className="flex max-w-[16rem] flex-wrap items-center gap-1" title={labels.join(", ")}>
      {labels.slice(0, 2).map((label) => (
        <span key={label} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
          {label}
        </span>
      ))}
      {labels.length > 2 && (
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
          +{labels.length - 2}
        </span>
      )}
      <span className="text-[11px] text-slate-400">({labels.length})</span>
    </div>
  );
};

const PasswordField = ({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 pr-10 text-sm focus:border-[rgb(6,106,156)] focus:outline-none focus:ring-2 focus:ring-[rgba(6,106,156,0.2)]"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

const ResetPasswordDialog = ({
  admin, onClose, onSaved,
}: {
  admin: ManagedAdmin;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const { showToast } = useToast();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!current) return setError("Enter your current password.");
    if (password.length < 6) return setError("Use at least 6 characters.");
    if (password !== confirm) return setError("Both passwords must match.");
    setError("");
    setBusy(true);
    try {
      await resetManagedAdminPassword(admin.id, password, current);
      showToast(`Password updated for ${admin.loginId}.`);
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update the password."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(6,106,156,0.08)] text-[rgb(6,106,156)]">
            <KeyRound size={16} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Reset password</h3>
            <p className="text-xs text-slate-500">{admin.loginId} · {admin.email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">
              Your current password is required — the new password is saved only after it verifies.
            </p>
          </div>
          <PasswordField
            value={current}
            autoFocus
            onChange={setCurrent}
            placeholder="Your current password (super admin)"
          />
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="New password"
          />
          <PasswordField
            value={confirm}
            onChange={setConfirm}
            placeholder="Repeat new password"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ background: BRAND_GRADIENT }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
};

const TeamAccess = () => {
  const { admin, isSuperAdmin, refreshAccess } = useAuth();
  const { showToast } = useToast();

  const [result, setResult] = useState<ListAdminsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const [form, setForm] = useState<{ mode: "create" | "edit"; admin?: ManagedAdmin } | null>(null);
  const [deleting, setDeleting] = useState<ManagedAdmin | null>(null);
  const [resetting, setResetting] = useState<ManagedAdmin | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * The default super admin (`admin01`) is recognised without a directory row.
   * Persist it the first time this page opens, so the role survives once other
   * admins exist and the account shows up in the table like any other admin.
   */
  useEffect(() => {
    // Only an actual super admin may be claimed as one — otherwise opening this
    // route would grant any signed-in admin a local super-admin override.
    if (!admin?.email || !isSuperAdmin) return;
    claimSuperAdminRecord(admin);
    refreshAccess();
  }, [admin, isSuperAdmin, refreshAccess]);

  useEffect(() => {
    let cancelled = false;
    listManagedAdmins()
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setError("");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err, "Unable to load the admin team."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = () => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  };

  const admins = result?.admins ?? [];
  const mode = result?.mode ?? "local";
  const superAdmins = admins.filter((record) => record.role === "super_admin");
  const restricted = admins.filter(
    (record) => record.role === "admin" && record.loanAccess !== "all"
  );
  const assignedLoans = new Set<string>(
    admins.flatMap((record) =>
      record.loanAccess === "all" ? LOAN_TYPES.map((loan) => loan.slug) : record.loanAccess
    )
  );

  const isSelf = (record: ManagedAdmin) =>
    !!admin?.email && record.email.toLowerCase() === admin.email.toLowerCase();

  const handleCreate = async (values: AdminFormValues) => {
    setBusy(true);
    try {
      const created = await createManagedAdmin(values);
      showToast(`${created.loginId} created — ${created.loanAccess === "all" ? "all 18 loans" : `${created.loanAccess.length} loan product(s)`} assigned.`);
      setForm(null);
      refreshAccess();
      reload();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not create the admin."), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (values: AdminFormValues) => {
    if (!form?.admin) return;
    if (
      isSelf(form.admin) &&
      form.admin.role === "super_admin" &&
      values.role !== "super_admin"
    ) {
      showToast("You cannot remove your own super admin role.", "error");
      return;
    }
    setBusy(true);
    try {
      // Password change runs first: it verifies this super admin's own current
      // password, so a wrong one stops everything before anything is saved.
      if (values.password && values.currentPassword) {
        await resetManagedAdminPassword(
          form.admin.id,
          values.password,
          values.currentPassword
        );
      }
      await updateManagedAdmin(form.admin.id, {
        name: values.name,
        email: values.email,
        role: values.role as AdminRole,
        loanAccess: values.loanAccess,
      });
      showToast(
        values.password
          ? `${values.loginId} updated — password changed.`
          : `${values.loginId} updated.`
      );
      setForm(null);
      refreshAccess();
      reload();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not update the admin."), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteManagedAdmin(deleting.id);
      showToast(`${deleting.loginId} removed.`);
      setDeleting(null);
      refreshAccess();
      reload();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not delete the admin."), "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteBlockedReason = (record: ManagedAdmin): string => {
    if (isSelf(record)) return "You cannot delete the account you are signed in with.";
    if (record.role === "super_admin" && superAdmins.length <= 1) {
      return "At least one super admin must remain.";
    }
    return "";
  };

  return (
    <AdminLayout>
      <PageHeader
        icon={ShieldCheck}
        title="Team & Access"
        subtitle="Create admin logins and choose exactly which loan products each one can open."
        actions={(
          <button
            type="button"
            onClick={() => setForm({ mode: "create" })}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            style={{ background: BRAND_GRADIENT }}
          >
            <UserPlus size={15} /> Create admin
          </button>
        )}
      >
        <StatPill label="Admins" value={admins.length} />
        <StatPill label="Super admins" value={superAdmins.length} />
        <StatPill label="Limited access" value={restricted.length} />
        <StatPill label="Loans covered" value={`${assignedLoans.size}/${LOAN_TYPES.length}`} />
      </PageHeader>

      {mode === "local" && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <Info size={15} className="mt-0.5 shrink-0" />
          <p>
            <span className="font-semibold">Backend admin endpoints are not live yet.</span>{" "}
            New admins and their loan access are saved in this browser, and the access rules apply
            immediately. Accounts become sign-in ready once the backend exposes{" "}
            <code className="rounded bg-white/70 px-1">POST /admins</code> — the full contract is in{" "}
            <code className="rounded bg-white/70 px-1">docs/BACKEND_API.md</code>.
          </p>
        </div>
      )}

      <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-xs text-slate-600">
        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[rgb(6,106,156)]" />          <p>
            An admin only sees the loan products you tick here — in the sidebar, on the dashboard and
            on every application page. Customers, Masters and the Franchise network are hidden from
            them too. Super admins always see all {LOAN_TYPES.length} products and can manage this
            team.
          </p>
      </div>

      <TableCard>
        {error ? (
          <TableError message={error} onRetry={reload} />
        ) : loading && !result ? (
          <TableSkeleton rows={5} height="h-16" />
        ) : admins.length === 0 ? (
          <TableEmpty
            icon={Users}
            title="No admins yet"
            description="Create the first admin login and assign the loans they should handle."
            action={(
              <button
                type="button"
                onClick={() => setForm({ mode: "create" })}
                className="mt-1 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                style={{ background: BRAND_GRADIENT }}
              >
                <UserPlus size={15} /> Create admin
              </button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <Th>Admin</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Loan access</Th>
                  <Th>Created</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {admins.map((record) => {
                  const blocked = deleteBlockedReason(record);
                  return (
                    <tr key={record.id} className="border-b border-slate-50 transition hover:bg-sky-50/30">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                            style={{ background: BRAND_GRADIENT }}
                          >
                            {getInitials(record.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                              {record.name}
                              {isSelf(record) && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  you
                                </span>
                              )}
                            </p>
                            <p className="font-mono text-[11px] text-slate-400">{record.loginId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{record.email || "—"}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
                            record.role === "super_admin"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {record.role === "super_admin" && <ShieldCheck size={11} />}
                          {record.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <LoanAccessCell admin={record} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{fmtDate(record.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setForm({ mode: "edit", admin: record })}
                            title="Edit details and loan access"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-[rgb(6,106,156)]"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetting(record)}
                            disabled={mode === "local"}
                            title={mode === "local"
                              ? "Needs the backend password endpoint"
                              : "Reset password"}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-[rgb(6,106,156)] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <KeyRound size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(record)}
                            disabled={!!blocked}
                            title={blocked || "Delete admin"}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>

      {form && (
        <AdminFormModal
          mode={form.mode}
          admin={form.admin}
          existing={admins}
          isSubmitting={busy}
          onClose={() => setForm(null)}
          onSubmit={form.mode === "create" ? handleCreate : handleUpdate}
        />
      )}

      {resetting && (
        <ResetPasswordDialog
          admin={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => {
            setResetting(null);
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.loginId}?`}
          message={`${deleting.name} will no longer be able to sign in. This cannot be undone.`}
          confirmText={deleting.loginId}
          confirmLabel="Delete admin"
          isSubmitting={busy}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </AdminLayout>
  );
};

export default TeamAccess;
