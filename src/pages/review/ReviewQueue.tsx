import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  Info,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import PageHeader from "../../components/common/PageHeader";
import { TableCard, TableEmpty, TableError, TableSkeleton } from "../../components/common/TableShell";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../utils/apiError";
import { getAdminActivity, type AdminActivityResult, type AdminActivityUpdate } from "../../api/adminActivity";
import {
  REVIEW_STATE_META,
  readReviews,
  reviewKey,
  type ReviewRecord,
  type ReviewState,
} from "../../api/adminReviews";
import { adminLabel, avatarGradient, formatDateTime, initialsOf, roleLabel } from "../../utils/auditFormat";
import ReviewDialog from "./components/ReviewDialog";

/*
==========================================
Review Queue — sub admin ka home

Super admin ke paas poori organisation ka timeline hai; sub admin ko utna
dikhana zaroori nahi. Uska kaam ek queue hai: regular admins ke notes aur
recommendations jo abhi verify hone baaki hain.

  pending   -> Needs review
  verified  -> aage badh gaya
  returned  -> admin ko correction ke liye wapas
  escalated -> super admin ke decision ke liye
  decided   -> decision record ho gaya

Review state `loan_admin_reviews_v1` me local hai (backend endpoint abhi nahi),
isliye ye page bina API change kiye poora kaam karta hai.
==========================================
*/

const BRAND_GRADIENT = "linear-gradient(135deg, rgb(6,106,156), rgb(38,174,144))";

const WINDOWS = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
  { days: 0, label: "All" },
];

const TABS: Array<{ key: ReviewState; label: string }> = [
  { key: "pending", label: "Needs review" },
  { key: "verified", label: "Verified" },
  { key: "returned", label: "Returned" },
  { key: "escalated", label: "Escalated" },
  { key: "decided", label: "Decided" },
];

const kindLabel = (update: AdminActivityUpdate) =>
  update.kind === "recommendation" ? "Recommendation" : update.kind === "status" ? "Decision" : "Note";

const ReviewQueue = () => {
  const { isSuperAdmin, can, accessibleLoanTypes } = useAuth();

  const [result, setResult] = useState<AdminActivityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<ReviewState>("pending");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [reviews, setReviews] = useState<Record<string, ReviewRecord>>(readReviews);
  const [reviewing, setReviewing] = useState<AdminActivityUpdate | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAdminActivity({ days })
      .then((data) => {
        if (controller.signal.aborted) return;
        setResult(data);
        setError("");
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(getApiErrorMessage(err, "Could not load the review queue."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [days, reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  /* Sub admin ka scope uske assigned products tak — module-only account ke liye
     customers/franchise rows (jinpar slug nahi hota) sabse ahem hain. */
  const scoped = useMemo(() => {
    const updates = result?.updates ?? [];
    if (isSuperAdmin) return updates;
    if (accessibleLoanTypes.length === 0) return updates;
    const allowed = new Set<string>(accessibleLoanTypes.map((loan) => loan.slug));
    return updates.filter((update) => !update.slug || allowed.has(update.slug));
  }, [result, isSuperAdmin, accessibleLoanTypes]);

  const rows = useMemo(
    () =>
      scoped.map((update) => ({
        update,
        key: reviewKey(update),
        state: reviews[reviewKey(update)]?.state ?? ("pending" as ReviewState),
        record: reviews[reviewKey(update)],
      })),
    [scoped, reviews]
  );

  const counts = useMemo(() => {
    const base: Record<ReviewState, number> = {
      pending: 0,
      verified: 0,
      returned: 0,
      escalated: 0,
      decided: 0,
    };
    rows.forEach((row) => {
      base[row.state] += 1;
    });
    return base;
  }, [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((row) => row.state === tab)
      .filter((row) => {
        if (!needle) return true;
        const { update } = row;
        return [update.adminName, update.customerName, update.applicationNo, update.text, update.label]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((left, right) => right.update.addedAt.localeCompare(left.update.addedAt));
  }, [rows, tab, search]);

  const windowLabel = WINDOWS.find((option) => option.days === days)?.label ?? `${days}D`;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1440px] space-y-4">
        <PageHeader
          icon={ShieldCheck}
          title={isSuperAdmin ? "Review Queue" : "My Review Queue"}
          subtitle={
            isSuperAdmin
              ? "Regular admins ke kaam ka quality-check — jo sub admin ne verify ya escalate kiya."
              : "Aapke scope me aaye admin updates — verify karo, correction ke liye wapas bhejo, ya super admin ko escalate karo."
          }
          onRefresh={reload}
          refreshing={loading}
        >
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            Needs review: <span className="text-slate-900">{counts.pending}</span>
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            Verified: <span className="text-slate-900">{counts.verified}</span>
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            Escalated: <span className="text-slate-900">{counts.escalated}</span>
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            Window: <span className="text-slate-900">{windowLabel}</span>
          </span>
        </PageHeader>

        {!isSuperAdmin && !can("updates.review") && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <Info size={15} className="mt-0.5 shrink-0" />
            <p>
              Aapke paas review permission nahi hai — queue read-only hai. Super admin
              Team &amp; Access se permissions de sakta hai.
            </p>
          </div>
        )}

        {/* Toolbar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[190px] flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search admin, customer, message…"
                aria-label="Search review queue"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-8 text-xs text-slate-700 outline-none transition focus:border-[rgb(6,106,156)] focus:ring-2 focus:ring-[rgba(6,106,156,0.12)]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {WINDOWS.map((option) => (
                <button
                  key={option.days}
                  type="button"
                  onClick={() => {
                    setDays(option.days);
                    setLoading(true);
                  }}
                  aria-pressed={days === option.days}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    days === option.days ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                  style={days === option.days ? { background: BRAND_GRADIENT } : undefined}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
          <div className="space-y-4">
            {/* State tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {TABS.map((entry) => {
                const active = tab === entry.key;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setTab(entry.key)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition ${
                      active
                        ? "border-[rgb(6,106,156)] bg-[rgba(6,106,156,0.06)] text-[rgb(6,106,156)]"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${REVIEW_STATE_META[entry.key].dot}`} />
                    {entry.label}
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                      {counts[entry.key]}
                    </span>
                  </button>
                );
              })}
            </div>

            <TableCard>
              {error ? (
                <TableError message={error} onRetry={reload} />
              ) : loading && !result ? (
                <TableSkeleton rows={5} height="h-20" />
              ) : visible.length === 0 ? (
                <TableEmpty
                  icon={CheckCircle2}
                  title={
                    tab === "pending"
                      ? "Queue clear hai"
                      : `Koi ${REVIEW_STATE_META[tab].label.toLowerCase()} update nahi`
                  }
                  description={
                    tab === "pending"
                      ? "Naya admin note ya recommendation aate hi yahan dikhega."
                      : "Doosra tab chuno ya time window badhao."
                  }
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {visible.map(({ update, key, state, record }) => {
                    const meta = REVIEW_STATE_META[state];
                    return (
                      <li
                        key={key}
                        className={`flex gap-3 border-l-[3px] bg-white p-3.5 transition hover:bg-sky-50/30 ${meta.accent}`}
                      >
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
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                /super/i.test(update.adminRole)
                                  ? "bg-amber-50 text-amber-700"
                                  : /sub/i.test(update.adminRole)
                                    ? "bg-sky-50 text-sky-700"
                                    : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {roleLabel(update.adminRole) || "Admin"}
                            </span>
                            <span className="text-[11px] text-slate-400">on</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              {update.label}
                            </span>
                            {update.customerName && (
                              <span className="min-w-0 truncate text-xs font-medium text-slate-700">
                                {update.customerName}
                              </span>
                            )}
                            {update.applicationNo && (
                              <span className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                                {update.applicationNo}
                              </span>
                            )}
                          </div>

                          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                            {update.text || `${kindLabel(update)} added`}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">
                              {kindLabel(update)}
                            </span>
                            {update.suggestedStatus && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-amber-200/70">
                                Suggested: {update.suggestedStatus}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 ${meta.chip}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                            </span>
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <Clock3 size={11} /> {formatDateTime(update.addedAt)}
                            </span>
                            {record?.reviewedByName && (
                              <span className="text-slate-400">
                                by {adminLabel(record.reviewedByName)}
                              </span>
                            )}
                          </div>

                          {record?.note && (
                            <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-600">
                              {record.note}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={() => setReviewing(update)}
                            disabled={!can("updates.review")}
                            title={can("updates.review") ? "Review this update" : "Review permission nahi hai"}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-[rgb(6,106,156)] hover:text-[rgb(6,106,156)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <FileText size={12} /> {record ? "Update" : "Review"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TableCard>
          </div>

          {/* Side rail */}
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Workload
                </h2>
                <Users size={13} className="text-slate-300" />
              </div>
              {!can("admins.view") ? (
                <p className="px-1 py-2 text-xs text-slate-400">
                  Admin details dekhne ki permission nahi hai.
                </p>
              ) : (result?.admins ?? []).filter((entry) => entry.total > 0).length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-400">No activity yet</p>
              ) : (
                <div className="max-h-80 space-y-1 overflow-y-auto">
                  {(result?.admins ?? [])
                    .filter((entry) => entry.total > 0)
                    .sort((left, right) => right.total - left.total)
                    .map((entry) => (
                      <div
                        key={entry.id || entry.name}
                        className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-slate-50"
                      >
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

            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  How it flows
                </h2>
                <ArrowUpRight size={13} className="text-slate-300" />
              </div>
              <ol className="space-y-2 px-1 py-1 text-[11px] leading-relaxed text-slate-500">
                <li>
                  <span className="font-semibold text-slate-700">1. Admin ka update</span> — note ya
                  recommendation queue me aata hai.
                </li>
                <li>
                  <span className="font-semibold text-slate-700">2. Verify / Return</span> — sahi kaam
                  aage, adhoora kaam wajah ke saath wapas.
                </li>
                <li>
                  <span className="font-semibold text-slate-700">3. Escalate</span> — risky case super
                  admin ke decision ke liye.
                </li>
                <li>
                  <span className="font-semibold text-slate-700">4. Final decision</span> — super admin
                  ka, review record ke saath.
                </li>
              </ol>
            </section>

            <p className="flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
              <Info size={13} className="mt-0.5 shrink-0" />
              Review state is browser me save hota hai jab tak backend review endpoint nahi aata.
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
          }}
        />
      )}
    </AdminLayout>
  );
};

export default ReviewQueue;
