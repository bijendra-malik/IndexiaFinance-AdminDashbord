import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  BadgeCheck, CalendarClock, ChevronLeft, ChevronRight, ClipboardList, Inbox, Loader2, Mail,
  Phone, RefreshCw, Search, Trash2, Wallet, X, XCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  deleteEligibilityCheck,
  formatRupees,
  getEligibilityCheck,
  getEligibilityCheckStats,
  getEligibilityChecks,
  type EligibilityCheck,
  type EligibilityCheckList,
  type EligibilityCheckStats,
  type EligibilityProductRow,
  type EligibleFilter,
} from "../../api/eligibilityChecks";
import { KpiCard, Panel } from "../dashboard/components/DashboardCards";

/*
==========================================
Eligibility checks — /eligibility-checks (super admin only)

Website ke /eligibility-calculator se aaya har check yahan aata hai: kisne
(naam, mobile), kis product ke liye, kab check kiya, aur us waqt eligible tha
ya nahi. Numbers us check ke snapshot hain (rate card baad me badle to purana
record waisa hi rehta hai).

Page dashboard ke shared cards (KpiCard/Panel) hi use karta hai, taaki baaki
dashboard ke saath ek jaisa dikhe: upar headline numbers, beech me eligibility
rate + product mix, neeche filters aur checks table.
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

const count = (value: number) => value.toLocaleString("en-IN");

const percentOf = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

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

/* Har rejected check ka ek rule hota hai — code ko padhne layak label me badlo. */
const reasonCodeLabel = (code: string) =>
  code
    .toLowerCase()
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

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

/*
Ek hi donut ring dono jagah: eligibility rate card aur product tile. Sirf
size/colors badalte hain, geometry aur progress arc yahin rehti hai. Total 0
par arc nahi banti, ring khaali dikhti hai — panel ka shape bana rehta hai.
*/
const Ring = ({
  size,
  stroke,
  share,
  track,
  progress,
  className,
  label,
  children,
}: {
  size: number;
  stroke: number;
  /** 0..1 */
  share: number;
  track: string;
  progress: string;
  className: string;
  label?: string;
  children: ReactNode;
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative shrink-0">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className={className}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        {share > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={progress}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * share} ${circumference}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
};

const RateRing = ({ stats }: { stats: EligibilityCheckStats }) => {
  const total = stats.total;

  return (
    <div className="flex flex-col items-center gap-5 px-5 pb-5 sm:flex-row sm:justify-center sm:gap-7">
      <Ring
        size={170}
        stroke={16}
        share={percentOf(stats.eligible, total) / 100}
        track="#f1f5f9"
        progress="#10b981"
        className="h-40 w-40 -rotate-90"
        label={`${stats.eligible} of ${total} checks eligible`}
      >
        <span className="text-3xl font-bold leading-none tabular-nums text-slate-900">
          {stats.eligibleRate}%
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          eligible
        </span>
      </Ring>

      <ul className="w-full space-y-2.5 text-xs sm:w-auto">
        {[
          { key: "Eligible", value: stats.eligible, dot: "bg-emerald-500", tone: "text-slate-800" },
          { key: "Not eligible", value: stats.notEligible, dot: "bg-rose-400", tone: "text-slate-800" },
          { key: "Total checks", value: stats.total, dot: "bg-slate-300", tone: "text-slate-500" },
        ].map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
            <span className="flex-1 text-slate-500">{row.key}</span>
            <span className={`tabular-nums font-bold ${row.tone}`}>{count(row.value)}</span>
            <span className="w-12 text-right tabular-nums text-slate-400">
              {row.key === "Total checks" ? "100%" : `${percentOf(row.value, total).toFixed(0)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Product-wise tiles — har product ka apna chhota ring (eligible share) aur
 * eligible/rejected counts. Ring ka base rose hai aur upar emerald arc, isliye
 * ek nazar me pata chalta hai kitne percent checks pass hue. Click = filter.
 */
const ProductRing = ({ eligible, total }: { eligible: number; total: number }) => {
  const share = total > 0 ? eligible / total : 0;

  return (
    <Ring
      size={44}
      stroke={6}
      share={share}
      track="#fecdd3"
      progress="#10b981"
      className="h-11 w-11 -rotate-90"
    >
      <span className="text-[10px] font-bold tabular-nums text-slate-700">
        {Math.round(share * 100)}%
      </span>
    </Ring>
  );
};

const ProductMix = ({
  rows,
  selected,
  onPick,
}: {
  rows: EligibilityProductRow[];
  selected: string;
  onPick: (product: string) => void;
}) => {
  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-5 py-10 text-center">
        <Inbox size={20} className="text-slate-300" />
        <p className="text-sm font-semibold text-slate-600">No product activity yet</p>
        <p className="max-w-xs text-xs leading-relaxed text-slate-400">
          Website se pehla check aate hi har product ka eligible vs not-eligible split yahan dikhega.
        </p>
      </div>
    );
  }

  const totalChecks = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="grid gap-2.5 px-3 pb-4 sm:[grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
      {rows.map((row) => {
        const rejected = row.total - row.eligible;
        const active = selected === row.product;

        return (
          <button
            key={row.product}
            type="button"
            onClick={() => onPick(active ? "all" : row.product)}
            title={`${row.label}: ${row.total} checks, ${row.eligible} eligible`}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
              active
                ? "border-sky-300 bg-sky-50/70 ring-1 ring-sky-200"
                : "border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50"
            }`}
          >
            <ProductRing eligible={row.eligible} total={row.total} />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-semibold text-slate-700">{row.label}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                  {percentOf(row.total, totalChecks).toFixed(0)}%
                </span>
              </div>
              <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                {count(row.total)} checks
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-semibold">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {count(row.eligible)} eligible
                </span>
                {rejected > 0 && (
                  <span className="inline-flex items-center gap-1 text-rose-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    {count(rejected)} rejected
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  /* Delete confirm modal — null hone par modal band. */
  const [pendingDelete, setPendingDelete] = useState<EligibilityCheck | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

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
    setPage(1);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    resetPage();
    setSearch(searchInput.trim());
  };

  const refresh = () => {
    setReloadKey((current) => current + 1);
  };

  /*
  Row ka data list me already hai, isliye drawer turant khulta hai; phir
  GET /eligibility-checks/:id se fresh record aata hai (kisi aur admin ne
  check update/delete kiya ho to purana na dikhe). Effect ka cancel flag
  purani response ko naye drawer par overwrite hone se rokta hai.
  */
  useEffect(() => {
    if (!selectedId) return undefined;

    let cancelled = false;
    setDetailLoading(true);

    getEligibilityCheck(selectedId)
      .then((fresh) => {
        if (!cancelled) setSelected(fresh);
      })
      .catch(() => {
        /* Detail fail ho to list row hi dikhado — drawer khaali na ho. */
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const openCheck = (check: EligibilityCheck) => {
    setSelected(check);
    setSelectedId(check.id);
  };

  const closeCheck = () => {
    setSelectedId(null);
    setSelected(null);
    setDetailLoading(false);
  };

  const requestDelete = (check: EligibilityCheck) => setPendingDelete(check);

  const cancelDelete = () => {
    if (!deleting) setPendingDelete(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    const check = pendingDelete;
    const label = check.checkNo || check.name || "this check";

    setDeleting(true);
    setError("");
    try {
      await deleteEligibilityCheck(check.id);
      setPendingDelete(null);
      closeCheck();
      setNotice(`${label} deleted.`);

      /* Page ki aakhri row delete hui to pichhle page par aa jao. */
      if (checks.length === 1 && page > 1) setPage((current) => current - 1);
      else refresh();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, "Could not delete this check."));
    } finally {
      setDeleting(false);
    }
  };

  const pickProduct = (nextProduct: string) => {
    resetPage();
    setProduct(nextProduct);
  };

  const quickFilters: { value: EligibleFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: summary.total },
    { value: "yes", label: "Eligible", count: summary.eligible },
    { value: "no", label: "Not eligible", count: summary.notEligible },
  ];

  const kpis = [
    {
      label: "Total checks",
      value: count(summary.total),
      sub: "All time",
      icon: ClipboardList,
      color: "#0369a1",
      tint: "#e0f2fe",
    },
    {
      label: "Eligible",
      value: count(summary.eligible),
      sub: `${summary.eligibleRate}% of all checks`,
      icon: BadgeCheck,
      color: "#047857",
      tint: "#ecfdf5",
    },
    {
      label: "Not eligible",
      value: count(summary.notEligible),
      sub: "Stopped by income, age or limit rules",
      icon: XCircle,
      color: "#be123c",
      tint: "#fff1f2",
    },
    {
      label: "Today",
      value: count(summary.today),
      sub: `${count(summary.todayEligible)} eligible today`,
      icon: CalendarClock,
      color: "#b45309",
      tint: "#fffbeb",
    },
    {
      label: "Avg net income",
      value: formatRupees(summary.avgNetIncome),
      sub: "Income left after existing EMIs",
      icon: Wallet,
      color: "#6d28d9",
      tint: "#f5f3ff",
    },
  ];

  const hasFilters =
    Boolean(search || from || to) || product !== "all" || eligible !== "all";

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

      {notice && (
        <p
          role="status"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700"
        >
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            className="text-emerald-600 hover:text-emerald-800"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      {/* Headline numbers */}
      <div className={`mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5 ${loading ? "opacity-60" : ""}`}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Eligibility rate + product mix */}
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <Panel
          title="Eligibility rate"
          subtitle="Share of checks that came back eligible"
        >
          <RateRing stats={summary} />
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Product mix"
          subtitle="Checks per product — click a tile to filter the table"
          action={
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">
              {summary.byProduct.length} product{summary.byProduct.length === 1 ? "" : "s"}
            </span>
          }
        >
          <ProductMix rows={summary.byProduct} selected={product} onPick={pickProduct} />
        </Panel>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {quickFilters.map((tab) => {
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
                  {count(tab.count)}
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
            {hasFilters && (
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

      {/* Checks table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">All checks</h3>
            <p className="text-xs text-slate-500">
              {count(totalCount)} record{totalCount === 1 ? "" : "s"}
              {product !== "all" && summary.byProduct.some((row) => row.product === product)
                ? ` · ${summary.byProduct.find((row) => row.product === product)?.label}`
                : ""}
            </p>
          </div>
          <span className="text-[11px] text-slate-400">Latest first</span>
        </div>

        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">Loading checks…</p>
        ) : checks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Inbox size={22} />
            </span>
            <p className="text-sm font-semibold text-slate-700">No eligibility checks yet</p>
            <p className="max-w-sm text-xs leading-relaxed text-slate-400">
              Jab koi website ke /eligibility-calculator se check karega, uska result — eligible ya
              not eligible, loan amount aur EMI — yahan aa jayega.
            </p>
            <button
              type="button"
              onClick={refresh}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[rgb(6,106,156)] hover:text-[rgb(6,106,156)]"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur">
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
                  <tr
                    key={check.id}
                    onClick={() => openCheck(check)}
                    className="cursor-pointer align-top transition hover:bg-slate-50/70"
                  >
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
                          <span className="block max-w-[12rem] truncate font-semibold text-slate-800">
                            {check.name || "Unnamed"}
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            {check.checkNo || "—"} · {dateTime(check.checkedAt)}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <a
                        href={`tel:${check.mobile}`}
                        onClick={(event) => event.stopPropagation()}
                        className="block whitespace-nowrap hover:underline"
                      >
                        {check.mobile || "—"}
                      </a>
                      {check.email && (
                        <a
                          href={`mailto:${check.email}`}
                          onClick={(event) => event.stopPropagation()}
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
                        {check.occupation || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[rgba(6,106,156,0.08)] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[rgb(6,106,156)]">
                        {check.productLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-600">
                      <p className="font-semibold text-slate-700">
                        {formatRupees(check.monthlyIncome)}/mo
                      </p>
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
                        <p className="text-[11px] text-slate-400">
                          EMI {formatRupees(check.emi)}/mo
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pricing check={check} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openCheck(check);
                          }}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-[rgb(6,106,156)] hover:text-[rgb(6,106,156)]"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            requestDelete(check);
                          }}
                          disabled={deleting}
                          title="Delete check"
                          aria-label={`Delete ${check.checkNo || check.name}`}
                          className="rounded-lg border border-slate-200 p-1 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
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
              {count(totalCount)} checks · page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View modal — centered, poora data */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4"
          onClick={closeCheck}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Eligibility check ${selected.checkNo || selected.name}`}
            className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
                  style={{ background: BRAND }}
                  aria-hidden
                >
                  {initialsOf(selected.name)}
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Eligibility check {selected.checkNo || "—"}
                  </p>
                  <h2 className="text-lg font-bold text-slate-900">{selected.name || "Unnamed"}</h2>
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    {dateTime(selected.checkedAt)} · {selected.source || "website"}
                    {detailLoading && <Loader2 size={11} className="animate-spin" />}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCheck}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </header>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
              <section
                className={`rounded-xl border p-3 ${
                  selected.eligible
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-rose-200 bg-rose-50/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Result
                  </p>
                  {selected.eligible ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      <BadgeCheck size={12} /> Eligible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                      <XCircle size={12} /> Not eligible
                    </span>
                  )}
                </div>

                <p className="mt-2 text-lg font-bold text-slate-900">
                  {selected.eligible
                    ? formatRupees(selected.maxLoanAmount)
                    : selected.reason || "Not eligible for this product."}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {selected.message ||
                    (selected.eligible
                      ? `Up to ${formatRupees(selected.maxLoanAmount)} for ${selected.tenureMonths} months at ${selected.roi}% p.a.`
                      : "No message was stored for this check.")}
                </p>

                {selected.reasonCode && (
                  <p className="mt-2 inline-flex rounded-md bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700 ring-1 ring-rose-200">
                    {reasonCodeLabel(selected.reasonCode)}
                  </p>
                )}

                {selected.suggestions.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-600">
                    {selected.suggestions.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Applicant
                  </p>
                  <dl className="mt-1.5 space-y-1.5 text-xs">
                    {[
                      ["Age", selected.age !== null ? `${selected.age} yrs` : "—"],
                      ["Occupation", selected.occupation || "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3">
                        <dt className="text-slate-400">{label}</dt>
                        <dd className="text-right font-semibold text-slate-700">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-2 space-y-1.5 text-xs">
                    <a
                      href={`tel:${selected.mobile}`}
                      className="flex items-center gap-1.5 text-slate-700 hover:text-[rgb(6,106,156)]"
                    >
                      <Phone size={12} className="shrink-0 text-slate-400" />
                      {selected.mobile || "—"}
                    </a>
                    <a
                      href={`mailto:${selected.email}`}
                      className="flex items-center gap-1.5 break-all text-slate-700 hover:text-[rgb(6,106,156)]"
                    >
                      <Mail size={12} className="shrink-0 text-slate-400" />
                      {selected.email || "—"}
                    </a>
                  </div>
                </section>

                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Product
                  </p>
                  <dl className="mt-1.5 space-y-1.5 text-xs">
                    {[
                      ["Product", selected.productLabel],
                      ["Code", selected.product || "—"],
                      ["Category", selected.family || "—"],
                      ["ROI", selected.roi !== null ? `${selected.roi}% p.a.` : "On request"],
                      ["Tenure", selected.tenureMonths ? `${selected.tenureMonths} months` : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3">
                        <dt className="text-slate-400">{label}</dt>
                        <dd className="max-w-[60%] text-right font-semibold break-words text-slate-700">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Calculation
                  </p>
                  <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                    {[
                      ["Monthly income", formatRupees(selected.monthlyIncome)],
                      ["Existing EMI", formatRupees(selected.existingEmi)],
                      ["Net income", formatRupees(selected.netIncome)],
                      ["FOIR", selected.foirPercent !== null ? `${selected.foirPercent}%` : "—"],
                      ["Max EMI", formatRupees(selected.maxEmi)],
                      ["Max loan", formatRupees(selected.maxLoanAmount)],
                      ["Estimated EMI", selected.emi !== null ? formatRupees(selected.emi) : "—"],
                      ["Binding cap", selected.binding || "—"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                          {label}
                        </dt>
                        <dd className="font-semibold text-slate-700">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                {selected.caps.length > 0 && (
                  <section className="sm:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Caps used
                    </p>
                    <ul className="mt-1.5 grid gap-1.5 text-xs sm:grid-cols-2">
                      {selected.caps.map((cap) => {
                        const isBinding =
                          selected.binding !== null && cap.label === selected.binding;
                        return (
                          <li
                            key={`${cap.key}-${cap.label}`}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                              isBinding
                                ? "border-amber-200 bg-amber-50/70"
                                : "border-slate-200 bg-slate-50/60"
                            }`}
                          >
                            <span className="min-w-0 text-slate-600">
                              {cap.label}
                              {isBinding && (
                                <span className="ml-1.5 rounded bg-white px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                                  limit
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                              {formatRupees(cap.value)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                <section className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Record
                  </p>
                  <p className="mt-1.5 font-mono text-xs break-all text-slate-600">
                    {selected.id || "—"}
                  </p>
                </section>
              </div>
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
              <p className="text-[11px] text-slate-400">Delete is permanent.</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeCheck}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => requestDelete(selected)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 size={13} /> Delete check
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Delete confirm — centered modal */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          onClick={cancelDelete}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Delete eligibility check"
            className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <Trash2 size={20} />
            </span>
            <h2 className="mt-3 text-base font-bold text-slate-900">Delete this check?</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {pendingDelete.checkNo ? `${pendingDelete.checkNo} · ` : ""}
              {pendingDelete.name || "Unnamed"} ka record permanently delete ho jayega — ye wapas
              nahi aayega.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={deleting}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default EligibilityChecks;
