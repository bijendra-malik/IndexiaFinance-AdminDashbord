import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Eye, LoaderCircle, RefreshCw, Search, ToggleLeft, ToggleRight, Trash2, Users, X } from "lucide-react";
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

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

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

const formatCurrency = (amount?: number) =>
  amount == null
    ? "Amount not provided"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(amount);

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
  const [applicationGroups, setApplicationGroups] = useState<CustomerApplicationGroup[] | null>(null);
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

  useEffect(() => { void load(); }, [appliedSearch, activeFilter]); // eslint-disable-line

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
        setCustomerDetailError(getApiErrorMessage(customerResult.reason, "Unable to load this customer's details."));
      }
      if (applicationsResult.status === "fulfilled") {
        setApplicationGroups(applicationsResult.value);
      } else {
        setApplicationsError(getApiErrorMessage(applicationsResult.reason, "Unable to load this customer's applications."));
      }
      setIsLoadingApplications(false);
    });

    return () => {
      cancelled = true;
    };
  }, [viewingCustomerId, applicationsRefreshKey]);

  const applications = applicationGroups?.flatMap((group) => group.applications) ?? [];
  const openApplications = applications.filter((application) => OPEN_STATUSES.has(application.status));

  /**
   * Newest first: product groups are ordered by their most recent application,
   * and inside each group the applications run latest → oldest, so the freshest
   * application always sits at the top of the modal.
   */
  const sortedApplicationGroups = useMemo(() => {
    if (!applicationGroups) return null;

    const createdAtMs = (application?: PersonalLoan) => {
      const time = application?.createdAt ? new Date(application.createdAt).getTime() : NaN;
      return Number.isNaN(time) ? 0 : time;
    };
    const newestFirst = (left: PersonalLoan, right: PersonalLoan) =>
      createdAtMs(right) - createdAtMs(left);

    return applicationGroups
      .map((group) => ({
        ...group,
        applications: [...group.applications].sort(newestFirst),
      }))
      .sort((left, right) =>
        createdAtMs(right.applications[0]) - createdAtMs(left.applications[0])
      );
  }, [applicationGroups]);
  const canDeleteCustomer =
    applicationGroups !== null && !applicationsError && openApplications.length === 0 && !isLoadingApplications;

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
    setApplicationsRefreshKey((key) => key + 1);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
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
      setCustomers((current) =>
        current?.flatMap((item) => {
          if (item._id !== customer._id) return [item];
          if (activeFilter !== "all" && (activeFilter === "active") !== isActive) return [];
          return [{ ...item, isActive }];
        }) ?? current
      );
      showToast(`Customer ${isActive ? "activated" : "deactivated"}.`, "success");
    } catch (err) {
      showToast(getApiErrorMessage(err, "Unable to update this customer's account status."), "error");
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
      const updatedApplication = await updateLoanStatusBySlug(
        slug,
        application._id,
        status,
        note.trim()
      );
      setApplicationGroups((current) =>
        current?.map((currentGroup) => ({
          ...currentGroup,
          applications: currentGroup.applications.map((item) =>
            item._id === updatedApplication._id ? updatedApplication : item
          ),
        })) ?? current
      );
      showToast(`Application marked ${status.toLowerCase()}.`, "success");
    } catch (err) {
      showToast(getApiErrorMessage(err, `Unable to ${status.toLowerCase()} this application.`), "error");
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ background: "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))" }}>
            <Users size={19} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Customers</h2>
            <p className="mt-0.5 text-sm text-slate-500">Manage customer accounts and review their loan applications.</p>
          </div>
        </div>
        {customers && (
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {customers.length} registered customer{customers.length === 1 ? "" : "s"}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedSearch(search.trim());
            setPage(1);
          }}
          className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="relative w-full sm:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Filter customers by account status"
              value={activeFilter}
              onChange={(value) => {
                setActiveFilter(value as typeof activeFilter);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All accounts" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <button type="submit" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110" style={{ background: BRAND_GRADIENT }}>
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
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                Clear
              </button>
            )}
          </div>
          {customers && !error && (
            <p className="text-xs font-medium text-slate-500">
              Showing <span className="font-bold text-slate-700">{filtered.length}</span> of{" "}
              <span className="font-bold text-slate-700">{customers.length}</span>
            </p>
          )}
        </form>

        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-slate-300 hover:bg-slate-50 transition"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        ) : customers === null ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Users size={22} className="text-slate-300" />
            <p className="text-sm text-slate-500">
              {customers.length === 0 ? "No customers yet." : "No customers match your filters."}
            </p>
            {customers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setAppliedSearch("");
                  setActiveFilter("all");
                }}
                className="mt-1 text-xs font-semibold text-sky-700 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Mobile</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Account status</th>
                  <th className="px-5 py-3.5">Joined</th>
                  <th className="px-5 py-3.5">Last login</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {paged.map((c) => (
                  <tr key={c._id} className="group transition-colors hover:bg-sky-50/40">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-xs font-extrabold text-sky-800 ring-1 ring-white">
                          {c.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"}
                        </div>
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-800">{c.name}</span>
                          <span className="block font-mono text-[10px] text-slate-400">{c.customerId || c._id}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">{c.mobile}</td>
                    <td className="px-5 py-3.5 text-slate-600">{c.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          c.isActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${c.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={c.lastLogin ? "text-slate-500" : "text-slate-300"}>
                        {c.lastLogin ? formatDate(c.lastLogin) : "Never"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openCustomerDetails(c)}
                          aria-label={`View ${c.name} and review applications`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                        >
                          <Eye size={14} /> View
                        </button>
                        <button
                          onClick={() => void handleToggleCustomer(c)}
                          disabled={updatingCustomerId === c._id}
                          aria-label={`${c.isActive ? "Deactivate" : "Activate"} ${c.name}`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                        >
                          {c.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
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

      {viewingCustomer && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px] sm:p-6"
          onClick={closeCustomerDetails}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-applications-title"
            className="flex max-h-[min(90vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/50 bg-[#f7f9fc] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-white">
              <div className="absolute inset-x-0 top-0 h-1"
                style={{ background: "linear-gradient(90deg,rgb(6,106,156),rgb(38,174,144))" }} />
              <div className="relative flex items-start justify-between gap-4 px-6 pb-5 pt-7">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-700 to-emerald-500 text-lg font-extrabold text-white shadow-lg shadow-sky-900/15">
                    {viewingCustomer.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Customer profile</p>
                    <h2 id="customer-applications-title" className="mt-1 truncate text-xl font-bold text-slate-900">
                      {viewingCustomer.name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="truncate">{viewingCustomer.email}</span>
                      <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
                      <span>{viewingCustomer.mobile}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeCustomerDetails}
                  disabled={isDeleting || Boolean(updatingApplicationId)}
                  aria-label="Close customer details"
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              {customerDetailError && (
                <div className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700">
                  Customer details could not be loaded: {customerDetailError}
                  <button onClick={retryApplications} className="ml-3 inline-flex items-center gap-1.5 font-semibold underline">
                    <RefreshCw size={13} /> Retry
                  </button>
                </div>
              )}
              {customerDetail && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <h3 className="text-sm font-bold text-slate-800">Customer details</h3>
                  <p className="mb-4 mt-1 text-[11px] text-slate-400">
                    Credit score is captured per application at submit time — see each application card below.
                  </p>
                  <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Customer ID</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700">{customerDetail.customerId || customerDetail._id}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Full name</dt><dd className="mt-1 text-sm text-slate-700">{customerDetail.name || "—"}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Email</dt><dd className="mt-1 break-all text-sm text-slate-700">{customerDetail.email || "—"}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Mobile</dt><dd className="mt-1 text-sm text-slate-700">{customerDetail.mobile || "—"}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">PAN</dt><dd className="mt-1 text-sm text-slate-700">{customerDetail.panNumber || "—"}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Location</dt><dd className="mt-1 text-sm text-slate-700">{[customerDetail.city, customerDetail.state, customerDetail.country, customerDetail.pincode].filter(Boolean).join(", ") || "—"}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Account</dt><dd className="mt-1 text-sm text-slate-700">{customerDetail.role} · {customerDetail.isActive ? "Active" : "Inactive"} · {customerDetail.isVerified ? "Verified" : "Unverified"}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Package</dt><dd className="mt-1 text-sm text-slate-700">{customerDetail.package || "—"}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Created</dt><dd className="mt-1 text-sm text-slate-700">{formatDate(customerDetail.createdAt)}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Last login</dt><dd className="mt-1 text-sm text-slate-700">{formatDate(customerDetail.lastLogin)}</dd></div>
                  </dl>
                </section>
              )}
              {isLoadingApplications ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500 shadow-sm">
                  <LoaderCircle size={24} className="animate-spin text-sky-600" />
                  <span>Loading customer applications...</span>
                </div>
              ) : applicationsError ? (
                <div className="rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-700 shadow-sm">
                  <p className="font-semibold">Could not load applications</p>
                  <p className="mt-1 text-red-600/90">{applicationsError}</p>
                  <button
                    onClick={retryApplications}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 font-semibold transition hover:bg-red-50"
                  >
                    <RefreshCw size={13} /> Try again
                  </button>
                </div>
              ) : sortedApplicationGroups?.length ? (
                <>
                  <div className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
                    openApplications.length
                      ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-950"
                      : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-950"
                  }`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">Application review</p>
                        <p className="mt-1 font-bold">
                          {openApplications.length
                            ? `${openApplications.length} application${openApplications.length === 1 ? "" : "s"} awaiting decision`
                            : "All applications have been decided"}
                        </p>
                        <p className="mt-1 text-xs opacity-75">
                          {openApplications.length
                            ? "Review the details and record a decision for each open application."
                            : "Customer deletion is now available."}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        openApplications.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {openApplications.length ? "Action required" : "Ready to delete"}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-current/10 pt-4">
                      <div>
                        <p className="text-lg font-extrabold leading-none">{applications.length}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">Total</p>
                      </div>
                      <div>
                        <p className="text-lg font-extrabold leading-none">{openApplications.length}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">Open</p>
                      </div>
                      <div>
                        <p className="text-lg font-extrabold leading-none">{applications.length - openApplications.length}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">Decided</p>
                      </div>
                    </div>
                  </div>

                  {sortedApplicationGroups.map((group) => (
                    <section key={group.product} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50 px-4 py-3.5 sm:px-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                            <Users size={16} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-slate-800">
                              {getLoanTypeLabel(PRODUCT_SLUGS[group.product] ?? group.product)}
                            </h3>
                            <p className="mt-0.5 text-[11px] text-slate-400">Loan applications</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
                          {group.count}
                        </span>
                      </div>
                      <div className="space-y-3 p-3 sm:p-4">
                        {group.applications.map((application) => {
                          const isOpen = OPEN_STATUSES.has(application.status);
                          const slug = PRODUCT_SLUGS[group.product] ?? application.loanType;
                          const canReview = isOpen && SUPPORTED_LOAN_SLUGS.has(slug);

                          return (
                            <article key={application._id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Requested amount</p>
                                  <p className="mt-1 text-lg font-extrabold tracking-tight text-slate-900">
                                    {formatCurrency(application.loanAmount)}
                                  </p>
                                </div>
                                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                                  application.status === "Approved"
                                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                    : application.status === "Rejected"
                                      ? "border-red-100 bg-red-50 text-red-700"
                                      : application.status === "Pending"
                                        ? "border-amber-100 bg-amber-50 text-amber-700"
                                        : "border-sky-100 bg-sky-50 text-sky-700"
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${
                                    application.status === "Approved" ? "bg-emerald-500"
                                      : application.status === "Rejected" ? "bg-red-500"
                                        : application.status === "Pending" ? "bg-amber-500" : "bg-sky-500"
                                  }`} />
                                  {application.status}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 px-3 py-2.5 sm:grid-cols-3">
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Tenure</p>
                                  <p className="mt-1 text-xs font-semibold text-slate-700">
                                    {application.loanTenure ? `${application.loanTenure} months` : "Not provided"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Applied on</p>
                                  <p className="mt-1 text-xs font-semibold text-slate-700">
                                    {application.createdAt ? formatDate(application.createdAt) : "—"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Credit score at apply</p>
                                  <p className="mt-1 text-xs font-semibold text-slate-700">
                                    {typeof application.creditScore === "number"
                                      ? `${application.creditScore}/900 · ${(application.creditEligible ?? application.creditScore >= MINIMUM_CREDIT_SCORE) ? "Eligible" : "Not eligible"}`
                                      : "Not recorded"}
                                  </p>
                                </div>
                                <div className="col-span-2 min-w-0 border-t border-slate-200/80 pt-2 sm:col-span-3">
                                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Application ID</p>
                                  {SUPPORTED_LOAN_SLUGS.has(slug) ? (
                                    <Link
                                      to={`/applications/${slug}/${application._id}`}
                                      className="mt-1 block break-all font-mono text-[10px] text-sky-700 hover:underline"
                                    >
                                      {application._id} · Open application
                                    </Link>
                                  ) : (
                                    <p className="mt-1 break-all font-mono text-[10px] text-slate-600">{application._id}</p>
                                  )}
                                </div>
                              </div>

                              {isOpen && canReview ? (
                                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                                  {application.status === "Submitted" && (
                                    <button
                                      onClick={() => setPendingDecision({ group, application, status: "Pending" })}
                                      disabled={Boolean(updatingApplicationId)}
                                      className="rounded-lg border border-amber-200 bg-white px-3.5 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Mark Pending
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setDecisionNote("");
                                      setPendingDecision({ group, application, status: "Rejected" });
                                    }}
                                    disabled={Boolean(updatingApplicationId)}
                                    className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => setPendingDecision({ group, application, status: "Approved" })}
                                    disabled={Boolean(updatingApplicationId)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {updatingApplicationId === application._id
                                      ? <LoaderCircle size={13} className="animate-spin" />
                                      : <Check size={13} />}
                                    Approve
                                  </button>
                                </div>
                              ) : isOpen ? (
                                <p className="text-xs text-amber-700">
                                  This product does not have a configured status endpoint, so it cannot be reviewed here.
                                </p>
                              ) : null}
                              {updatingApplicationId === application._id && (
                                <p className="flex items-center justify-end gap-1.5 text-xs font-medium text-slate-500">
                                  <LoaderCircle size={12} className="animate-spin" /> Saving decision...
                                </p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  No loan applications found. This customer can be deleted.
                </div>
              )}
            </div>

            <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                {canDeleteCustomer
                  ? "Delete permanently removes this customer and all their closed application records."
                  : "Customer deletion stays disabled until every application is Approved or Rejected."}
              </p>
              <button
                onClick={() => setPendingDelete(viewingCustomer)}
                disabled={!canDeleteCustomer || isDeleting || Boolean(updatingApplicationId)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={15} /> Delete customer
              </button>
            </footer>
          </section>
        </div>
      )}

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

      {pendingDecision && (
        pendingDecision.status === "Rejected" ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleApplicationDecision(
                  pendingDecision.group,
                  pendingDecision.application,
                  pendingDecision.status,
                  decisionNote
                );
                setPendingDecision(null);
              }}
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            >
              <h2 className="text-lg font-semibold text-slate-800">Reject this application?</h2>
              <p className="mt-1 text-sm text-slate-500">This decision is final. Add an optional note.</p>
              <textarea
                autoFocus
                value={decisionNote}
                onChange={(event) => setDecisionNote(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Reason for rejection (optional)"
                className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <p className="mt-1 text-right text-xs text-slate-400">{decisionNote.length}/500</p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={Boolean(updatingApplicationId)}
                  onClick={() => setPendingDecision(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(updatingApplicationId)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject application
                </button>
              </div>
            </form>
          </div>
        ) : (
          <ConfirmDialog
            title={pendingDecision.status === "Pending" ? "Move this application to pending?" : "Approve this application?"}
            message={
              pendingDecision.status === "Pending"
                ? "The application will remain in the action queue and can later be approved or rejected."
                : "This will permanently mark this application as approved. The decision cannot be changed later."
            }
            confirmLabel={pendingDecision.status === "Pending" ? "Mark Pending" : "Approve"}
            danger={false}
            isSubmitting={Boolean(updatingApplicationId)}
            onConfirm={() => {
              const decision = pendingDecision;
              setPendingDecision(null);
              void handleApplicationDecision(decision.group, decision.application, decision.status);
            }}
            onCancel={() => setPendingDecision(null)}
          />
        )
      )}
    </AdminLayout>
  );
};

export default CustomersList;
