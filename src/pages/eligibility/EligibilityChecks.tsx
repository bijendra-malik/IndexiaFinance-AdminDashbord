import { useEffect, useState, type FormEvent } from "react";
import {
  BadgeCheck, CalendarClock, ChevronLeft, ChevronRight,
  ClipboardList, Inbox, Mail, Phone, RefreshCw, Search, X, XCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  formatRupees,
  getEligibilityCheckStats,
  getEligibilityChecks,
  type EligibilityCheck,
  type EligibilityCheckList,
  type EligibilityCheckStats,
  type EligibleFilter,
} from "../../api/eligibilityChecks";

/*
==========================================
Eligibility checks — /eligibility-checks (super admin only)

Website ke /eligibility-calculator se aaya har check yahan aata hai: kisne
(naam, mobile), kis product ke liye, kab check kiya, aur us waqt eligible tha
ya nahi. Numbers us check ke snapshot hain (rate card baad me badle to purana
record waisa hi rehta hai).
==========================================
*/

const BRAND = "linear-gradient(135deg, rgb(6,106,156), rgb(38,174,144))";
const PAGE_SIZE = 25;

const EMPTY_STATS: EligibilityCheckStats = {
  total: 0,
  eligible: 0,
  notEligible: 0,
  today: 0,
  todayEligible: 0,
  eligibleRate: 0,
  avgNetIncome: 0,
  byProduct: [],
};

const dateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

const Pricing = ({ check }: { check: EligibilityCheck }) => {
  if (check.roi === null) {
    return <span className="text-[11px] text-amber-700">Rate on request</span>;
  }
  return (
    <span className="text-[11px] text-slate-600">
      {check.roi}% p.a.
      {check.tenureMonths ? ` · ${check.tenureMonths} mo` : ""}
    </span>
  );
};

const EligibilityChecks = () => {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [product, setProduct] = useState("all");
  const [eligible, setEligible] = useState<EligibleFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState<EligibilityCheckList | null>(null);
  const [stats, setStats] = useState<EligibilityCheckStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<EligibilityCheck | null>(null);

  useEffect(() => {
    let cancelled = false;

    const request = async () => {
      try {
        const [list, statResult] = await Promise.all([
          getEligibilityChecks({ search, product, eligible, from, to, page, limit: PAGE_SIZE }),
          getEligibilityCheckStats(),
        ]);
        if (cancelled) return;
        setData(list);
        setStats(statResult);
        setError("");
      } catch (loadError) {
        if (cancelled) return;
        setError(getApiErrorMessage(loadError, "Could not load eligibility checks."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void request();
    return () => {
      cancelled = true;
    };
  }, [search, product, eligible, from, to, page, reloadKey]);

  const checks = data?.checks ?? [];
  const totalCount = data?.total ?? 0;
  const currentPage = data?.page ?? 1;
  const totalPages = data?.pages ?? 1;
  const summary = stats ?? EMPTY_STATS;

  const resetPage = () => {
    setLoading(true);
    setPage(1);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    resetPage();
    setSearch(searchInput.trim());
  };

  const refresh = () => {
    setLoading(true);
    setReloadKey((current) => current + 1);
  };

  const cards = [
    { label: "Total checks", value: summary.total, hint: "All time", tone: "text-slate-900" },
    { label: "Eligible", value: summary.eligible, hint: `${summary.eligibleRate}% of checks`, tone: "text-emerald-700" },
    { label: "Not eligible", value: summary.notEligible, hint: "Income / age rule", tone: "text-rose-700" },
    { label: "Today", value: summary.today, hint: `${summary.todayEligible} eligible`, tone: "text-sky-700" },
    { label: "Avg net income", value: formatRupees(summary.avgNetIncome), hint: "Across all checks", tone: "text-slate-900" },
  ];

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ background: BRAND }}
          >
            <ClipboardList size={19} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Eligibility checks</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Website calculator se aaye checks — kisne kiya, kis product ke liye aur eligible tha ya nahi.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {card.label}
            </p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${card.tone}`}>{card.value}</p>
            <p className="text-[11px] text-slate-400">{card.hint}</p>
          </div>
        ))}
      </div>

      {/* Product-wise breakdown */}
      {summary.byProduct.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {summary.byProduct.map((row) => (
            <span
              key={row.product}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600"
            >
              <span className="font-semibold text-slate-800">{row.label}</span>
              {row.total} checks
              <span className="text-emerald-700">· {row.eligible} eligible</span>
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: "all" as EligibleFilter, label: "All", count: summary.total },
            { value: "yes" as EligibleFilter, label: "Eligible", count: summary.eligible },
            { value: "no" as EligibleFilter, label: "Not eligible", count: summary.notEligible },
          ].map((tab) => {
            const isActive = eligible === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  resetPage();
                  setEligible(tab.value);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[rgb(6,106,156)] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                    isActive ? "bg-white/20" : "bg-white text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}

          <select
            value={product}
            onChange={(event) => {
              resetPage();
              setProduct(event.target.value);
            }}
            aria-label="Filter by product"
            className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[rgb(6,106,156)]"
          >
            <option value="all">All products</option>
            {summary.byProduct.map((row) => (
              <option key={row.product} value={row.product}>
                {row.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarClock size={13} className="text-slate-400" />
            <input
              type="date"
              value={from}
              onChange={(event) => {
                resetPage();
                setFrom(event.target.value);
              }}
              aria-label="From date"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[rgb(6,106,156)]"
            />
            <span>to</span>
            <input
              type="date"
              value={to}
              onChange={(event) => {
                resetPage();
                setTo(event.target.value);
              }}
              aria-label="To date"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[rgb(6,106,156)]"
            />
          </div>

          <form onSubmit={submitSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name, mobile, email, ELG no."
                className="w-56 rounded-lg border border-slate-200 py-1.5 pr-2.5 pl-8 text-xs text-slate-800 outline-none focus:border-[rgb(6,106,156)]"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[rgb(6,106,156)] hover:text-[rgb(6,106,156)]"
            >
              Search
            </button>
            {(search || from || to || product !== "all" || eligible !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                  setProduct("all");
                  setEligible("all");
                  setFrom("");
                  setTo("");
                  resetPage();
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <X size={12} /> Clear
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {error && (
          <p className="border-b border-rose-100 bg-rose-50 px-5 py-2.5 text-sm text-rose-700">{error}</p>
        )}

        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">Loading checks…</p>
        ) : checks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Inbox size={20} />
            </span>
            <p className="text-sm font-semibold text-slate-700">No eligibility checks yet</p>
            <p className="max-w-sm text-xs leading-relaxed text-slate-400">
              Jab koi website ke eligibility calculator se check karega, wo yahan aayega.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5">Applicant</th>
                  <th className="px-4 py-2.5">Contact</th>
                  <th className="px-4 py-2.5">Profile</th>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5">Income / EMI</th>
                  <th className="px-4 py-2.5">Result</th>
                  <th className="px-4 py-2.5">Max loan</th>
                  <th className="px-4 py-2.5">Pricing</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checks.map((check) => (
                  <tr key={check.id} className="align-top transition hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: BRAND }}
                          aria-hidden
                        >
                          {initialsOf(check.name)}
                        </span>
                        <span className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelected(check)}
                            className="block max-w-[12rem] truncate text-left font-semibold text-slate-800 hover:text-[rgb(6,106,156)] hover:underline"
                          >
                            {check.name || "Unnamed"}
                          </button>
                          <span className="block text-[11px] text-slate-400">
                            {check.checkNo || "—"} · {dateTime(check.checkedAt)}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <a href={`tel:${check.mobile}`} className="block whitespace-nowrap hover:underline">
                        {check.mobile || "—"}
                      </a>
                      {check.email && (
                        <a
                          href={`mailto:${check.email}`}
                          className="block max-w-[12rem] truncate text-[11px] text-slate-400 hover:underline"
                          title={check.email}
                        >
                          {check.email}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-600">
                      <p className="font-semibold text-slate-700">
                        {check.age !== null ? `${check.age} yrs` : "—"}
                      </p>
                      <p className="text-slate-400">
                        {[check.occupation, check.country].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[rgba(6,106,156,0.08)] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[rgb(6,106,156)]">
                        {check.productLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-600">
                      <p className="font-semibold text-slate-700">{formatRupees(check.monthlyIncome)}/mo</p>
                      <p className="text-slate-400">
                        EMI {formatRupees(check.existingEmi)} · net {formatRupees(check.netIncome)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {check.eligible ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          <BadgeCheck size={12} /> Eligible
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200"
                          title={check.reason ?? undefined}
                        >
                          <XCircle size={12} /> Not eligible
                        </span>
                      )}
                      {!check.eligible && check.reason && (
                        <p className="mt-0.5 max-w-[15rem] text-[11px] leading-snug text-slate-400">
                          {check.reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-slate-800">
                        {check.eligible ? formatRupees(check.maxLoanAmount) : "—"}
                      </p>
                      {check.emi !== null && (
                        <p className="text-[11px] text-slate-400">EMI {formatRupees(check.emi)}/mo</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pricing check={check} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(check)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-[rgb(6,106,156)] hover:text-[rgb(6,106,156)]"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
            <span>
              {totalCount} checks · page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setPage((current) => Math.max(1, current - 1));
                }}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setPage((current) => Math.min(totalPages, current + 1));
                }}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/30"
          onClick={() => setSelected(null)}
        >
          <aside
            className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Eligibility check {selected.checkNo || ""}
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                  {selected.name || "Unnamed"}
                </h2>
                <p className="text-xs text-slate-400">
                  {dateTime(selected.checkedAt)} · {selected.source || "website"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </header>

            <div className="mt-4 space-y-2 text-sm">
              <a
                href={`tel:${selected.mobile}`}
                className="flex items-center gap-2 text-slate-700 hover:text-[rgb(6,106,156)]"
              >
                <Phone size={14} className="text-slate-400" />
                {selected.mobile || "—"}
              </a>
              <a
                href={`mailto:${selected.email}`}
                className="flex items-center gap-2 break-all text-slate-700 hover:text-[rgb(6,106,156)]"
              >
                <Mail size={14} className="shrink-0 text-slate-400" />
                {selected.email || "—"}
              </a>
            </div>

            <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Result
                </p>
                {selected.eligible ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <BadgeCheck size={12} /> Eligible
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                    <XCircle size={12} /> Not eligible
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {selected.eligible
                  ? selected.roi === null
                    ? "Rate on request — team will confirm pricing."
                    : `Up to ${formatRupees(selected.maxLoanAmount)} for ${selected.tenureMonths} months at ${selected.roi}% p.a.`
                  : selected.reason || "Not eligible for this product."}
              </p>
            </section>

            <section className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Applicant & product
              </p>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                {[
                  ["Product", selected.productLabel],
                  ["Age", selected.age !== null ? `${selected.age} yrs` : "—"],
                  ["Occupation", selected.occupation || "—"],
                  ["Country", selected.country || "—"],
                  ["Check no.", selected.checkNo || "—"],
                  ["Source", selected.source || "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
                    <dd className="font-semibold text-slate-700">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Calculation
              </p>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                {[
                  ["Monthly income", formatRupees(selected.monthlyIncome)],
                  ["Existing EMI", formatRupees(selected.existingEmi)],
                  ["Net income", formatRupees(selected.netIncome)],
                  ["FOIR", selected.foirPercent !== null ? `${selected.foirPercent}%` : "—"],
                  ["Max EMI", formatRupees(selected.maxEmi)],
                  ["ROI", selected.roi !== null ? `${selected.roi}% p.a.` : "On request"],
                  ["Tenure", selected.tenureMonths ? `${selected.tenureMonths} months` : "—"],
                  ["Max loan amount", selected.maxLoanAmount !== null ? formatRupees(selected.maxLoanAmount) : "—"],
                  ["Estimated EMI", selected.emi !== null ? `${formatRupees(selected.emi)}/mo` : "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
                    <dd className="font-semibold text-slate-700">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </div>
      )}
    </AdminLayout>
  );
};

export default EligibilityChecks;
