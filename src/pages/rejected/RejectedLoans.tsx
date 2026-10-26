import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Eye, RefreshCw, ShieldAlert, UserCheck, XCircle } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getApiErrorMessage, getRejectedLoans, type RejectedLoan } from "../../api/rejectedLoans";
import { resourceToSlug } from "../../api/personalLoans";
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
  const [channel, setChannel] = useState<Channel>("All");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setLoans(await getRejectedLoans());
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load rejected loans."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const products = useMemo(
    () => ["All", ...Array.from(new Set(loans.map((loan) => loan.productLabel))).sort()],
    [loans]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return loans.filter((loan) => {
      if (product !== "All" && loan.productLabel !== product) return false;
      if (channel === "Franchise" && !loan.franchise) return false;
      if (channel === "Customer" && loan.franchise) return false;
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
  const franchiseCount = loans.filter((loan) => Boolean(loan.franchise)).length;
  const channelCount = (option: Channel) =>
    option === "Franchise" ? franchiseCount : option === "Customer" ? loans.length - franchiseCount : loans.length;

  return (
    <AdminLayout>
      {/* ── Header — dashboard wala pattern ─────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: BRAND.blue }}>
            Reject Loans
          </h2>
          <p className="text-sm text-slate-500">
            Har product ki rejected applications, reject reason ke saath — rule-based aur admin
            decisions dono.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Channel — franchise ki application aur direct customer alag alag dekho. */}
          <div className="flex items-center rounded-xl border border-slate-300 bg-white p-1">
            {CHANNELS.map((option) => {
              const active = channel === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setChannel(option)}
                  aria-pressed={active}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active ? "text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                  style={active ? { backgroundColor: BRAND.blue } : undefined}
                >
                  {option === "All" ? "All" : option === "Customer" ? "Customers" : "Franchise"}
                  <span className={`ml-1.5 ${active ? "text-white/70" : "text-slate-400"}`}>
                    {channelCount(option)}
                  </span>
                </button>
              );
            })}
          </div>
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
            onClick={() => void load()}
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
            <ShieldAlert size={30} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">
              {loans.length === 0 ? "No rejected applications yet." : "No rejected loans match this filter."}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Rule se reject hone par application yahin dikhegi, reject reason ke saath.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className={THEAD}>
                  <th className="px-5 py-2.5">Application</th>
                  <th className="px-4 py-2.5">Applicant</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Rejection reason</th>
                  <th className="px-4 py-2.5">Rejected</th>
                  <th className="px-5 py-2.5 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((loan) => {
                  const slug = resourceToSlug(loan.resource ?? undefined);
                  const when = formatDateTimeParts(
                    loan.rejectedAt || loan.autoRejectedAt || loan.createdAt
                  );
                  return (
                    <tr key={`${loan.resource}-${loan._id}`} className="transition hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="whitespace-nowrap font-mono text-xs text-slate-600">
                          {loan.applicationNo || "—"}
                        </p>
                        <span className="mt-1 inline-block whitespace-nowrap rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          {loan.productLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap font-semibold text-slate-700">
                          {loan.fullName || "—"}
                        </p>
                        <p className="whitespace-nowrap text-xs text-slate-400">{loan.mobile || ""}</p>
                        {/* Applicant ka channel — direct customer ya franchise ne file kiya. */}
                        <span
                          title={
                            loan.franchise
                              ? `Franchise customer${loan.franchiseCode ? ` · ${loan.franchiseCode}` : ""}`
                              : "Direct customer (customer ne khud apply kiya)"
                          }
                          className={`mt-1 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            loan.franchise
                              ? "bg-indigo-50 text-indigo-600"
                              : "bg-sky-50 text-[rgb(0,102,153)]"
                          }`}
                        >
                          {loan.franchise ? "Franchise" : "Customer"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
                        {typeof loan.loanAmount === "number" ? INR.format(loan.loanAmount) : "—"}
                      </td>

                      {/* ══ Reject reason — highlight ══ */}
                      <td className="px-4 py-3">
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
                      </td>

                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap text-xs text-slate-500">
                          {when ? when.date : "—"}
                        </p>
                        <p className="whitespace-nowrap text-xs text-slate-400">
                          {when ? when.time : ""}
                        </p>
                        <span
                          title={
                            loan.isAutoRejected
                              ? "Eligibility rule (company type / salary received / credit score) ne auto-reject kiya — record 30 din baad apne aap delete ho jaayega."
                              : "Admin ne manually reject kiya — record permanent rehta hai."
                          }
                          className={`mt-1.5 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            loan.isAutoRejected
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {loan.isAutoRejected ? "Rule" : "Admin"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {slug ? (
                          <Link
                            to={`/applications/${slug}/${loan._id}`}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            <Eye size={13} /> View
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
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
          baad apne aap delete ho jaate hain (customer tab tak usi product par dobara apply nahi
          kar sakta).
        </p>
      )}
    </AdminLayout>
  );
}
