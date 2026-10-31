import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Building2, Eye, RefreshCw, ShieldAlert, Trash2, UserCheck, XCircle } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { getApiErrorMessage, getRejectedLoans, type RejectedLoan } from "../../api/rejectedLoans";
import { deleteLoanBySlug, resourceToSlug } from "../../api/personalLoans";
import { deleteFranchise } from "../../api/franchises";
import { BRAND } from "../dashboard/dashboardUtils";
import { KpiCard } from "../dashboard/components/DashboardCards";

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Dashboard ke tables wala header style — dono pages ek jaise dikhen. */
const THEAD =
  "border-y border-slate-100 bg-slate-50/60 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500";

/**
 * Rejection ke teen alag raste — sidebar dropdown aur in-page tabs dono isi
 * list se bante hain, taaki dono jagah ek hi definition rahe:
 *
 *   customer            -> customer ne khud apply kiya (franchise null)
 *   franchise-customer  -> franchise ne apne customer ke naam par file kiya
 *   franchise           -> franchise ki khud ki application admin ne reject ki
 */
const CHANNELS = [
  { key: "all", label: "All", path: "/rejected-loans" },
  { key: "customer", label: "Customer", path: "/rejected-loans/customer" },
  { key: "franchise-customer", label: "Franchise Customer", path: "/rejected-loans/franchise-customer" },
  { key: "franchise", label: "Franchise", path: "/rejected-loans/franchise" },
] as const;
type ChannelKey = (typeof CHANNELS)[number]["key"];

/** Route se channel — `/rejected-loans/franchise` -> "franchise". */
const channelFromParam = (param?: string): ChannelKey =>
  CHANNELS.find((option) => option.key === param)?.key ?? "all";

/** Row par channel ka badge — label, colour aur tooltip ek hi jagah. */
const channelBadge = (loan: RejectedLoan) => {
  const key = loan.channel ?? "customer";

  if (key === "franchise") {
    return {
      label: "Franchise",
      className: "bg-emerald-50 text-emerald-700",
      title: "Franchise ki khud ki application — admin ne reject ki.",
    };
  }

  if (key === "franchise-customer") {
    return {
      label: "Franchise customer",
      className: "bg-indigo-50 text-indigo-600",
      title: `Franchise ne apne customer ke naam par file kiya${
        loan.franchiseCode ? ` · ${loan.franchiseCode}` : ""
      }`,
    };
  }

  return {
    label: "Customer",
    className: "bg-sky-50 text-[rgb(0,102,153)]",
    title: "Direct customer (customer ne khud apply kiya)",
  };
};

/** Har channel ka apna heading copy. */
const CHANNEL_COPY: Record<ChannelKey, string> = {
  all: "Har product ki rejected applications, reject reason ke saath — rule-based aur admin decisions dono.",
  customer: "Direct customers ki rejected applications — customer ne khud apply kiya tha.",
  "franchise-customer": "Franchise ke customers ke naam par file hui rejected applications.",
  franchise: "Franchise ki khud ki applications jo admin ne reject ki.",
};

/** Date aur time alag lines me — column chhoti rehti hai, rows flat dikhte hain. */
const formatDateTimeParts = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-IN", { dateStyle: "medium" }),
    time: date.toLocaleTimeString("en-IN", { timeStyle: "short" }),
  };
};

/**
 * Reject Loans — sabhi products ki rejections ek hi list me, har row par
 * reject reason highlight ke saath. Backend `GET /api/admin/rejected-loans`
 * se aata hai (rule-based + admin decisions dono).
 */
export default function RejectedLoans() {
  const [loans, setLoans] = useState<RejectedLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("All");
  const [pendingDelete, setPendingDelete] = useState<RejectedLoan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const { channel: channelParam } = useParams<{ channel?: string }>();
  const { isSuperAdmin, canAccessLoan } = useAuth();

  /*
  Super admin sab dekhta hai. Restricted admin sirf apne assigned products ki
  rejections — backend bhi yahi filter lagata hai, ye client-side guard sirf
  double safety hai (aur franchise/score rows jo product ke bina aate hain wo
  restricted admin ke liye already nahi aate).
  */
  /*
  Channel split (customer / franchise customer / franchise) sirf super admin
  ke liye hai. Assigned admin ko sirf ek list dikhti hai — uske products ki
  rejected applications — isliye uske liye channel hamesha "all" rehta hai.
  */
  const channel = isSuperAdmin ? channelFromParam(channelParam) : "all";

  const load = () =>
    getRejectedLoans()
      .then((list) => {
        setError("");
        setLoans(
          isSuperAdmin
            ? list
            : list.filter((loan) => canAccessLoan(resourceToSlug(loan.resource ?? undefined)))
        );
      })
      .catch((err: unknown) => {
        setError(getApiErrorMessage(err, "Unable to load rejected loans."));
      })
      .finally(() => {
        setLoading(false);
      });

  /** Manual retry — an event handler may flip the loading flag synchronously. */
  const refresh = () => {
    setLoading(true);
    void load();
  };

  // Mount-only fetch; `load` reads the signed-in admin's access, which does not
  // change while this page is open.
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const loan = pendingDelete;
      const isFranchise = (loan.channel ?? "customer") === "franchise";
      if (isFranchise) {
        await deleteFranchise(loan._id);
      } else {
        const slug = resourceToSlug(loan.resource ?? undefined);
        if (!slug) throw new Error("Cannot determine loan type for this application.");
        await deleteLoanBySlug(slug, loan._id);
      }
      setLoans((prev) => prev.filter((l) => l._id !== pendingDelete._id));
      setPendingDelete(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to delete this record."));
    } finally {
      setIsDeleting(false);
    }
  };

  const products = useMemo(
    () => ["All", ...Array.from(new Set(loans.map((loan) => loan.productLabel))).sort()],
    [loans]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return loans.filter((loan) => {
      if (product !== "All" && loan.productLabel !== product) return false;
      if (channel !== "all" && (loan.channel ?? "customer") !== channel) return false;
      if (!query) return true;
      return [
        loan.applicationNo,
        loan.fullName,
        loan.mobile,
        loan.rejectionReason,
        loan.productLabel,
        loan.franchiseCode,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [loans, search, product, channel]);

  const autoCount = loans.filter((loan) => loan.isAutoRejected).length;
  const channelCount = (key: ChannelKey) =>
    key === "all"
      ? loans.length
      : loans.filter((loan) => (loan.channel ?? "customer") === key).length;

  return (
    <AdminLayout>
      {/* ── Header — dashboard wala pattern ─────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: BRAND.blue }}>
            Reject Loans
          </h2>
          <p className="text-sm text-slate-500">
            {isSuperAdmin
              ? CHANNEL_COPY[channel]
              : "Aapke assigned loan products ki rejected applications — reject reason ke saath."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Channel tabs — sirf super admin; URL se chalte hain, isliye sidebar ka dropdown bhi yahi state set karta hai. */}
          {isSuperAdmin && (
          <div className="flex items-center rounded-xl border border-slate-300 bg-white p-1">
            {CHANNELS.map((option) => {
              const active = channel === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => navigate(option.path)}
                  aria-pressed={active}
                  title={
                    option.key === "customer"
                      ? "Customer ne khud apply kiya aur reject hua"
                      : option.key === "franchise-customer"
                        ? "Franchise ne apne customer ke naam par file kiya"
                        : option.key === "franchise"
                          ? "Franchise ki khud ki application admin ne reject ki"
                          : "Sabhi rejections"
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active ? "text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                  style={active ? { backgroundColor: BRAND.blue } : undefined}
                >
                  {option.label}
                  <span className={`ml-1.5 ${active ? "text-white/70" : "text-slate-400"}`}>
                    {channelCount(option.key)}
                  </span>
                </button>              );
            })}
          </div>
          )}

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, mobile, application no, reason…"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgba(6,106,156,0.2)] sm:w-72"
          />
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            aria-label="Filter by product"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[rgba(6,106,156,0.2)]"
          >
            {products.map((label) => (
              <option key={label} value={label}>
                {label === "All" ? "All products" : label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Counters — dashboard KPI cards ─────────────────────────────── */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total Rejected"
          value={loans.length.toLocaleString("en-IN")}
          sub="Rule + admin decisions"
          icon={XCircle}
          color="#be123c"
          tint="#fff1f2"
        />
        <KpiCard
          label="Rejected by Rules"
          value={autoCount.toLocaleString("en-IN")}
          sub="Auto-deleted after 30 days"
          icon={ShieldAlert}
          color="#b45309"
          tint="#fffbeb"
        />
        <KpiCard
          label="Rejected by Admin"
          value={(loans.length - autoCount).toLocaleString("en-IN")}
          sub="Manual decisions, kept forever"
          icon={UserCheck}
          color="rgb(0, 102, 153)"
          tint="rgba(0, 102, 153, 0.08)"
        />
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="min-w-0">{error}</span>
          <button
            onClick={refresh}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* ── Table — dashboard section shell ────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            {channel === "franchise" ? (
              <>
                <Building2 size={30} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  {loans.length === 0
                    ? "No rejected franchise applications."
                    : "No rejected franchise applications match this filter."}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Jab admin kisi franchise application ko reject karta hai, wo yahin dikhega — rejection note ke saath.
                </p>
              </>
            ) : (
              <>
                <ShieldAlert size={30} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  {loans.length === 0 ? "No rejected applications yet." : "No rejected loans match this filter."}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Rule se reject hone par application yahin dikhegi, reject reason ke saath.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className={THEAD}>
                  <th className="px-5 py-2.5">Application</th>
                  <th className="px-4 py-2.5">
                    {channel === "franchise" ? "Franchise" : "Applicant"}
                  </th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">
                    {channel === "franchise" ? "Admin rejection note" : "Rejection reason"}
                  </th>
                  <th className="px-4 py-2.5">Rejected</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((loan) => {
                  const slug = resourceToSlug(loan.resource ?? undefined);
                  const when = formatDateTimeParts(
                    loan.rejectedAt || loan.autoRejectedAt || loan.createdAt
                  );
                  const isFranchiseRow = (loan.channel ?? "customer") === "franchise";

                  return (
                    <tr key={`${loan.resource}-${loan._id}`} className="transition hover:bg-slate-50">
                      {/* ── Application / Franchise ID column ── */}
                      <td className="px-5 py-3">
                        {isFranchiseRow ? (
                          <>
                            <p className="whitespace-nowrap font-mono text-xs font-semibold text-slate-700">
                              {loan.franchiseCode || "—"}
                            </p>
                            <span className="mt-1 inline-block whitespace-nowrap rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Franchise application
                            </span>
                          </>
                        ) : (
                          <>
                            <p className="whitespace-nowrap font-mono text-xs text-slate-600">
                              {loan.applicationNo || "—"}
                            </p>
                            <span className="mt-1 inline-block whitespace-nowrap rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                              {loan.productLabel}
                            </span>
                          </>
                        )}
                      </td>

                      {/* ── Applicant / Franchise details column ── */}
                      <td className="px-4 py-3">
                        {isFranchiseRow ? (
                          <>
                            <p className="whitespace-nowrap font-semibold text-slate-800">
                              {loan.fullName || "—"}
                            </p>
                            {loan.mobile && (
                              <p className="whitespace-nowrap text-xs text-slate-400">{loan.mobile}</p>
                            )}
                            {/* Franchise code badge */}
                            {loan.franchiseCode && (
                              <span className="mt-1 inline-block whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                                {loan.franchiseCode}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="whitespace-nowrap font-semibold text-slate-700">
                              {loan.fullName || "—"}
                            </p>
                            <p className="whitespace-nowrap text-xs text-slate-400">{loan.mobile || ""}</p>
                            {/* Channel badge sirf super admin ke liye — assigned admin ko customer/franchise split nahi dikhta. */}
                            {isSuperAdmin && (
                              <span
                                title={channelBadge(loan).title}
                                className={`mt-1 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${channelBadge(loan).className}`}
                              >
                                {channelBadge(loan).label}
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      {/* ── Amount ── */}
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
                        {typeof loan.loanAmount === "number" ? INR.format(loan.loanAmount) : "—"}
                      </td>

                      {/* ── Rejection reason / Admin note ── */}
                      <td className="px-4 py-3">
                        {isFranchiseRow ? (
                          <div className="space-y-1.5">
                            {/* Admin note block — prominent */}
                            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-red-500">
                                Admin note
                              </p>
                              <p className="text-xs font-semibold leading-relaxed text-red-700">
                                {loan.rejectionReason
                                  ? loan.rejectionReason
                                  : <span className="italic text-red-400">No rejection note provided by admin.</span>
                                }
                              </p>
                            </div>
                            {/* Who rejected */}
                            {loan.rejectedBy && (
                              <p className="text-[10px] text-slate-400">
                                Rejected by: <span className="font-medium text-slate-600">{loan.rejectedBy}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-relaxed text-red-700">
                              {loan.rejectionReason || "No reason recorded."}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-slate-400">
                              {loan.employmentType && <span>{loan.employmentType}</span>}
                              {loan.companyType && <span>· {loan.companyType}</span>}
                              {loan.salaryReceivedAs && <span>· {loan.salaryReceivedAs}</span>}
                              {typeof loan.creditScore === "number" && <span>· Score {loan.creditScore}</span>}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* ── Rejected date ── */}
                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap text-xs text-slate-500">
                          {when ? when.date : "—"}
                        </p>
                        <p className="whitespace-nowrap text-xs text-slate-400">
                          {when ? when.time : ""}
                        </p>
                        {!isFranchiseRow && (
                          <>
                            <span
                              title={
                                loan.isAutoRejected
                                  ? "Eligibility rule ne auto-reject kiya — record 30 din baad delete ho jaayega."
                                  : `Admin ne manually reject kiya${loan.rejectedBy ? ` (${loan.rejectedBy})` : ""} — record permanent rehta hai.`
                              }
                              className={`mt-1.5 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                loan.isAutoRejected
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {loan.isAutoRejected ? "Rule" : "Admin"}
                            </span>
                            <p className="mt-1 whitespace-nowrap text-[10px] text-slate-400">
                              {loan.isAutoRejected ? "by eligibility rule" : `by ${loan.rejectedBy || "Admin"}`}
                            </p>
                          </>
                        )}
                      </td>

                      {/* ── Actions: View + Delete ── */}
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View button */}
                          {isFranchiseRow ? (
                            loan._id ? (
                              <Link
                                to={`/franchises/${encodeURIComponent(loan._id)}`}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                <Building2 size={13} /> View Franchise
                              </Link>
                            ) : null
                          ) : slug ? (
                            <Link
                              to={`/applications/${slug}/${loan._id}`}
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            >
                              <Eye size={13} /> View
                            </Link>
                          ) : null}
                          {/* Delete is a super-admin action — the backend also enforces it. */}
                          {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => setPendingDelete(loan)}
                            aria-label={`Delete ${loan.fullName || "this record"}`}
                            title="Delete this record permanently"
                            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loading && !error && filtered.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Showing {filtered.length} of {loans.length} rejected applications. Rule-based records 30 din
          baad apne aap delete ho jaate hain — jab tak record rahe, applicant usi product par dobara
          apply nahi kar sakta.
        </p>
      )}

      {/* ── Delete confirmation ─────────────────────────────────────────── */}
      {isSuperAdmin && pendingDelete && (
        <ConfirmDialog
          title={
            (pendingDelete.channel ?? "customer") === "franchise"
              ? `Delete franchise "${pendingDelete.fullName || pendingDelete.franchiseCode || "this record"}"?`
              : `Delete application "${pendingDelete.applicationNo || pendingDelete._id.slice(-8).toUpperCase()}"?`
          }
          message={
            (pendingDelete.channel ?? "customer") === "franchise"
              ? "This will permanently delete the franchise account. The applicant will no longer be able to log in. This cannot be undone."
              : "This will permanently delete this loan application record. The customer will be able to re-apply for the same product. This cannot be undone."
          }
          confirmLabel="Delete permanently"
          danger={true}
          isSubmitting={isDeleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </AdminLayout>
  );
}
