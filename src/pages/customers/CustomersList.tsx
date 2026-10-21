import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check, Eye, LoaderCircle, RefreshCw, Search,
  ToggleLeft, ToggleRight, Trash2, Users, X,
  UserCheck, UserX, TrendingUp, ChevronRight,
  Mail, Phone, MapPin, Calendar, Clock, Shield,
  AlertCircle, FileText, BadgeCheck, Banknote,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import FilterSelect from "../../components/common/FilterSelect";
import Pagination from "../../components/common/Pagination";
import { useToast } from "../../context/ToastContext";
import {
  deleteCustomer,
  getApiErrorMessage,
  getCustomer,
  getCustomerApplications,
  getCustomers,
  updateCustomerStatus,
  type Customer,
  type CustomerApplicationGroup,
} from "../../api/customers";
import {
  MINIMUM_CREDIT_SCORE,
  SUPPORTED_LOAN_SLUGS,
  updateLoanStatusBySlug,
  type LoanStatus,
  type PersonalLoan,
} from "../../api/personalLoans";
import { getLoanTypeLabel } from "../../constants/loanTypes";

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatCurrency = (amount?: number) =>
  amount == null
    ? "Amount not provided"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(amount);

const PRODUCT_SLUGS: Record<string, string> = {
  personal: "personal-loan",
  business: "business-loan",
  home: "home-loan",
  lap: "loan-against-property",
  balanceTransfer: "balance-transfer",
  projectLoan: "project-loan",
  vehicleLoan: "car-loan",
  educationLoan: "education-loan",
  creditCard: "credit-card",
  workingCapital: "working-capital",
  commercialPurchase: "commercial-purchase",
  leaseRentalDiscounting: "lease-rental-discounting",
  odCcLimit: "odcc-limit",
  loanAgainstShare: "loan-against-share",
  npaLoan: "npa-loan",
  goldLoan: "gold-loan",
  fdiLoan: "fdi-loan",
  filmFunding: "film-funding",
};

const OPEN_STATUSES = new Set(["Submitted", "Pending"]);
const PAGE_SIZE = 20;
const BRAND_GRADIENT = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";

const statusConfig = {
  Approved: { dot: "bg-emerald-500", badge: "border-emerald-100 bg-emerald-50 text-emerald-700" },
  Rejected: { dot: "bg-red-500", badge: "border-red-100 bg-red-50 text-red-700" },
  Pending: { dot: "bg-amber-500", badge: "border-amber-100 bg-amber-50 text-amber-700" },
  Submitted: { dot: "bg-sky-500", badge: "border-sky-100 bg-sky-50 text-sky-700" },
};

const getStatusConfig = (status: string) =>
  statusConfig[status as keyof typeof statusConfig] ?? statusConfig.Submitted;

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({
  label,
  value,
  icon: Icon,
  tone,
  subtext,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: { bg: string; icon: string; text: string };
  subtext?: string;
}) => (
  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.bg}`}>
      <Icon size={20} className={tone.icon} />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-extrabold leading-none text-slate-900">{value}</p>
      <p className={`mt-1 text-xs font-semibold ${tone.text}`}>{label}</p>
      {subtext && <p className="mt-0.5 text-[10px] text-slate-400">{subtext}</p>}
    </div>
  </div>
);

// ── Customer avatar initials ──────────────────────────────────────────────────
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

// ── Component ─────────────────────────────────────────────────────────────────
const CustomersList = () => {
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [updatingCustomerId, setUpdatingCustomerId] = useState<string | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [customerDetail, setCustomerDetail] = useState<Customer | null>(null);
  const [customerDetailError, setCustomerDetailError] = useState("");
  const [applicationGroups, setApplicationGroups] = useState<CustomerApplicationGroup[] | null>(
    null
  );
  const [applicationsError, setApplicationsError] = useState("");
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [applicationsRefreshKey, setApplicationsRefreshKey] = useState(0);
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{
    group: CustomerApplicationGroup;
    application: PersonalLoan;
    status: Extract<LoanStatus, "Pending" | "Approved" | "Rejected">;
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async () => {
    setError("");
    try {
      const data = await getCustomers({
        search: appliedSearch || undefined,
        isActive: activeFilter === "all" ? undefined : activeFilter === "active",
      });
      setCustomers(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load customers."));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load();
  }, [appliedSearch, activeFilter]);

  const viewingCustomerId = viewingCustomer?._id;

  useEffect(() => {
    if (!viewingCustomerId) return;
    let cancelled = false;
    Promise.allSettled([
      getCustomer(viewingCustomerId),
      getCustomerApplications(viewingCustomerId),
    ]).then(([customerResult, applicationsResult]) => {
      if (cancelled) return;
      if (customerResult.status === "fulfilled") {
        setCustomerDetail(customerResult.value);
      } else {
        setCustomerDetailError(
          getApiErrorMessage(
            customerResult.reason,
            "Unable to load this customer's details."
          )
        );
      }
      if (applicationsResult.status === "fulfilled") {
        setApplicationGroups(applicationsResult.value);
      } else {
        setApplicationsError(
          getApiErrorMessage(
            applicationsResult.reason,
            "Unable to load this customer's applications."
          )
        );
      }
      setIsLoadingApplications(false);
    });
    return () => {
      cancelled = true;
    };
  }, [viewingCustomerId, applicationsRefreshKey]);

  const applications = applicationGroups?.flatMap((g) => g.applications) ?? [];
  const openApplications = applications.filter((a) => OPEN_STATUSES.has(a.status));

  const sortedApplicationGroups = useMemo(() => {
    if (!applicationGroups) return null;
    const createdAtMs = (a?: PersonalLoan) => {
      const t = a?.createdAt ? new Date(a.createdAt).getTime() : NaN;
      return Number.isNaN(t) ? 0 : t;
    };
    const newestFirst = (l: PersonalLoan, r: PersonalLoan) => createdAtMs(r) - createdAtMs(l);
    return applicationGroups
      .map((g) => ({ ...g, applications: [...g.applications].sort(newestFirst) }))
      .sort(
        (l, r) => createdAtMs(r.applications[0]) - createdAtMs(l.applications[0])
      );
  }, [applicationGroups]);

  const canDeleteCustomer =
    applicationGroups !== null &&
    !applicationsError &&
    openApplications.length === 0 &&
    !isLoadingApplications;

  const openCustomerDetails = (customer: Customer) => {
    setCustomerDetail(null);
    setCustomerDetailError("");
    setApplicationGroups(null);
    setApplicationsError("");
    setIsLoadingApplications(true);
    setViewingCustomer(customer);
  };

  const closeCustomerDetails = () => {
    if (isDeleting || updatingApplicationId) return;
    setViewingCustomer(null);
    setCustomerDetail(null);
    setCustomerDetailError("");
    setApplicationGroups(null);
    setApplicationsError("");
    setIsLoadingApplications(false);
  };

  const retryApplications = () => {
    setCustomerDetail(null);
    setCustomerDetailError("");
    setApplicationGroups(null);
    setApplicationsError("");
    setIsLoadingApplications(true);
    setApplicationsRefreshKey((k) => k + 1);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteCustomer(pendingDelete._id);
      setCustomers((prev) =>
        prev ? prev.filter((c) => c._id !== pendingDelete._id) : prev
      );
      showToast(`"${pendingDelete.name}" deleted`, "success");
      setPendingDelete(null);
      setViewingCustomer(null);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const message = getApiErrorMessage(err, "Unable to delete this customer.");
      showToast(
        status === 409
          ? `${message} Approve or reject their open applications, then try again.`
          : message,
        "error"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleCustomer = async (customer: Customer) => {
    const isActive = !customer.isActive;
    setUpdatingCustomerId(customer._id);
    try {
      await updateCustomerStatus(customer._id, isActive);
      setCustomers(
        (current) =>
          current?.flatMap((item) => {
            if (item._id !== customer._id) return [item];
            if (activeFilter !== "all" && (activeFilter === "active") !== isActive) return [];
            return [{ ...item, isActive }];
          }) ?? current
      );
      showToast(`Customer ${isActive ? "activated" : "deactivated"}.`, "success");
    } catch (err) {
      showToast(
        getApiErrorMessage(err, "Unable to update this customer's account status."),
        "error"
      );
    } finally {
      setUpdatingCustomerId(null);
    }
  };

  const handleApplicationDecision = async (
    group: CustomerApplicationGroup,
    application: PersonalLoan,
    status: Extract<LoanStatus, "Pending" | "Approved" | "Rejected">,
    note = ""
  ) => {
    const slug = PRODUCT_SLUGS[group.product] ?? application.loanType;
    if (!slug) {
      showToast(`Cannot determine the loan type for application ${application._id}.`, "error");
      return;
    }
    setUpdatingApplicationId(application._id);
    try {
      const updated = await updateLoanStatusBySlug(slug, application._id, status, note.trim());
      setApplicationGroups(
        (current) =>
          current?.map((g) => ({
            ...g,
            applications: g.applications.map((item) =>
              item._id === updated._id ? updated : item
            ),
          })) ?? current
      );
      showToast(`Application marked ${status.toLowerCase()}.`, "success");
    } catch (err) {
      showToast(
        getApiErrorMessage(err, `Unable to ${status.toLowerCase()} this application.`),
        "error"
      );
    } finally {
      setUpdatingApplicationId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.mobile.toLowerCase().includes(q)
    );
  }, [customers, search]);

  // Derived stats
  const totalActive = customers?.filter((c) => c.isActive).length ?? 0;
  const totalInactive = (customers?.length ?? 0) - totalActive;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <AdminLayout>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md"
            style={{ background: BRAND_GRADIENT }}
          >
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Customers</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Manage customer accounts and review their loan applications.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={customers === null && !error}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw size={14} className={customers === null && !error ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      {customers !== null && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Customers"
            value={customers.length}
            icon={Users}
            tone={{ bg: "bg-sky-50", icon: "text-sky-600", text: "text-sky-700" }}
            subtext="All registered accounts"
          />
          <StatCard
            label="Active Accounts"
            value={totalActive}
            icon={UserCheck}
            tone={{ bg: "bg-emerald-50", icon: "text-emerald-600", text: "text-emerald-700" }}
            subtext="Can log in and apply"
          />
          <StatCard
            label="Inactive Accounts"
            value={totalInactive}
            icon={UserX}
            tone={{ bg: "bg-red-50", icon: "text-red-600", text: "text-red-700" }}
            subtext="Temporarily disabled"
          />
          <StatCard
            label="Open Applications"
            value={customers.length > 0 ? "—" : "0"}
            icon={TrendingUp}
            tone={{ bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-700" }}
            subtext="Across all customers"
          />
        </div>
      )}

      {/* ── Table card ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Filter bar */}
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedSearch(search.trim());
              setPage(1);
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search customers</span>
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email or mobile…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearch("");
                    setAppliedSearch("");
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                label="Filter customers by account status"
                value={activeFilter}
                onChange={(v) => {
                  setActiveFilter(v as typeof activeFilter);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: "All accounts" },
                  { value: "active", label: "Active only" },
                  { value: "inactive", label: "Inactive only" },
                ]}
                className="w-40"
              />
              <button
                type="submit"
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                style={{ background: BRAND_GRADIENT }}
              >
                Search
              </button>
              {(appliedSearch || activeFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setAppliedSearch("");
                    setActiveFilter("all");
                    setPage(1);
                  }}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>

            {customers && !error && (
              <p className="shrink-0 text-xs font-medium text-slate-500">
                <span className="font-bold text-slate-700">{filtered.length}</span> /{" "}
                <span className="font-bold text-slate-700">{customers.length}</span> customers
              </p>
            )}
          </form>
        </div>

        {/* Table body states */}
        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <p className="text-sm font-medium text-red-600">{error}</p>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : customers === null ? (
          <div className="space-y-2.5 p-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-[62px] animate-pulse rounded-xl bg-slate-100"
                style={{ opacity: 1 - i * 0.1 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <Users size={22} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700">
              {customers.length === 0 ? "No customers yet" : "No customers match your filters"}
            </p>
            <p className="text-sm text-slate-500">
              {customers.length === 0
                ? "Customers will appear here once they register."
                : "Try adjusting your search or removing the filter."}
            </p>
            {customers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setAppliedSearch("");
                  setActiveFilter("all");
                }}
                className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Customer
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Contact
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Status
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Joined
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Last login
                    </th>
                    <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {paged.map((c) => (
                    <tr key={c._id} className="group transition-colors hover:bg-sky-50/30">
                      {/* Customer identity */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold text-white shadow-sm"
                            style={{ background: BRAND_GRADIENT }}
                          >
                            {initials(c.name)}
                          </div>
                          <div className="min-w-0">
                            <span className="block font-semibold text-slate-800 group-hover:text-sky-700 transition-colors">
                              {c.name}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5">
                              <span className="font-mono text-[10px] text-slate-400">
                                {c.customerId || c._id.slice(-8)}
                              </span>
                              {c.isVerified && (
                                <BadgeCheck size={12} className="text-emerald-500" />
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <Phone size={11} className="shrink-0 text-slate-400" />
                            {c.mobile}
                          </span>
                          <span className="flex items-center gap-1.5 truncate text-xs text-slate-400">
                            <Mail size={11} className="shrink-0" />
                            {c.email}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                            c.isActive
                              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-100 text-slate-600"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              c.isActive ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-slate-500">
                          <Calendar size={12} className="text-slate-400" />
                          {formatDate(c.createdAt)}
                        </span>
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`flex items-center gap-1.5 whitespace-nowrap ${
                            c.lastLogin ? "text-slate-500" : "text-slate-300"
                          }`}
                        >
                          <Clock size={12} className="text-slate-400" />
                          {c.lastLogin ? formatDate(c.lastLogin) : "Never"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openCustomerDetails(c)}
                            aria-label={`View ${c.name}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                          >
                            <Eye size={13} /> View
                          </button>
                          <button
                            onClick={() => void handleToggleCustomer(c)}
                            disabled={updatingCustomerId === c._id}
                            aria-label={`${c.isActive ? "Deactivate" : "Activate"} ${c.name}`}
                            title={c.isActive ? "Deactivate account" : "Activate account"}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                              c.isActive
                                ? "text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                                : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                            }`}
                          >
                            {updatingCustomerId === c._id ? (
                              <LoaderCircle size={14} className="animate-spin" />
                            ) : c.isActive ? (
                              <ToggleRight size={15} />
                            ) : (
                              <ToggleLeft size={15} />
                            )}
                            {c.isActive ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPage={setPage}
              itemLabel="customers"
            />
          </>
        )}
      </div>

      {/* ── Customer detail drawer ───────────────────────────────────────── */}
      {viewingCustomer && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-end bg-slate-950/40 backdrop-blur-[2px]"
          onClick={closeCustomerDetails}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-drawer-title"
            className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl"
            style={{ borderLeft: "1px solid #e2e8f0" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <header className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-white">
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: BRAND_GRADIENT }}
              />
              <div className="flex items-start justify-between gap-4 px-6 pb-5 pt-6">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold text-white shadow-md"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    {initials(viewingCustomer.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Customer profile
                    </p>
                    <h2
                      id="customer-drawer-title"
                      className="mt-1 truncate text-xl font-bold text-slate-900"
                    >
                      {viewingCustomer.name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          viewingCustomer.isActive
                            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            viewingCustomer.isActive ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {viewingCustomer.isActive ? "Active" : "Inactive"}
                      </span>
                      {viewingCustomer.isVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                          <BadgeCheck size={11} /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeCustomerDetails}
                  disabled={isDeleting || Boolean(updatingApplicationId)}
                  aria-label="Close customer details"
                  className="mt-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            {/* Drawer body */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-5 space-y-4">
              {/* Customer detail error */}
              {customerDetailError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-sm">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                  <div>
                    <p className="font-semibold">Could not load customer details</p>
                    <p className="mt-0.5 text-red-600/80">{customerDetailError}</p>
                    <button
                      onClick={retryApplications}
                      className="mt-2 inline-flex items-center gap-1.5 font-semibold underline"
                    >
                      <RefreshCw size={12} /> Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Customer info grid */}
              {customerDetail && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                      <Shield size={15} className="text-sky-600" />
                      Customer details
                    </h3>
                  </div>
                  <dl className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Customer ID
                      </dt>
                      <dd className="mt-1 font-mono text-xs text-slate-700">
                        {customerDetail.customerId || customerDetail._id}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        PAN
                      </dt>
                      <dd className="mt-1 font-mono text-xs text-slate-700">
                        {customerDetail.panNumber || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Mobile
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                        <Phone size={12} className="text-slate-400" />
                        {customerDetail.mobile || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Email
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                        <Mail size={12} className="text-slate-400" />
                        {customerDetail.email || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Location
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                        <MapPin size={12} className="text-slate-400" />
                        {[
                          customerDetail.city,
                          customerDetail.state,
                          customerDetail.country,
                          customerDetail.pincode,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Account
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700">
                        {customerDetail.role} · {customerDetail.isActive ? "Active" : "Inactive"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Registered
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                        <Calendar size={12} className="text-slate-400" />
                        {formatDate(customerDetail.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Last login
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                        <Clock size={12} className="text-slate-400" />
                        {formatDate(customerDetail.lastLogin)}
                      </dd>
                    </div>
                    {customerDetail.package && (
                      <div className="col-span-2">
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Package
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700">{customerDetail.package}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Applications section */}
              {isLoadingApplications ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500 shadow-sm">
                  <LoaderCircle size={24} className="animate-spin text-sky-600" />
                  <span className="text-sm">Loading applications…</span>
                </div>
              ) : applicationsError ? (
                <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
                  <p className="flex items-center gap-2 font-semibold text-red-700">
                    <AlertCircle size={16} /> Could not load applications
                  </p>
                  <p className="mt-1 text-sm text-red-600/90">{applicationsError}</p>
                  <button
                    onClick={retryApplications}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    <RefreshCw size={13} /> Try again
                  </button>
                </div>
              ) : sortedApplicationGroups?.length ? (
                <>
                  {/* Applications summary banner */}
                  <div
                    className={`rounded-2xl border p-4 shadow-sm ${
                      openApplications.length
                        ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
                        : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                          Application review
                        </p>
                        <p className="mt-1 font-bold text-slate-800">
                          {openApplications.length
                            ? `${openApplications.length} application${openApplications.length === 1 ? "" : "s"} awaiting decision`
                            : "All applications decided"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {openApplications.length
                            ? "Review and record a decision for each open application."
                            : "Customer deletion is now available."}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                          openApplications.length
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {openApplications.length ? "Action required" : "Ready to delete"}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-current/10 pt-4">
                      {[
                        { label: "Total", value: applications.length },
                        { label: "Open", value: openApplications.length },
                        { label: "Decided", value: applications.length - openApplications.length },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <p className="text-xl font-extrabold leading-none text-slate-800">
                            {value}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Application groups */}
                  {sortedApplicationGroups.map((group) => (
                    <section
                      key={group.product}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 ring-1 ring-sky-100">
                            <FileText size={15} className="text-sky-600" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">
                              {getLoanTypeLabel(
                                PRODUCT_SLUGS[group.product] ?? group.product
                              )}
                            </h3>
                            <p className="text-[10px] text-slate-400">Loan applications</p>
                          </div>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                          {group.count}
                        </span>
                      </div>

                      <div className="space-y-3 p-3">
                        {group.applications.map((application) => {
                          const isOpen = OPEN_STATUSES.has(application.status);
                          const slug =
                            PRODUCT_SLUGS[group.product] ?? application.loanType;
                          const canReview = isOpen && SUPPORTED_LOAN_SLUGS.has(slug);
                          const cfg = getStatusConfig(application.status);

                          return (
                            <article
                              key={application._id}
                              className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                            >
                              {/* Amount + status */}
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                    Requested amount
                                  </p>
                                  <p className="mt-1 flex items-center gap-1.5 text-lg font-extrabold text-slate-900">
                                    <Banknote size={16} className="text-slate-400" />
                                    {formatCurrency(application.loanAmount)}
                                  </p>
                                </div>
                                <span
                                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${cfg.badge}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                  {application.status}
                                </span>
                              </div>

                              {/* Meta info grid */}
                              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-2.5 sm:grid-cols-3">
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                    Tenure
                                  </p>
                                  <p className="mt-1 text-xs font-semibold text-slate-700">
                                    {application.loanTenure
                                      ? `${application.loanTenure} months`
                                      : "—"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                    Applied
                                  </p>
                                  <p className="mt-1 text-xs font-semibold text-slate-700">
                                    {application.createdAt
                                      ? formatDate(application.createdAt)
                                      : "—"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                    Credit score
                                  </p>
                                  <p className="mt-1 text-xs font-semibold text-slate-700">
                                    {typeof application.creditScore === "number"
                                      ? `${application.creditScore}/900 · ${
                                          (application.creditEligible ??
                                            application.creditScore >= MINIMUM_CREDIT_SCORE)
                                            ? "Eligible"
                                            : "Not eligible"
                                        }`
                                      : "—"}
                                  </p>
                                </div>
                                <div className="col-span-2 border-t border-slate-200/80 pt-2 sm:col-span-3">
                                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                    Application ID
                                  </p>
                                  {SUPPORTED_LOAN_SLUGS.has(slug) ? (
                                    <Link
                                      to={`/applications/${slug}/${application._id}`}
                                      className="mt-1 flex items-center gap-1 font-mono text-[10px] text-sky-700 hover:underline"
                                    >
                                      {application._id}
                                      <ChevronRight size={11} />
                                    </Link>
                                  ) : (
                                    <p className="mt-1 font-mono text-[10px] text-slate-600">
                                      {application._id}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Action buttons */}
                              {isOpen && canReview ? (
                                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                                  {application.status === "Submitted" && (
                                    <button
                                      onClick={() =>
                                        setPendingDecision({
                                          group,
                                          application,
                                          status: "Pending",
                                        })
                                      }
                                      disabled={Boolean(updatingApplicationId)}
                                      className="rounded-xl border border-amber-200 bg-white px-3.5 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-50"
                                    >
                                      Mark Pending
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setDecisionNote("");
                                      setPendingDecision({
                                        group,
                                        application,
                                        status: "Rejected",
                                      });
                                    }}
                                    disabled={Boolean(updatingApplicationId)}
                                    className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() =>
                                      setPendingDecision({
                                        group,
                                        application,
                                        status: "Approved",
                                      })
                                    }
                                    disabled={Boolean(updatingApplicationId)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    {updatingApplicationId === application._id ? (
                                      <LoaderCircle size={13} className="animate-spin" />
                                    ) : (
                                      <Check size={13} />
                                    )}
                                    Approve
                                  </button>
                                </div>
                              ) : isOpen ? (
                                <p className="text-xs text-amber-700">
                                  This product does not have a configured status endpoint.
                                </p>
                              ) : null}

                              {updatingApplicationId === application._id && (
                                <p className="flex items-center justify-end gap-1.5 text-xs font-medium text-slate-500">
                                  <LoaderCircle size={12} className="animate-spin" /> Saving…
                                </p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </>
              ) : applicationGroups !== null ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
                    <FileText size={20} className="text-emerald-600" />
                  </div>
                  <p className="font-semibold text-emerald-800">No loan applications</p>
                  <p className="text-sm text-emerald-700">
                    This customer has not applied for any loans yet. They can be deleted safely.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Drawer footer */}
            <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  {canDeleteCustomer
                    ? "Permanently removes this customer and all their closed application records."
                    : "Deletion is disabled until every application is Approved or Rejected."}
                </p>
                <button
                  onClick={() => setPendingDelete(viewingCustomer)}
                  disabled={
                    !canDeleteCustomer || isDeleting || Boolean(updatingApplicationId)
                  }
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={15} />
                  {isDeleting ? "Deleting…" : "Delete customer"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {/* ── Confirm delete ───────────────────────────────────────────────── */}
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.name}"?`}
          message="This permanently removes the customer account and all of their closed loan application records. This action cannot be undone."
          confirmText={pendingDelete.email}
          confirmLabel="Delete Customer"
          isSubmitting={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* ── Pending decision modals ──────────────────────────────────────── */}
      {pendingDecision &&
        (pendingDecision.status === "Rejected" ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleApplicationDecision(
                  pendingDecision.group,
                  pendingDecision.application,
                  pendingDecision.status,
                  decisionNote
                );
                setPendingDecision(null);
              }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h2 className="text-lg font-bold text-slate-800">Reject this application?</h2>
              <p className="mt-1 text-sm text-slate-500">
                This decision is final. Add an optional note for the customer.
              </p>
              <textarea
                autoFocus
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Reason for rejection (optional, shown to customer)"
                className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {decisionNote.length}/500
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={Boolean(updatingApplicationId)}
                  onClick={() => setPendingDecision(null)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(updatingApplicationId)}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  Reject application
                </button>
              </div>
            </form>
          </div>
        ) : (
          <ConfirmDialog
            title={
              pendingDecision.status === "Pending"
                ? "Move to pending?"
                : "Approve this application?"
            }
            message={
              pendingDecision.status === "Pending"
                ? "The application stays in the action queue and can be approved or rejected later."
                : "This permanently marks the application as approved. The decision cannot be changed."
            }
            confirmLabel={
              pendingDecision.status === "Pending" ? "Mark Pending" : "Approve"
            }
            danger={false}
            isSubmitting={Boolean(updatingApplicationId)}
            onConfirm={() => {
              const decision = pendingDecision;
              setPendingDecision(null);
              void handleApplicationDecision(
                decision.group,
                decision.application,
                decision.status
              );
            }}
            onCancel={() => setPendingDecision(null)}
          />
        ))}
    </AdminLayout>
  );
};

export default CustomersList;
