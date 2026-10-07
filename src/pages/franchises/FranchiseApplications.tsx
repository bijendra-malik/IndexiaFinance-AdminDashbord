import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Building2, Check, ChevronLeft, ChevronRight, Clock3, Copy, Eye, EyeOff, FileText,
  LoaderCircle, MapPin, RefreshCw, Search, X,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import {
  approveFranchise,
  getApiErrorMessage,
  getFranchise,
  getFranchiseLoans,
  getFranchises,
  rejectFranchise,
  resetFranchisePassword,
  type Franchise,
  type FranchiseLoan,
  type FranchiseLoans,
} from "../../api/franchises";

const PAGE_SIZE = 20;
const ACTIVE_BACKGROUND = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";

const displayName = (franchise: Franchise) =>
  franchise.businessName || franchise.name || franchise.fullName || franchise.contactPerson || "Franchise";

const formatDate = (date?: string) =>
  date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const statusStyle = (status?: string) => {
  switch ((status ?? "").toLowerCase()) {
    case "approved": return "bg-emerald-50 text-emerald-700";
    case "rejected": return "bg-red-50 text-red-700";
    case "none": return "bg-slate-100 text-slate-600";
    default: return "bg-amber-50 text-amber-700";
  }
};

const statusLabel = (status?: string) =>
  !status || status.toLowerCase() === "none" ? "Registered" : status;

const FranchiseApplications = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [refreshKey, setRefreshKey] = useState(0);
  const [listResult, setListResult] = useState<{
    requestKey: string;
    franchises: Franchise[];
    total: number;
    totalPages: number;
    error: string;
  } | null>(null);
  const [detailResult, setDetailResult] = useState<{
    requestKey: string;
    franchise: Franchise | null;
    loans: FranchiseLoans;
    detailError: string;
    loansError: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmResetPassword, setConfirmResetPassword] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [revealedCredentialFor, setRevealedCredentialFor] = useState<string | null>(null);

  useEffect(() => {
    if (id) return;
    let cancelled = false;
    const requestKey = `${status}:${appliedSearch}:${page}:${refreshKey}`;
    getFranchises({
        status: status === "All" ? undefined : status,
        search: appliedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      })
      .then((result) => {
        if (cancelled) return;
        setListResult({
          requestKey,
          franchises: result.franchises,
          total: result.total,
          totalPages: Math.max(1, result.totalPages),
          error: "",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setListResult({
        requestKey,
        franchises: [],
        total: 0,
        totalPages: 1,
        error: getApiErrorMessage(error, "Unable to load franchise applications."),
      });
      });
    return () => { cancelled = true; };
  }, [appliedSearch, id, page, refreshKey, status]);

  const listRequestKey = `${status}:${appliedSearch}:${page}:${refreshKey}`;
  const activeListResult = listResult?.requestKey === listRequestKey ? listResult : null;
  const franchises = activeListResult?.franchises ?? [];
  const total = activeListResult?.total ?? 0;
  const totalPages = activeListResult?.totalPages ?? 1;
  const listError = activeListResult?.error ?? "";
  const listLoading = activeListResult === null;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const requestKey = `${id}:${refreshKey}`;
    Promise.allSettled([getFranchise(id), getFranchiseLoans(id)]).then(([franchiseResult, loansResult]) => {
      if (cancelled) return;
      setDetailResult({
        requestKey,
        franchise: franchiseResult.status === "fulfilled" ? franchiseResult.value : null,
        loans: loansResult.status === "fulfilled" ? loansResult.value : { total: 0, products: [] },
        detailError: franchiseResult.status === "rejected"
          ? getApiErrorMessage(franchiseResult.reason, "Unable to load franchise details.")
          : "",
        loansError: loansResult.status === "rejected"
          ? getApiErrorMessage(loansResult.reason, "Unable to load this franchise's loan applications.")
          : "",
      });
    });
    return () => { cancelled = true; };
  }, [id, refreshKey]);

  const detailRequestKey = id ? `${id}:${refreshKey}` : "";
  const activeDetailResult = detailResult?.requestKey === detailRequestKey ? detailResult : null;
  const franchise = activeDetailResult?.franchise ?? null;
  const loans = activeDetailResult?.loans ?? { total: 0, products: [] };
  const detailError = activeDetailResult?.detailError ?? "";
  const loansError = activeDetailResult?.loansError ?? "";
  const detailLoading = !!id && activeDetailResult === null;

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handleApprove = async () => {
    if (!franchise) return;
    setActionLoading(true);
    try {
      const result = await approveFranchise(franchise._id);
      showToast(
        result.credentials?.loginId
          ? "Franchise approved. Login credentials are available below."
          : "Franchise approved. Refresh details to load the server-issued credentials."
      );
      setConfirmApprove(false);
      const nextRefreshKey = refreshKey + 1;
      setRefreshKey(nextRefreshKey);
      if (Object.prototype.hasOwnProperty.call(result, "credentials")) {
        setDetailResult((current) => current?.franchise ? {
          ...current,
          requestKey: `${franchise._id}:${nextRefreshKey}`,
          franchise: {
            ...current.franchise,
            ...result.franchise,
            status: result.franchise?.status ?? "Approved",
            credentials: result.credentials,
          },
        } : current);
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
      const result = await resetFranchisePassword(franchise._id);
      showToast(
        result.credentials?.password
          ? "Franchise password reset. Updated credentials are available below."
          : "Password reset requested. Refresh details to load the credentials response."
      );
      setConfirmResetPassword(false);
      const nextRefreshKey = refreshKey + 1;
      setRefreshKey(nextRefreshKey);
      if (Object.prototype.hasOwnProperty.call(result, "credentials")) {
        setDetailResult((current) => current?.franchise ? {
          ...current,
          requestKey: `${franchise._id}:${nextRefreshKey}`,
          franchise: {
            ...current.franchise,
            ...result.franchise,
            credentials: result.credentials,
          },
        } : current);
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

  const copyCredential = async (value: string | undefined, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied.`);
    } catch (error) {
      showToast(getApiErrorMessage(error, `Unable to copy ${label.toLowerCase()}.`), "error");
    }
  };

  if (id) {
    const isPending = (franchise?.status ?? "").toLowerCase() === "pending";
    const isApproved = (franchise?.status ?? "").toLowerCase() === "approved";
    const credentials = franchise?.credentials;
    const franchiseLoginId = credentials?.loginId || franchise?.franchiseId;
    const showCredentialPassword = franchise?._id === revealedCredentialFor;
    const loanCount = franchise?.loanCount ?? loans.total;
    return (
      <AdminLayout>
        <div className="mb-5 flex items-center justify-between">
          <Link to="/franchises" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={16} /> Franchise applications
          </Link>
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={detailLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={14} className={detailLoading ? "animate-spin" : ""} /> Refresh details
          </button>
        </div>
        {detailLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <LoaderCircle size={18} className="animate-spin" /> Loading franchise details...
          </div>
        )}
        {detailError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            {detailError}
          </div>
        )}
        {franchise && (
          <>
            <div className="mb-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: ACTIVE_BACKGROUND }}>
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-800">{displayName(franchise)}</h1>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(franchise.status)}`}>
                      {statusLabel(franchise.status)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  {franchise.contactPerson && <p><span className="font-medium text-slate-800">Contact person:</span> {franchise.contactPerson}</p>}
                  {franchise.email && <p><span className="font-medium text-slate-800">Email:</span> {franchise.email}</p>}
                  {(franchise.mobile || franchise.phone) && <p><span className="font-medium text-slate-800">Phone:</span> {franchise.mobile || franchise.phone}</p>}
                  {(franchise.city || franchise.state || franchise.country) && <p className="flex items-center gap-1"><MapPin size={14} /> {[franchise.city, franchise.state, franchise.country].filter(Boolean).join(", ")}</p>}
                  {franchise.address && <p><span className="font-medium text-slate-800">Address:</span> {franchise.address}</p>}
                  {franchise.pincode && <p><span className="font-medium text-slate-800">Pincode:</span> {franchise.pincode}</p>}
                  {franchise.experience && <p><span className="font-medium text-slate-800">Experience:</span> {franchise.experience}</p>}
                  {franchise.panNumber && <p><span className="font-medium text-slate-800">PAN:</span> {franchise.panNumber}</p>}
                  {franchise.package && <p><span className="font-medium text-slate-800">Package:</span> {franchise.package}</p>}
                  <p><span className="font-medium text-slate-800">Registered:</span> {formatDate(franchise.createdAt)}</p>
                  {franchise.franchiseAppliedAt && <p><span className="font-medium text-slate-800">Applied:</span> {formatDate(franchise.franchiseAppliedAt)}</p>}
                  {franchise.franchiseApprovedAt && <p><span className="font-medium text-slate-800">Approved:</span> {formatDate(franchise.franchiseApprovedAt)}</p>}
                  {franchise.franchiseRejectedAt && <p><span className="font-medium text-slate-800">Rejected:</span> {formatDate(franchise.franchiseRejectedAt)}</p>}
                  {franchise.franchiseId && <p><span className="font-medium text-slate-800">Franchise login ID:</span> {franchise.franchiseId}</p>}
                </div>
              </div>
              {isPending && (
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setShowReject(true)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                    <X size={15} /> Reject
                  </button>
                  <button onClick={() => setConfirmApprove(true)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: ACTIVE_BACKGROUND }}>
                    <Check size={15} /> Approve
                  </button>
                </div>
              )}
            </div>

            {isApproved && (
              <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
                <h2 className="font-semibold text-slate-800">Franchise login credentials</h2>
                <button type="button" onClick={() => setConfirmResetPassword(true)} disabled={actionLoading} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
                  <RefreshCw size={14} /> Reset password to registered mobile
                </button>
                {credentials ? (
                  <>
                    <p className="mt-1 text-sm text-slate-500">Share these credentials securely with the approved franchise partner.</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Login ID</label>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">{franchiseLoginId || "Not provided by API"}</code>
                          {franchiseLoginId && (
                            <button type="button" aria-label="Copy login ID" onClick={() => void copyCredential(franchiseLoginId, "Login ID")} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
                              <Copy size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label htmlFor="franchise-login-password" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            id="franchise-login-password"
                            type={showCredentialPassword ? "text" : "password"}
                            readOnly
                            autoComplete="off"
                            value={showCredentialPassword ? credentials?.password ?? "" : ""}
                            placeholder={credentials?.password ? "••••••••" : "Not provided by API"}
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                          />
                          {credentials?.password && (
                            <>
                              <button type="button" aria-label={showCredentialPassword ? "Hide password" : "Show password"} onClick={() => setRevealedCredentialFor(showCredentialPassword ? null : franchise._id)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
                                {showCredentialPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                              <button type="button" aria-label="Copy password" onClick={() => void copyCredential(credentials.password, "Password")} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
                                <Copy size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {credentials?.passwordIsMobile && <p className="mt-3 text-xs text-slate-500">The backend confirms the initial password is the registered mobile number.</p>}
                    {credentials?.note && <p className="mt-2 text-xs text-slate-500">{credentials.note}</p>}
                  </>
                ) : (
                  <>
                    {franchiseLoginId && <p className="mt-2 text-sm text-slate-600">Login ID: <code className="font-mono">{franchiseLoginId}</code></p>}
                    <p className="mt-1 text-sm text-amber-700">
                      The detail API did not return credentials. The password cannot be verified, so it is not inferred from PAN or mobile. Refresh details or check the backend approval/login flow.
                    </p>
                  </>
                )}
              </section>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <FileText size={17} className="text-sky-700" />
                <div>
                  <h2 className="font-semibold text-slate-800">Loan applications ({loanCount})</h2>
                  <p className="text-xs text-slate-500">Applications submitted through this franchise · {loans.total} total</p>
                </div>
              </div>
              {loansError && <p className="p-5 text-sm text-red-700" role="alert">{loansError}</p>}
              {!loansError && loans.products.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-500">No loan applications found for this franchise.</p>
              )}
              {loans.products.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {loans.products.map((product) => (
                    <div key={product.product}>
                      <h3 className="bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
                        {product.product} <span className="ml-1 text-xs font-normal text-slate-500">({product.loans.length})</span>
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px] text-left text-sm">
                          <thead className="text-xs uppercase text-slate-500">
                            <tr>
                              <th className="px-5 py-3">Applicant</th>
                              <th className="px-4 py-3">Amount</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Submitted</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {product.loans.map((loan: FranchiseLoan) => (
                              <tr key={loan._id}>
                                <td className="px-5 py-3">
                                  <p className="font-medium text-slate-800">{loan.fullName || "—"}</p>
                                  <p className="text-xs text-slate-500">{loan.mobile || loan.email || ""}</p>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{Number.isFinite(loan.loanAmount) ? formatCurrency(loan.loanAmount) : "—"}</td>
                                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(loan.status)}`}>{loan.status || "—"}</span></td>
                                <td className="px-4 py-3 text-slate-500">{formatDate(loan.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        {confirmApprove && franchise && (
          <ConfirmDialog
            title="Approve franchise application?"
            message="The backend will create the franchise login ID and set the initial password to the registered mobile. Any credentials returned by the backend will appear on the detail page."
            confirmLabel="Approve application"
            danger={false}
            isSubmitting={actionLoading}
            onConfirm={() => void handleApprove()}
            onCancel={() => setConfirmApprove(false)}
          />
        )}
        {confirmResetPassword && franchise && (
          <ConfirmDialog
            title="Reset franchise password?"
            message="The backend will set the password to the franchise's registered mobile number."
            confirmLabel="Reset password"
            danger={false}
            isSubmitting={actionLoading}
            onConfirm={() => void handleResetPassword()}
            onCancel={() => setConfirmResetPassword(false)}
          />
        )}
        {showReject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !actionLoading && setShowReject(false)}>
            <form onSubmit={(event) => void handleReject(event)} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <h2 className="text-lg font-semibold text-slate-800">Reject franchise application</h2>
              <p className="mt-1 text-sm text-slate-500">Add an optional note explaining why this application is being rejected.</p>
              <textarea
                autoFocus
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Application details require correction"
                className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={actionLoading} onClick={() => setShowReject(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={actionLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {actionLoading ? "Please wait..." : "Reject application"}
                </button>
              </div>
            </form>
          </div>
        )}
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: ACTIVE_BACKGROUND }}>
            <Building2 size={19} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Franchise applications</h1>
            <p className="text-sm text-slate-500">Review registered franchises and submitted applications</p>
          </div>
        </div>
        <button onClick={() => setRefreshKey((key) => key + 1)} disabled={listLoading} className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:self-auto">
          <RefreshCw size={14} className={listLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <form onSubmit={submitSearch} className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, city, or application..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500" />
        </form>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500">
          <option value="All">All statuses</option><option value="None">Registered (not applied)</option><option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option>
        </select>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {listError && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{listError}</div>}
        {listLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Loading applications...</div>
        ) : listError ? null : franchises.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500"><Clock3 size={22} className="mx-auto mb-2 text-slate-300" />No franchise applications found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Franchise</th>
                    <th className="px-4 py-3">Login ID</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Registered</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {franchises.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <Link to={`/franchises/${encodeURIComponent(item._id)}`} className="font-semibold text-sky-800 hover:underline">{displayName(item)}</Link>
                        <p className="mt-0.5 text-xs text-slate-400">{item.contactPerson || item.name || item.fullName || " "}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.franchiseId || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{item.mobile || item.phone || item.email || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{[item.city, item.state, item.country].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(item.status)}`}>{statusLabel(item.status)}</span></td>
                      <td className="px-4 py-3"><Link to={`/franchises/${encodeURIComponent(item._id)}`} className="text-xs font-semibold text-sky-700 hover:underline">View details</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              <p className="text-xs text-slate-500">Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} franchises</p>
              <div className="flex items-center gap-2">
                <button aria-label="Previous page" disabled={page <= 1 || listLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={17} /></button>
                <span className="text-xs text-slate-600">Page {page} of {totalPages}</span>
                <button aria-label="Next page" disabled={page >= totalPages || listLoading} onClick={() => setPage((value) => value + 1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={17} /></button>
              </div>
            </div>
          </>
        )}
      </section>
    </AdminLayout>
  );
};

export default FranchiseApplications;
