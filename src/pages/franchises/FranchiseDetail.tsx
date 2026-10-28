import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Building2, Check, Copy, Eye, EyeOff, FileText, LoaderCircle, Mail, MapPin,
  Phone, RefreshCw, ShieldCheck, UserRound, Users, X,
  Trash2,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import { LOAN_TYPES } from "../../constants/loanTypes";
import { SUPPORTED_LOAN_SLUGS } from "../../api/personalLoans";
import {
  approveFranchise,
  deleteFranchise,
  getApiErrorMessage,
  getFranchise,
  getFranchiseLoans,
  rejectFranchise,
  resetFranchisePassword,
  type Franchise,
  type FranchiseLoan,
  type FranchiseLoans,
} from "../../api/franchises";
import StatusPill from "./components/StatusPill";
import {
  BRAND_GRADIENT,
  contactName,
  displayName,
  formatCurrency,
  formatDate,
  formatDateTime,
  initialsOf,
  isStatus,
  locationOf,
} from "./franchiseUtils";

const EMPTY_LOANS: FranchiseLoans = { total: 0, products: [] };

const Section = ({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <h2 className="flex items-center gap-2 font-semibold text-slate-800">
        <span className="text-[rgb(6,106,156)]">{icon}</span>
        {title}
      </h2>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
    <dd className="mt-1 break-words text-sm text-slate-700">{children || "—"}</dd>
  </div>
);

const FranchiseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    franchise: Franchise | null;
    loans: FranchiseLoans;
    detailError: string;
    loansError: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmApprovedReject, setConfirmApprovedReject] = useState(false);
  const [confirmResetPassword, setConfirmResetPassword] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const key = `${id}:${refreshKey}`;
    Promise.allSettled([getFranchise(id), getFranchiseLoans(id)]).then(([detail, loans]) => {
      if (cancelled) return;
      setResult({
        key,
        franchise: detail.status === "fulfilled" ? detail.value : null,
        loans: loans.status === "fulfilled" ? loans.value : EMPTY_LOANS,
        detailError:
          detail.status === "rejected"
            ? getApiErrorMessage(detail.reason, "Unable to load franchise details.")
            : "",
        loansError:
          loans.status === "rejected"
            ? getApiErrorMessage(loans.reason, "Unable to load this franchise's loan applications.")
            : "",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

  const active = result?.key === `${id}:${refreshKey}` ? result : null;
  const franchise = active?.franchise ?? null;
  const loans = active?.loans ?? EMPTY_LOANS;
  const loading = active === null;

  const patchDetail = (nextRefreshKey: number, patch: Partial<Franchise>) => {
    setResult((current) =>
      current?.franchise
        ? {
            ...current,
            key: `${id}:${nextRefreshKey}`,
            franchise: { ...current.franchise, ...patch },
          }
        : current
    );
  };

  const handleApprove = async () => {
    if (!franchise) return;
    setActionLoading(true);
    try {
      const response = await approveFranchise(franchise._id);
      showToast(
        response.credentials?.loginId
          ? "Franchise approved. Login credentials are available below."
          : "Franchise approved. Refresh details to load the server-issued credentials."
      );
      setConfirmApprove(false);
      const nextRefreshKey = refreshKey + 1;
      setRefreshKey(nextRefreshKey);
      if (Object.prototype.hasOwnProperty.call(response, "credentials")) {
        patchDetail(nextRefreshKey, {
          ...response.franchise,
          status: response.franchise?.status ?? "Approved",
          credentials: response.credentials,
        });
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, "Unable to approve this franchise."), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!franchise) return;
    setActionLoading(true);
    try {
      const response = await resetFranchisePassword(franchise._id);
      showToast(
        response.credentials?.password
          ? "Franchise password reset. Updated credentials are available below."
          : "Password reset requested. Refresh details to load the credentials response."
      );
      setConfirmResetPassword(false);
      const nextRefreshKey = refreshKey + 1;
      setRefreshKey(nextRefreshKey);
      if (Object.prototype.hasOwnProperty.call(response, "credentials")) {
        patchDetail(nextRefreshKey, {
          ...response.franchise,
          credentials: response.credentials,
        });
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, "Unable to reset the franchise password."), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!franchise) return;
    setActionLoading(true);
    try {
      await rejectFranchise(franchise._id, rejectNote.trim());
      showToast("Franchise application rejected.");
      setShowReject(false);
      setRejectNote("");
      setRefreshKey((key) => key + 1);
    } catch (error) {
      showToast(getApiErrorMessage(error, "Unable to reject this franchise."), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!franchise) return;
    setIsDeleting(true);
    try {
      await deleteFranchise(franchise._id);
      showToast(`"${displayName(franchise)}" deleted successfully.`, "success");
      navigate("/franchises");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Unable to delete this franchise."), "error");
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const copyCredential = async (value: string | undefined, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied.`);
    } catch (error) {
      showToast(getApiErrorMessage(error, `Unable to copy ${label.toLowerCase()}.`), "error");
    }
  };

  const isPending = isStatus(franchise?.status, "pending");
  const isApproved = isStatus(franchise?.status, "approved");
  const isRejected = isStatus(franchise?.status, "rejected");
  const credentials = franchise?.credentials;
  const loginId = credentials?.loginId || franchise?.franchiseId;
  const loanCount = franchise?.loanCount ?? loans.total;

  return (
    <AdminLayout>
      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/franchises"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft size={16} /> Back to franchises
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={franchise ? `/franchise-customers?franchise=${encodeURIComponent(franchise.franchiseId || franchise._id)}` : "/franchise-customers"}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Users size={14} /> View customers
          </Link>
          {franchise && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-2xl bg-white shadow-sm" />
          <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
      )}

      {active?.detailError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {active.detailError}
        </div>
      )}

      {franchise && (
        <div className="space-y-5">
          {/* ── Identity + actions ─────────────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div className="flex min-w-0 items-start gap-4">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold text-white shadow-sm"
                  style={{ background: BRAND_GRADIENT }}
                >
                  {initialsOf(displayName(franchise))}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Franchise profile
                  </p>
                  <h1 className="mt-1 truncate text-xl font-bold text-slate-900">
                    {displayName(franchise)}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill status={franchise.status} />
                    {franchise.franchiseId && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600">
                        {franchise.franchiseId}
                      </span>
                    )}
                    {franchise.package && (
                      <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                        {franchise.package}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {(isPending || isApproved) && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => (isApproved ? setConfirmApprovedReject(true) : setShowReject(true))}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    <X size={15} /> Reject
                  </button>
                  {isPending && (
                    <button
                      type="button"
                      onClick={() => setConfirmApprove(true)}
                      className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                      style={{ background: BRAND_GRADIENT }}
                    >
                      <Check size={15} /> Approve
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick facts */}
            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Contact person">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound size={13} className="text-slate-400" />
                  {contactName(franchise)}
                </span>
              </Field>
              <Field label="Phone">
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={13} className="text-slate-400" />
                  {franchise.mobile || franchise.phone}
                </span>
              </Field>
              <Field label="Email">
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={13} className="text-slate-400" />
                  {franchise.email}
                </span>
              </Field>
              <Field label="Location">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} className="text-slate-400" />
                  {locationOf(franchise)}
                </span>
              </Field>
            </div>
          </section>

          {/* ── Rejection reason ──────────────────────────────────────────── */}
          {(isRejected || franchise.rejectionReason) && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
              <h2 className="font-semibold text-red-800">Rejection reason</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-red-700">
                {franchise.rejectionReason || "No rejection reason was returned by the API."}
              </p>
            </section>
          )}

          <div className="grid gap-5 xl:grid-cols-2">
            {/* ── Business & KYC ──────────────────────────────────────────── */}
            <Section title="Business & KYC" icon={<ShieldCheck size={17} />}>
              <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <Field label="Business name">{franchise.businessName}</Field>
                <Field label="Registered name">{franchise.name || franchise.fullName}</Field>
                <Field label="Franchise login ID">
                  <span className="font-mono text-xs">{loginId}</span>
                </Field>
                <Field label="PAN">
                  <span className="font-mono text-xs">{franchise.panNumber}</span>
                </Field>
                <Field label="Package">{franchise.package}</Field>
                <Field label="Experience">{franchise.experience}</Field>
              </dl>
            </Section>

            {/* ── Location & timeline ─────────────────────────────────────── */}
            <Section title="Location & timeline" icon={<MapPin size={17} />}>
              <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <Field label="Address">{franchise.address}</Field>
                <Field label="Pincode">{franchise.pincode}</Field>
                <Field label="City / state / country">{locationOf(franchise)}</Field>
                <Field label="Registered on">{formatDate(franchise.createdAt)}</Field>
                <Field label="Applied on">{formatDate(franchise.franchiseAppliedAt)}</Field>
                <Field label="Approved on">{formatDate(franchise.franchiseApprovedAt)}</Field>
                <Field label="Rejected on">{formatDate(franchise.franchiseRejectedAt)}</Field>
                <Field label="Last updated">{formatDateTime(franchise.updatedAt)}</Field>
              </dl>
            </Section>
          </div>

          {/* ── Credentials ───────────────────────────────────────────────── */}
          {isApproved && (
            <Section
              title="Franchise login credentials"
              icon={<ShieldCheck size={17} />}
              action={
                <button
                  type="button"
                  onClick={() => setConfirmResetPassword(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-50"
                >
                  <RefreshCw size={13} /> Reset password to registered PAN
                </button>
              }
            >
              <p className="text-sm text-slate-500">
                Share these credentials securely. The franchise partner signs in through the franchise
                portal, not this admin panel.
              </p>

              {credentials ? (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        Login ID
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800">
                          {loginId || "Not provided by API"}
                        </code>
                        {loginId && (
                          <button
                            type="button"
                            aria-label="Copy login ID"
                            onClick={() => void copyCredential(loginId, "Login ID")}
                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
                          >
                            <Copy size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="franchise-login-password"
                        className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400"
                      >
                        Password
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          id="franchise-login-password"
                          type={showPassword ? "text" : "password"}
                          readOnly
                          autoComplete="off"
                          value={showPassword ? credentials.password ?? "" : ""}
                          placeholder={credentials.password ? "••••••••" : "Not provided by API"}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                        />
                        {credentials.password && (
                          <>
                            <button
                              type="button"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              onClick={() => setShowPassword((value) => !value)}
                              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
                            >
                              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                            <button
                              type="button"
                              aria-label="Copy password"
                              onClick={() => void copyCredential(credentials.password, "Password")}
                              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
                            >
                              <Copy size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {credentials.note && <p className="mt-3 text-xs text-slate-500">{credentials.note}</p>}
                </>
              ) : (
                <>
                  {loginId && (
                    <p className="mt-3 text-sm text-slate-600">
                      Login ID: <code className="font-mono">{loginId}</code>
                    </p>
                  )}
                  <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    The detail API did not return credentials. The password cannot be verified, so it is
                    not inferred from PAN or mobile. Refresh details or check the backend approval/login
                    flow.
                  </p>
                </>
              )}
            </Section>
          )}

          {/* ── Loan applications ─────────────────────────────────────────── */}
          <Section
            title={`Loan applications (${loanCount})`}
            icon={<FileText size={17} />}
            action={<span className="text-xs text-slate-400">{loans.total} total</span>}
          >
            {active?.loansError && (
              <p className="text-sm text-red-700" role="alert">
                {active.loansError}
              </p>
            )}

            {!active?.loansError && loans.products.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                No loan applications found for this franchise.
              </p>
            )}

            {loans.products.length > 0 && (
              <div className="-m-5 divide-y divide-slate-100">
                {loans.products.map((product) => (
                  <div key={product.product}>
                    <h3 className="flex items-center justify-between gap-2 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
                      {product.product}
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">
                        {product.loans.length}
                      </span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            <th className="px-5 py-3">Applicant</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Submitted</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {product.loans.map((loan: FranchiseLoan) => {
                            const slug = LOAN_TYPES.find(
                              (type) =>
                                type.slug === loan.loanType ||
                                type.label.toLowerCase() === (loan.loanType ?? "").toLowerCase()
                            )?.slug;
                            const canOpen = !!slug && SUPPORTED_LOAN_SLUGS.has(slug);
                            return (
                              <tr key={loan._id} className="transition hover:bg-sky-50/40">
                                <td className="px-5 py-3">
                                  {canOpen ? (
                                    <Link
                                      to={`/applications/${slug}/${encodeURIComponent(loan._id)}`}
                                      className="font-semibold text-[rgb(6,106,156)] hover:underline"
                                    >
                                      {loan.fullName || "View application"}
                                    </Link>
                                  ) : (
                                    <p className="font-semibold text-slate-800">{loan.fullName || "—"}</p>
                                  )}
                                  <p className="mt-0.5 text-xs text-slate-400">
                                    {loan.mobile || loan.email || ""}
                                  </p>
                                </td>
                                <td className="px-4 py-3 tabular-nums text-slate-600">
                                  {formatCurrency(loan.loanAmount)}
                                </td>
                                <td className="px-4 py-3">
                                  <StatusPill status={loan.status} label={loan.status || "—"} />
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                  {formatDate(loan.createdAt)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {franchise && confirmResetPassword && (
        <ConfirmDialog
          title="Reset franchise password?"
          message="The backend will reset the password to the franchise's registered PAN."
          confirmLabel="Reset password"
          danger={false}
          isSubmitting={actionLoading}
          onConfirm={() => void handleResetPassword()}
          onCancel={() => setConfirmResetPassword(false)}
        />
      )}

      {franchise && confirmApprove && (
        <ConfirmDialog
          title="Approve franchise application?"
          message="The backend will create the franchise login ID and set the initial password to the registered PAN. Any credentials returned by the backend will appear on this page."
          confirmLabel="Approve application"
          danger={false}
          isSubmitting={actionLoading}
          onConfirm={() => void handleApprove()}
          onCancel={() => setConfirmApprove(false)}
        />
      )}

      {franchise && confirmApprovedReject && (
        <ConfirmDialog
          title="Reject this approved franchise?"
          message="Rejecting an approved franchise will disable its login, and password reset will no longer be available. Continue only if you intend to revoke its access."
          confirmLabel="Continue to rejection"
          isSubmitting={actionLoading}
          onConfirm={() => {
            setConfirmApprovedReject(false);
            setShowReject(true);
          }}
          onCancel={() => setConfirmApprovedReject(false)}
        />
      )}

      {showReject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => !actionLoading && setShowReject(false)}
        >
          <form
            onSubmit={(event) => void handleReject(event)}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-800">Reject franchise application</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add an optional note explaining why this application is being rejected.
            </p>
            <textarea
              autoFocus
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Application details require correction"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <p className="mt-1 text-right text-xs text-slate-400">{rejectNote.length}/500</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowReject(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? "Please wait..." : "Reject application"}
              </button>
            </div>
          </form>
        </div>
      )}

      {!loading && !franchise && !active?.detailError && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <Building2 size={22} className="text-slate-300" />
          <p className="text-sm text-slate-500">This franchise could not be found.</p>
          <button
            type="button"
            onClick={() => navigate("/franchises")}
            className="text-xs font-semibold text-[rgb(6,106,156)] hover:underline"
          >
            Back to franchises
          </button>
        </div>
      )}

      {loading && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
          <LoaderCircle size={16} className="animate-spin" /> Loading franchise details...
        </p>
      )}

      {/* ── Delete confirmation ────────────────────────────────────────── */}
      {franchise && confirmDelete && (
        <ConfirmDialog
          title={`Delete "${displayName(franchise)}"?`}
          message="This will permanently remove the franchise account, all its data, and cannot be undone. Customers linked to this franchise will lose their franchise association."
          confirmText={franchise.franchiseId || franchise.panNumber || displayName(franchise)}
          confirmLabel="Delete Franchise"
          danger={true}
          isSubmitting={isDeleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </AdminLayout>
  );
};

export default FranchiseDetail;
