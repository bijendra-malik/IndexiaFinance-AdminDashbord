import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, FileText, Gauge,
  LoaderCircle, RefreshCw, Search, ShieldCheck, Trash2, Users, XCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { SUPPORTED_LOAN_SLUGS, findLoanByApplicationNo } from "../../api/personalLoans";
import { resolveLoanSlug } from "../../constants/loanTypes";
import {
  deleteFranchiseCustomer, getApiErrorMessage, getFranchiseCustomer, getFranchiseCustomers,
  getFranchiseCustomerStats, type FranchiseCustomerStats,
  type FranchiseCustomer as FranchiseCustomerRecord,
  type FranchiseCustomerLoan,
} from "../../api/franchiseCustomers";
import Pagination from "../../components/common/Pagination";

const PAGE_SIZE = 20;
const ACTIVE_BACKGROUND = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const titleCase = (value?: string) =>
  value ? value.replace(/([a-z])([A-Z])/g, "$1 $2") : "—";

const statusClass = (status?: string) => {
  switch (status) {
    case "Checked": return "bg-emerald-50 text-emerald-700";
    case "Failed":  return "bg-red-50 text-red-700";
    default:        return "bg-slate-100 text-slate-600";
  }
};

/**
 * Ek loan application ka open link. Backend id deta hai to seedha application
 * khulta hai; sirf application number mila to list se id resolve hoti hai.
 * List ke "View loans" panel aur detail table dono yahi use karte hain.
 */
const ApplicationLink = ({
  product, application, onOpenByNo, openingKey,
}: {
  product: string;
  application: FranchiseCustomerLoan;
  onOpenByNo: (slug: string, applicationNo: string) => void;
  openingKey: string | null;
}) => {
  const slug = application.slug || resolveLoanSlug(product);
  const appId = application._id || application.applicationId || application.id;
  const applicationNo = application.applicationNo ?? "";
  if (!SUPPORTED_LOAN_SLUGS.has(slug)) return <>{applicationNo || "—"}</>;

  if (appId) {
    return (
      <Link
        to={`/applications/${slug}/${encodeURIComponent(appId)}`}
        title="Open this loan application"
        className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[rgb(6,106,156)] hover:underline"
      >
        {applicationNo || appId.slice(-8)}
        <ArrowUpRight size={12} aria-hidden />
      </Link>
    );
  }
  if (!applicationNo) return <>—</>;

  const openKey = `${slug}:${applicationNo}`;
  return (
    <button
      type="button"
      onClick={() => onOpenByNo(slug, applicationNo)}
      disabled={openingKey === openKey}
      title="Find and open this loan application"
      className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[rgb(6,106,156)] hover:underline disabled:opacity-60"
    >
      {applicationNo}
      {openingKey === openKey ? (
        <LoaderCircle size={12} className="animate-spin" aria-hidden />
      ) : (
        <ArrowUpRight size={12} aria-hidden />
      )}
    </button>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="mt-1 break-words text-sm text-slate-700">{children || "—"}</dd>
  </div>
);

/**
 * Aggregated funnel columns the stats endpoint USED to return. Every column is
 * optional in the payload now, so the overview only renders the ones the live
 * response actually carries (`total` is the only guaranteed number).
 */
type FunnelColumnKey =
  | "consented"
  | "notChecked"
  | "checked"
  | "failed"
  | "eligible"
  | "locked"
  | "checkedLocked";

const FUNNEL_COLUMNS: { key: FunnelColumnKey; label: string }[] = [
  { key: "consented", label: "Consented" },
  { key: "notChecked", label: "Not checked" },
  { key: "checked", label: "Checked" },
  { key: "failed", label: "Failed" },
  { key: "eligible", label: "Eligible" },
  { key: "locked", label: "Locked" },
  { key: "checkedLocked", label: "Checked locked" },
];

const FranchiseCustomers = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuperAdmin, accessibleLoanTypes } = useAuth();
  const { showToast } = useToast();
  /* Delete sirf super admin ka — franchise admin ke liye ye page read-only hai. */
  const [pendingDelete, setPendingDelete] = useState<
    { id: string; name: string; fromDetail: boolean } | null
  >(null);
  const [deleting, setDeleting] = useState(false);
  /* Application id na aaye to number se resolve karke usi loan par jaate hain. */
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  /* List me loan product names aur "View loans" panel — detail se per customer cache. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isStatsPage = location.pathname === "/franchise-customers/stats";

  const [searchParams, setSearchParams] = useSearchParams();
  // A franchise detail page can deep-link here as /franchise-customers?franchise=<code|id>
  const franchiseParam = searchParams.get("franchise") ?? "";

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [franchise, setFranchise] = useState(franchiseParam);
  const [appliedFranchise, setAppliedFranchise] = useState(franchiseParam);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [loanInfo, setLoanInfo] = useState<Record<string, {
    data: Awaited<ReturnType<typeof getFranchiseCustomer>> | null;
    error: string;
  }>>({});
  const requestedLoans = useRef<Set<string>>(new Set());

  const loadLoans = useCallback((customerId: string) => {
    /* Key me refresh count — refresh par names/loans dobara load hote hain. */
    const key = `${refreshKey}:${customerId}`;
    if (requestedLoans.current.has(key)) return;
    requestedLoans.current.add(key);
    setLoanInfo((current) => ({ ...current, [key]: { data: null, error: "" } }));
    getFranchiseCustomer(customerId)
      .then((data) => setLoanInfo((current) => ({ ...current, [key]: { data, error: "" } })))
      .catch((error: unknown) => setLoanInfo((current) => ({
        ...current,
        [key]: { data: null, error: getApiErrorMessage(error, "Unable to load this customer's loans.") },
      })));
  }, [refreshKey]);

  const [list, setList] = useState<{
    key: string;
    result: Awaited<ReturnType<typeof getFranchiseCustomers>> | null;
    error: string;
  } | null>(null);
  const [stats, setStats] = useState<{ key: number; data: FranchiseCustomerStats | null; error: string }>({
    key: -1, data: null, error: "",
  });
  const [detail, setDetail] = useState<{
    key: string;
    data: Awaited<ReturnType<typeof getFranchiseCustomer>> | null;
    error: string;
  } | null>(null);

  const listKey = `${appliedSearch}:${appliedFranchise}:${page}:${refreshKey}`;

  useEffect(() => {
    if (id || isStatsPage) return;
    let cancelled = false;
    getFranchiseCustomers({
      search: appliedSearch || undefined,
      franchise: appliedFranchise || undefined,
      page,
      limit: PAGE_SIZE,
    }).then((result) => {
      if (!cancelled) setList({ key: listKey, result, error: "" });
    }).catch((error: unknown) => {
      if (!cancelled) setList({
        key: listKey,
        result: null,
        error: getApiErrorMessage(error, "Unable to load franchise customers."),
      });
    });
    return () => { cancelled = true; };
  }, [appliedFranchise, appliedSearch, id, isStatsPage, listKey, page, refreshKey]);

  useEffect(() => {
    if (!isStatsPage) return;
    let cancelled = false;
    getFranchiseCustomerStats().then((data) => {
      if (!cancelled) setStats({ key: refreshKey, data, error: "" });
    }).catch((error: unknown) => {
      if (!cancelled) setStats({
        key: refreshKey,
        data: null,
        error: getApiErrorMessage(error, "Unable to load CIBIL statistics."),
      });
    });
    return () => { cancelled = true; };
  }, [isStatsPage, refreshKey]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const key = `${id}:${refreshKey}`;
    getFranchiseCustomer(id).then((data) => {
      if (!cancelled) setDetail({ key, data, error: "" });
    }).catch((error: unknown) => {
      if (!cancelled) setDetail({
        key,
        data: null,
        error: getApiErrorMessage(error, "Unable to load this franchise customer."),
      });
    });
    return () => { cancelled = true; };
  }, [id, refreshKey]);

  const currentList = list?.key === listKey ? list : null;
  const currentDetailKey = id ? `${id}:${refreshKey}` : "";
  const currentDetail = detail?.key === currentDetailKey ? detail : null;

  /* List payload product names nahi bhejta, isliye har visible row ka detail ek baar. */
  useEffect(() => {
    const rows = currentList?.result?.customers;
    if (!rows?.length) return;
    rows.forEach((customer) => loadLoans(customer._id));
  }, [currentList, loadLoans]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
    setAppliedFranchise(franchise.trim());
  };

  const clearFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setFranchise("");
    setAppliedFranchise("");
    setPage(1);
    if (franchiseParam) setSearchParams({}, { replace: true });
  };

  // Keep the deep-linked franchise filter in sync when the URL changes.
  // Adjusted during render (not in an effect) so the change is applied before the next fetch.
  const [lastFranchiseParam, setLastFranchiseParam] = useState(franchiseParam);
  if (lastFranchiseParam !== franchiseParam) {
    setLastFranchiseParam(franchiseParam);
    setFranchise(franchiseParam);
    setAppliedFranchise(franchiseParam);
    setPage(1);
  }

  const refresh = () => setRefreshKey((key) => key + 1);

  /**
   * Product group se slug guess galat ho sakta hai, isliye pehle wahi product,
   * phir assigned products me application number search hota hai.
   */
  const openByApplicationNo = async (slug: string, applicationNo: string) => {
    const key = `${slug}:${applicationNo}`;
    if (openingKey) return;
    setOpeningKey(key);
    try {
      const found = await findLoanByApplicationNo(applicationNo, [
        slug,
        ...accessibleLoanTypes.map((loan) => loan.slug),
      ]);
      if (found?.loan._id) {
        navigate(`/applications/${found.slug}/${encodeURIComponent(found.loan._id)}`);
      } else {
        showToast(`Application ${applicationNo} was not found in the applications API.`, "error");
      }
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, "Unable to open this application."), "error");
    } finally {
      setOpeningKey(null);
    }
  };

  /** Row ka loans panel toggle; detail ek hi baar load hota hai. */
  const toggleLoans = (customerId: string) => {
    setExpandedId((current) => (current === customerId ? null : customerId));
    loadLoans(customerId);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteFranchiseCustomer(pendingDelete.id);
      showToast("Franchise customer deleted.", "success");
      const { fromDetail } = pendingDelete;
      setPendingDelete(null);
      if (fromDetail) navigate("/franchise-customers");
      else refresh();
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, "Unable to delete this franchise customer."), "error");
    } finally {
      setDeleting(false);
    }
  };

  /* List aur detail dono wahi confirm dialog use karte hain. */
  const deleteDialog = pendingDelete ? (
    <ConfirmDialog
      title={`Delete ${pendingDelete.name}?`}
      message="This franchise customer and their CIBIL audit trail will be removed. This cannot be undone."
      confirmLabel="Delete"
      danger
      isSubmitting={deleting}
      onCancel={() => setPendingDelete(null)}
      onConfirm={() => void confirmDelete()}
    />
  ) : null;

  if (id) {
    const record = currentDetail?.data?.customer;
    const recordName = record?.fullName || record?.mobile || "this franchise customer";
    const owner = currentDetail?.data?.franchise;
    const loans = currentDetail?.data?.loans;
    const cibil = record?.cibil;
    return (
      <AdminLayout>
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link to="/franchise-customers" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={16} /> Franchise customers
          </Link>
          <div className="flex items-center gap-2">
            {isSuperAdmin && id && (
              <button
                type="button"
                onClick={() => setPendingDelete({ id, name: recordName, fromDetail: true })}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button type="button" onClick={refresh} disabled={!currentDetail} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
        {!currentDetail && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Loading customer report...</div>
        )}
        {currentDetail?.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{currentDetail.error}</div>}
        {record && (
          <>
            <div className="mb-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row">
              <div>
                <h1 className="text-xl font-bold text-slate-800">{record.fullName || "Franchise customer"}</h1>
                <p className="mt-1 text-sm text-slate-500">{record.mobile || "—"}{record.email ? ` · ${record.email}` : ""}</p>
              </div>
              {(cibil?.status || record.loanForm) && (
                <div className="flex flex-wrap items-start gap-2">
                  {cibil?.status && (
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(cibil.status)}`}>{titleCase(cibil.status)}</span>
                  )}
                  {record.loanForm && (
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${record.loanForm.locked ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {record.loanForm.locked ? "Loan form locked" : "Loan form unlocked"}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-800"><ShieldCheck size={17} className="text-sky-700" /> Customer & franchise</h2>
                <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  <Field label="Full name">{record.fullName}</Field>
                  <Field label="Mobile">{record.mobile}</Field>
                  <Field label="Email">{record.email}</Field>
                  <Field label="PAN">{record.panNumber}</Field>
                  <Field label="Date of birth">{formatDate(record.dob)}</Field>
                  {record.cibilConsentAt && <Field label="Consent recorded">{formatDate(record.cibilConsentAt)}</Field>}
                  <Field label="Franchise">{owner?.name}</Field>
                  <Field label="Franchise code">{owner?.franchiseId || record.franchiseCode}</Field>
                  <Field label="Franchise status">{owner?.franchiseStatus}</Field>
                </dl>
              </section>

              {record.cibil && (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-800"><Gauge size={17} className="text-sky-700" /> CIBIL report</h2>
                <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  <Field label="Score">{cibil?.score ?? "—"}</Field>
                  <Field label="Score band">{cibil?.band?.label}</Field>
                  <Field label="Provider">{cibil?.provider}</Field>
                  <Field label="Reference ID">{cibil?.referenceId}</Field>
                  <Field label="Checked at">{formatDate(cibil?.checkedAt)}</Field>
                  <Field label="Expires at">{formatDate(cibil?.expiresAt)}</Field>
                  <Field label="Eligibility threshold">{cibil?.threshold ?? "—"}</Field>
                  <Field label="Loan form">{record.loanForm?.canApplyLoan ? "Eligible" : "Not eligible"}</Field>
                </dl>
                {(cibil?.reason || cibil?.failureReason || record.loanForm?.reason) && (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    {cibil?.reason || record.loanForm?.reason || cibil?.failureReason}
                  </p>
                )}
                <p className="mt-4 text-xs text-slate-400">Read-only audit view. CIBIL checks cannot be initiated here.</p>
              </section>
              )}
            </div>

            <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <FileText size={17} className="text-sky-700" />
                <h2 className="font-semibold text-slate-800">Loan applications ({loans?.total ?? 0})</h2>
              </div>
              <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
                {Object.entries(loans?.byStatus ?? {}).map(([status, count]) => (
                  <span key={status} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{status}: {count}</span>
                ))}
              </div>
              {!loans?.data?.length ? (
                <p className="p-8 text-center text-sm text-slate-500">No loan applications found for this customer.</p>
              ) : loans.data.map((group) => (
                <div key={group.product} className="border-b border-slate-100 last:border-b-0">
                  <h3 className="bg-slate-50 px-5 py-3 text-sm font-semibold capitalize text-slate-700">{titleCase(group.product)} <span className="ml-1 text-xs font-normal">({group.count})</span></h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-5 py-2">Application</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2">Stage</th>
                          <th className="px-4 py-2">Step</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.applications.map((application, index) => (
                            <tr key={application._id || application.applicationId || application.id || application.applicationNo || `${group.product}-${index}`}>
                              <td className="px-5 py-3 font-mono text-xs text-slate-700">
                                <ApplicationLink
                                  product={group.product}
                                  application={application}
                                  onOpenByNo={openByApplicationNo}
                                  openingKey={openingKey}
                                />
                              </td>
                              <td className="px-4 py-3 text-slate-600">{application.status || "—"}</td>
                              <td className="px-4 py-3 text-slate-600">{application.stage || "—"}</td>
                              <td className="px-4 py-3 text-slate-600">{application.step ?? "—"}</td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {deleteDialog}
      </AdminLayout>
    );
  }

  if (isStatsPage) {
    const statsLoading = stats.key !== refreshKey;
    const data = statsLoading ? null : stats.data;
    const statsError = statsLoading ? "" : stats.error;
    // Funnel aggregates are optional in the payload now — render only the
    // columns the live response actually carries instead of empty cells.
    const funnelColumns = FUNNEL_COLUMNS.filter(({ key }) =>
      Boolean(data && data.byFranchise.some((row) => typeof row[key] === "number"))
    );
    const metrics: { label: string; value: number | string; icon: typeof Users; bgClass: string; iconClass: string; labelClass: string }[] = data
      ? [
          { label: "Total customers",    value: data.total,               icon: Users,        bgClass: "bg-sky-50",     iconClass: "text-sky-600",     labelClass: "text-sky-700"     },
          { label: "Franchises covered", value: data.byFranchise.length,  icon: FileText,     bgClass: "bg-violet-50",  iconClass: "text-violet-600",  labelClass: "text-violet-700"  },
          ...(typeof data.consented  === "number" ? [{ label: "Consent recorded",   value: data.consented,  icon: ShieldCheck,  bgClass: "bg-violet-50",  iconClass: "text-violet-600",  labelClass: "text-violet-700"  }] : []),
          ...(typeof data.checked    === "number" ? [{ label: "Reports checked",    value: data.checked,    icon: CheckCircle2, bgClass: "bg-emerald-50", iconClass: "text-emerald-600", labelClass: "text-emerald-700" }] : []),
          ...(typeof data.eligible   === "number" ? [{ label: "Eligible / unlocked",value: data.eligible,   icon: Gauge,        bgClass: "bg-teal-50",    iconClass: "text-teal-600",    labelClass: "text-teal-700"    }] : []),
          ...(typeof data.notChecked === "number" ? [{ label: "Not checked",        value: data.notChecked, icon: Clock3,       bgClass: "bg-slate-100",  iconClass: "text-slate-500",   labelClass: "text-slate-600"   }] : []),
          ...(typeof data.failed     === "number" ? [{ label: "Failed checks",      value: data.failed,     icon: XCircle,      bgClass: "bg-red-50",     iconClass: "text-red-600",     labelClass: "text-red-700"     }] : []),
          ...(typeof data.locked     === "number" ? [{ label: "Locked",             value: data.locked,     icon: ShieldCheck,  bgClass: "bg-amber-50",   iconClass: "text-amber-600",   labelClass: "text-amber-700"   }] : []),
          ...(typeof data.checkedLocked === "number" ? [{ label: "Checked but locked", value: data.checkedLocked, icon: Gauge, bgClass: "bg-orange-50",  iconClass: "text-orange-600",  labelClass: "text-orange-700"  }] : []),
        ]
      : [];
    return (
      <AdminLayout>
        <PageHeader icon={Users} title="Franchise customer overview" subtitle="Network-wide customer count, franchise by franchise"
          onRefresh={refresh} refreshing={statsLoading} />
        {statsError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{statsError}</div>}
        {statsLoading && <div className="flex items-center justify-center gap-2 py-12 text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Loading customer statistics...</div>}
        {data && (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((m) => (
                <StatCard key={m.label} label={m.label} value={m.value} icon={m.icon} bgClass={m.bgClass} iconClass={m.iconClass} labelClass={m.labelClass} />
              ))}
            </div>
            {typeof data.threshold === "number" && (
              <p className="mb-4 text-xs text-slate-500">Loan eligibility threshold: {data.threshold}</p>
            )}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold text-slate-800">Franchise-wise customer count</h2>
              </div>
              {!data.byFranchise.length ? (
                <p className="p-8 text-center text-sm text-slate-500">No franchise customers found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>{["Franchise", "Customers", "Loans", "Share", ...funnelColumns.map((column) => column.label)].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.byFranchise.map((row, index) => (
                        <tr key={row.franchise?._id || `franchise-${index}`}>
                          <td className="px-4 py-3">
                            {row.franchise?._id ? (
                              <Link className="font-medium text-sky-800 hover:underline" to={`/franchises/${encodeURIComponent(row.franchise._id)}`}>
                                {row.franchise.name || row.franchise.franchiseId || "Franchise"}
                              </Link>
                            ) : "Franchise deleted"}
                            {row.franchise?.franchiseId && <p className="mt-0.5 text-xs text-slate-400">{row.franchise.franchiseId}</p>}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">{row.total}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {row.loans?.total ? (
                              <>
                                <span className="font-semibold text-slate-700">{row.loans.total}</span>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  {row.loans.byProduct
                                    .map((entry) => `${entry.product} ${entry.count}`)
                                    .join(" · ")}
                                </p>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{data.total > 0 ? `${((row.total / data.total) * 100).toFixed(1)}%` : "—"}</td>
                          {funnelColumns.map(({ key }) => {
                            const count = row[key];
                            return <td key={key} className="px-4 py-3 text-slate-600">{typeof count === "number" ? count : "—"}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </AdminLayout>
    );
  }

  const result = currentList?.result;
  const customers: FranchiseCustomerRecord[] = result?.customers ?? [];
  const showCibil    = customers.some((c) => Boolean(c.cibil));
  const showLoanForm = customers.some((c) => Boolean(c.loanForm));
  const hasFilters   = !!(appliedSearch || appliedFranchise);
  /* List payload loan names bheje to wahi, warna row ke detail se product names. */
  const loanProductNames = (
    customer: FranchiseCustomerRecord,
    info: Awaited<ReturnType<typeof getFranchiseCustomer>> | null | undefined
  ): string[] => {
    const fromList = customer.loans?.byProduct?.map((entry) => titleCase(entry.product))
      ?? customer.loans?.products?.map(titleCase);
    if (fromList?.length) return fromList;
    return info?.loans.data.map((group) => titleCase(group.product)) ?? [];
  };
  const columnCount = 6 + (showCibil ? 2 : 0) + (showLoanForm ? 1 : 0);
  return (
    <AdminLayout>
      <PageHeader
        icon={Users} title="Franchise customers"
        subtitle="Read-only customer, CIBIL and loan eligibility audit."
        onRefresh={refresh} refreshing={!currentList}
        actions={
          <Link to="/franchise-customers/stats"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Customer stats
          </Link>
        }
      />
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, mobile, PAN, or email" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
          </div>
          <input value={franchise} onChange={(event) => setFranchise(event.target.value)} placeholder="Franchise FRN code or ID" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
          <div className="flex justify-end">
            <button type="submit" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110" style={{ background: ACTIVE_BACKGROUND }}>Apply</button>
          </div>
        </form>
        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {appliedFranchise && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                Franchise: <span className="font-mono">{appliedFranchise}</span>
              </span>
            )}
            {appliedSearch && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Search: {appliedSearch}
              </span>
            )}
            <button type="button" onClick={clearFilters} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
              Clear filters
            </button>
          </div>
        )}
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {currentList?.error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{currentList.error}</div>}
        {!currentList ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Loading franchise customers...</div>
        ) : currentList.error ? null : !customers.length ? (
          <div className="py-16 text-center text-sm text-slate-500">{hasFilters ? "No customers match these filters." : "No franchise customers found."}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>{["Customer", "Franchise", "PAN", ...(showCibil ? ["CIBIL", "Score"] : []), ...(showLoanForm ? ["Loan form"] : []), "Loans", "Last applied", ""].map((label, index) => <th key={`${label}-${index}`} className="px-4 py-3">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((customer) => {
                    const info = loanInfo[`${refreshKey}:${customer._id}`];
                    const productNames = loanProductNames(customer, info?.data);
                    return (
                    <Fragment key={customer._id}>
                    <tr className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <Link to={`/franchise-customers/${encodeURIComponent(customer._id)}`} className="font-semibold text-sky-800 hover:underline">{customer.fullName || "Customer"}</Link>
                        <p className="mt-0.5 text-xs text-slate-500">{customer.mobile || customer.email || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{customer.franchise?.name || customer.franchise?.franchiseId || "Franchise deleted"}<p className="mt-0.5 text-xs text-slate-400">{customer.franchise?.franchiseId || customer.franchiseCode || ""}</p></td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{customer.panNumber || "—"}</td>
                      {showCibil && <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(customer.cibil?.status)}`}>{titleCase(customer.cibil?.status)}</span></td>}
                      {showCibil && <td className="px-4 py-3 text-slate-600">{customer.cibil?.score ?? "—"}</td>}
                      {showLoanForm && <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${customer.loanForm?.locked ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{customer.loanForm?.locked ? "Locked" : "Unlocked"}</span></td>}
                      <td className="px-4 py-3 text-slate-600">
                        <span className="font-semibold text-slate-700">{customer.loans?.count ?? 0}</span>
                        {productNames.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-slate-400">{productNames.join(" · ")}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(customer.loans?.lastAppliedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLoans(customer._id)}
                            aria-expanded={expandedId === customer._id}
                            title="See which loans this customer applied for"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            <FileText size={13} />
                            {expandedId === customer._id ? "Hide loans" : "View loans"}
                          </button>
                          <Link to={`/franchise-customers/${encodeURIComponent(customer._id)}`} className="text-xs font-semibold text-sky-700 hover:underline">Audit</Link>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => setPendingDelete({ id: customer._id, name: customer.fullName || customer.mobile || "this franchise customer", fromDetail: false })}
                              aria-label={`Delete ${customer.fullName || customer._id}`}
                              title="Delete franchise customer"
                              className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === customer._id && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={columnCount} className="px-4 pb-4 pt-1">
                          {!info ? null : !info.data && !info.error ? (
                            <p className="flex items-center gap-2 text-sm text-slate-500">
                              <LoaderCircle size={14} className="animate-spin" /> Loading loans...
                            </p>
                          ) : info.error ? (
                            <p className="text-sm text-red-600">{info.error}</p>
                          ) : !info.data?.loans.data.length ? (
                            <p className="text-sm text-slate-500">No loan applications found for this customer.</p>
                          ) : (
                            <div className="space-y-3">
                              {info.data!.loans.data.map((group) => (
                                <div key={group.product}>
                                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                    {titleCase(group.product)}{" "}
                                    <span className="font-normal">({group.count})</span>
                                  </p>
                                  <div className="mt-1.5 flex flex-wrap gap-2">
                                    {group.applications.map((application, index) => (
                                      <span
                                        key={application._id || application.applicationId || application.id || application.applicationNo || `${group.product}-${index}`}
                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                                      >
                                        <ApplicationLink
                                          product={group.product}
                                          application={application}
                                          onOpenByNo={openByApplicationNo}
                                          openingKey={openingKey}
                                        />
                                        <span className="text-[11px] text-slate-400">{application.status || "—"}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={result!.page}
              totalPages={result!.totalPages}
              total={result!.total}
              pageSize={result!.limit}
              onPage={setPage}
              itemLabel="customers"
            />
          </>
        )}
      </section>

      {deleteDialog}
    </AdminLayout>
  );
};

export default FranchiseCustomers;
