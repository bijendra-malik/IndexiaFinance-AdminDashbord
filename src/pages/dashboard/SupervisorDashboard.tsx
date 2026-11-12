import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Info,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../utils/apiError";
import { ADMIN_PERMISSION_DEFS } from "../../constants/adminPermissions";
import {
  REVIEW_STATE_META,
  fetchReceivedReviews,
  fetchReviews,
  reviewKey,
  type ReviewRecord,
} from "../../api/adminReviews";
import { getSupervisorStats, type SupervisorStats } from "../../api/supervisorDashboard";
import type { AdminActivityUpdate } from "../../api/adminActivity";
import {
  adminLabel,
  avatarGradient,
  formatDateTime,
  initialsOf,
  roleLabel,
} from "../../utils/auditFormat";
import ReviewDialog from "../review/components/ReviewDialog";

/*
==========================================
Sub admin dashboard — supervision console

Regular admin ko loan counts aur product charts dikhte hain; sub admin ka kaam
alag hai. Uska main dashboard ek **kaam ki list** hona chahiye:

  1. Kitna kaam review hone ko pada hai (aur kitna purana hai)
  2. Kis admin par kitna load hai
  3. Uske areas — loan products aur modules dono
  4. Usne khud kya review kiya
  5. Uske paas kaunsi permissions hain

Data ab `/dashboard/stats` ke supervisor payload se aata hai (server counts),
`/activity` ke 500 rows se nahi — isliye numbers queue se match karte hain aur
bade data par adhoore nahi hote.
==========================================
*/

const BRAND_GRADIENT = "linear-gradient(135deg, rgb(49,46,129), rgb(6,106,156), rgb(38,174,144))";

const MODULE_LABELS: Record<"customers" | "franchises", string> = {
  customers: "Customers",
  franchises: "Franchises",
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  hint,
  tile,
}: {
  icon: typeof Clock3;
  label: string;
  value: number;
  hint: string;
  tile: string;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tile}`}>
        <Icon size={15} />
      </span>
    </div>
    <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-slate-800">{value}</p>
    <p className="mt-2 text-[11px] leading-snug text-slate-400">{hint}</p>
  </div>
);

/* Super admin ke review ka record sahi page par le jaane ke liye. */
const feedbackPath = (record: ReviewRecord): string | null => {
  if (!record.applicationId) return null;
  if (record.entity === "franchise") return `/franchises/${record.applicationId}`;
  if (record.entity === "customer") {
    return `/customers?customer=${encodeURIComponent(record.applicationId)}`;
  }
  return record.slug
    ? `/applications/${encodeURIComponent(record.slug)}/${encodeURIComponent(record.applicationId)}`
    : null;
};

const daysOld = (iso: string): number => {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
};

const ageChip = (iso: string) => {
  const age = daysOld(iso);
  if (age <= 0) {
    return { label: "Today", className: "bg-slate-100 text-slate-500" };
  }
  if (age >= 5) {
    return { label: `${age}d old`, className: "bg-rose-50 text-rose-600 ring-1 ring-rose-200/70" };
  }
  if (age >= 2) {
    return { label: `${age}d old`, className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70" };
  }
  return { label: "1d old", className: "bg-slate-100 text-slate-500" };
};

const scopeText = (stats: SupervisorStats | null): string => {
  if (!stats) return "Scope load ho raha hai";
  if (stats.scope === "both") return "Loans + Modules";
  if (stats.scope === "modules") return "Customers & Franchises";
  if (stats.scope === "loans") return "Loan products";
  if (stats.scope === "all") return "All areas";
  return "Koi area assign nahi";
};

const SupervisorDashboard = () => {
  const { admin, can, permissions } = useAuth();

  const [stats, setStats] = useState<SupervisorStats | null>(null);
  const [reviews, setReviews] = useState<Record<string, ReviewRecord>>({});
  const [received, setReceived] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewing, setReviewing] = useState<AdminActivityUpdate | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getSupervisorStats()
      .then((data) => {
        if (controller.signal.aborted) return;
        setStats(data);
        setError("");
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(getApiErrorMessage(err, "Could not load the supervision dashboard."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    fetchReviews().then((records) => {
      if (!cancelled) setReviews(records);
    });
    fetchReceivedReviews().then((records) => {
      if (!cancelled) setReceived(records);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const counts = stats?.counts ?? {
    pending: 0,
    verified: 0,
    returned: 0,
    escalated: 0,
    decided: 0,
  };
  const pending = stats?.pending ?? [];
  const products = stats?.products ?? [];
  const modules = stats?.modules ?? [];

  /* Review record me reviewer ka email server se aata hai — usse "mera kaam". */
  const myReviews = useMemo(() => {
    const email = (admin?.email ?? "").trim().toLowerCase();
    if (!email) return [];
    return Object.values(reviews)
      .filter((record) => (record.reviewedBy ?? "").trim().toLowerCase() === email)
      .sort((left, right) => String(right.reviewedAt).localeCompare(String(left.reviewedAt)))
      .slice(0, 5);
  }, [reviews, admin?.email]);

  const admins = useMemo(
    () => [...(stats?.admins ?? [])].filter((entry) => entry.total > 0).sort((a, b) => b.total - a.total),
    [stats?.admins]
  );

  const grantedKeys = stats?.permissions.length ? stats.permissions : permissions;
  const granted = ADMIN_PERMISSION_DEFS.filter((permission) =>
    grantedKeys.includes(permission.key)
  );

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1440px] space-y-4">
        {/* Hero */}
        <section
          className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          style={{ background: BRAND_GRADIENT }}
        >
          <span className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/10" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
                <ShieldCheck size={11} /> Sub admin view
              </span>
              <h1 className="mt-2 text-2xl font-bold leading-tight">Supervision Dashboard</h1>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/80">
                Namaste {admin?.name ?? "Supervisor"} — regular admins ka kaam verify karo, galat
                kaam correction ke liye wapas bhejo, aur risky cases super admin ko escalate karo.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-lg bg-white/15 px-2.5 py-1 font-semibold backdrop-blur">
                  {counts.pending} needs review
                </span>
                <span className="rounded-lg bg-white/15 px-2.5 py-1 font-semibold backdrop-blur">
                  {scopeText(stats)}
                </span>
                <span className="rounded-lg bg-white/10 px-2.5 py-1 text-white/85 backdrop-blur">
                  Last {stats?.windowDays || 30} days
                </span>
                <span className="rounded-lg bg-white/10 px-2.5 py-1 text-white/85 backdrop-blur">
                  {granted.length} permissions granted
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-60"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              {can("updates.review") && (
                <Link
                  to="/review"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-[rgb(6,106,156)] shadow-sm transition hover:brightness-105"
                >
                  Review Queue <ArrowUpRight size={13} />
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* KPI — final decision bhi count hona chahiye */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            icon={Clock3}
            label="Needs review"
            value={counts.pending}
            hint="Aapke areas me jo abhi verify nahi hue"
            tile="bg-amber-50 text-amber-600"
          />
          <StatCard
            icon={CheckCircle2}
            label="Verified"
            value={counts.verified}
            hint="Aage badh chuke — decision ke liye ready"
            tile="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            icon={RefreshCw}
            label="Returned"
            value={counts.returned}
            hint="Correction ke liye admin ko wapas"
            tile="bg-rose-50 text-rose-600"
          />
          <StatCard
            icon={ArrowUpRight}
            label="Escalated"
            value={counts.escalated}
            hint="Super admin ke decision ke liye bheje gaye"
            tile="bg-sky-50 text-sky-600"
          />
          <StatCard
            icon={ShieldCheck}
            label="Decision recorded"
            value={counts.decided}
            hint="Final call record ho chuka"
            tile="bg-indigo-50 text-indigo-600"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          {/* Priority queue */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(6,106,156,0.08)] text-[rgb(6,106,156)]">
                  <Clock3 size={14} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">Needs your review</h2>
                  <p className="text-[11px] text-slate-400">
                    Purana kaam pehle — 5 din se zyada pending laal dikhta hai.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/70">
                  {stats?.pendingTotal ?? counts.pending} pending
                </span>
                {can("updates.review") && (
                  <Link to="/review" className="text-[11px] font-semibold text-[rgb(6,106,156)] hover:underline">
                    View all
                  </Link>
                )}
              </div>
            </header>

            {error ? (
              <div className="px-4 py-12 text-center" role="alert">
                <p className="text-sm text-rose-600">{error}</p>
                <button
                  type="button"
                  onClick={refresh}
                  className="mt-2 text-xs font-semibold text-[rgb(6,106,156)] hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : loading && !stats ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <RefreshCw size={16} className="animate-spin" /> Loading supervision data…
              </div>
            ) : pending.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                  <CheckCircle2 size={22} />
                </span>
                <p className="text-sm font-semibold text-slate-600">Queue clear hai</p>
                <p className="mt-1 text-xs text-slate-400">
                  Naya admin note ya recommendation aate hi yahan dikhega.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pending.map((update) => {
                  const key = reviewKey(update);
                  const age = ageChip(update.addedAt);
                  return (
                    <li key={key} className="flex gap-3 border-l-[3px] border-l-amber-400 p-3.5 transition hover:bg-sky-50/30">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm ring-2 ring-white"
                        style={{ background: avatarGradient(update.adminName) }}
                        aria-hidden
                      >
                        {initialsOf(update.adminName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span className="text-sm font-semibold text-slate-800">
                            {adminLabel(update.adminName)}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                            {roleLabel(update.adminRole) || "Admin"}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {update.label}
                          </span>
                          {update.customerName && (
                            <span className="min-w-0 truncate text-xs font-medium text-slate-700">
                              {update.customerName}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-700">
                          {update.text || "Note added"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                          {update.suggestedStatus && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-amber-200/70">
                              Suggested: {update.suggestedStatus}
                            </span>
                          )}
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${age.className}`}>
                            {age.label}
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Clock3 size={11} /> {formatDateTime(update.addedAt)}
                          </span>
                          {can("updates.review") && (
                            <button
                              type="button"
                              onClick={() => setReviewing(update)}
                              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 transition hover:border-[rgb(6,106,156)] hover:text-[rgb(6,106,156)]"
                            >
                              <ShieldCheck size={12} /> Review
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Right rail */}
          <aside className="space-y-4">
            {/* Scope — dono areas */}
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Your areas
                </h2>
                <Info size={13} className="text-slate-300" />
              </div>
              <p className="px-1 pb-1 text-[11px] font-semibold text-slate-600">{scopeText(stats)}</p>

              {products.length > 0 && (
                <>
                  <p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Loan products ({products.length})
                  </p>
                  <div className="flex flex-wrap gap-1 px-1 py-1">
                    {products.slice(0, 6).map((product) => (
                      <span
                        key={product.key || product.slug || product.label}
                        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                      >
                        {product.label}
                      </span>
                    ))}
                    {products.length > 6 && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        +{products.length - 6}
                      </span>
                    )}
                  </div>
                </>
              )}

              {modules.length > 0 && (
                <>
                  <p className="px-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Modules ({modules.length})
                  </p>
                  <div className="flex flex-wrap gap-1 px-1 py-1">
                    {modules.map((module) => (
                      <span
                        key={module}
                        className="rounded-md bg-[rgba(6,106,156,0.08)] px-1.5 py-0.5 text-[10px] font-semibold text-[rgb(6,106,156)]"
                      >
                        {MODULE_LABELS[module]}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {products.length === 0 && modules.length === 0 && (
                <p className="px-1 py-2 text-xs text-slate-400">
                  Super admin ne abhi koi area assign nahi kiya.
                </p>
              )}
            </section>

            {/* Aapka apna review kaam */}
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Your recent reviews
                </h2>
                <CheckCircle2 size={13} className="text-slate-300" />
              </div>
              {myReviews.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-400">
                  Abhi tak koi review nahi kiya. Queue se pehla update uthao.
                </p>
              ) : (
                <ul className="space-y-1.5 px-1 py-1">
                  {myReviews.map((record) => {
                    const meta = REVIEW_STATE_META[record.state];
                    return (
                      <li key={record.key} className="rounded-lg border border-slate-100 px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${meta.chip}`}>
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDateTime(record.reviewedAt)}
                          </span>
                        </div>
                        {record.note && (
                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600">
                            {record.note}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Super admin ka feedback mere updates par */}
            {received.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Feedback from super admin
                  </h2>
                  <MessageSquare size={13} className="text-slate-300" />
                </div>
                <ul className="space-y-1.5 px-1 py-1">
                  {received.slice(0, 5).map((record) => {
                    const meta = REVIEW_STATE_META[record.state];
                    const path = feedbackPath(record);
                    return (
                      <li key={record.key} className="rounded-lg border border-slate-100 px-2 py-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${meta.chip}`}
                          >
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDateTime(record.reviewedAt)}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600">
                          {record.note || "Koi note nahi likha."}
                        </p>
                        {path && (
                          <Link
                            to={path}
                            className="mt-1 inline-block text-[10px] font-semibold text-[rgb(6,106,156)] hover:underline"
                          >
                            Open record
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Team workload — sirf regular admins */}
            {can("admins.view") && (
              <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Admins in scope
                  </h2>
                  <Users size={13} className="text-slate-300" />
                </div>
                {admins.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-slate-400">No admin activity yet</p>
                ) : (
                  <div className="space-y-0.5">
                    {admins.slice(0, 5).map((entry) => (
                      <div key={entry.id || entry.name} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: avatarGradient(entry.name) }}
                          aria-hidden
                        >
                          {initialsOf(entry.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-700">
                            {adminLabel(entry.name)}
                          </p>
                          <p className="truncate text-[10px] text-slate-400">
                            {roleLabel(entry.role) || "Admin"}
                            {entry.loginId ? ` · ${entry.loginId}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500">
                          {entry.total}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Permissions — server truth */}
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Your permissions
                </h2>
                <ShieldCheck size={13} className="text-slate-300" />
              </div>
              {granted.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-400">Koi permission nahi mili.</p>
              ) : (
                <ul className="space-y-1 px-1 py-1">
                  {granted.map((permission) => (
                    <li key={permission.key} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-600">
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                      {permission.label}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
              <Info size={13} className="mt-0.5 shrink-0" />
              Sirf regular admins ka kaam queue me aata hai — apne updates aur super admin ke
              decisions yahan nahi dikhte. Permissions aur areas super admin Team &amp; Access se
              badalta hai.
            </p>
          </aside>
        </div>
      </div>

      {reviewing && (
        <ReviewDialog
          update={reviewing}
          existing={reviews[reviewKey(reviewing)]}
          onClose={() => setReviewing(null)}
          onSaved={(records) => {
            setReviews(records);
            setReviewing(null);
            refresh();
          }}
        />
      )}
    </AdminLayout>
  );
};

export default SupervisorDashboard;
