import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText, MessageSquare, RefreshCw, ShieldCheck,
  UserRound, XCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../utils/apiError";
import { isFranchiseOnlyScope } from "../../utils/adminAccess";
import {
  getDashboardStats,
  type AdminActivityUpdate,
  type DashboardStats,
  type ProductStat,
  type RecentApplication,
} from "../../api/dashboard";
import { getLoansBySlug, isFranchiseCustomerLoan, type PersonalLoan } from "../../api/personalLoans";
import { getLoanTypeLabel, LOAN_TYPES } from "../../constants/loanTypes";
import {
  adminLabel, applicationDetailPath, formatCompactCurrency, formatCurrency, formatDateTime,
  percentOf, roleLabel, shortDateTime, type Bucket,
} from "./dashboardUtils";
import { updateTagLabel } from "../../api/adminUpdates";
import {
  REVIEW_STATE_META,
  fetchReceivedReviews,
  type ReviewRecord,
} from "../../api/adminReviews";
import { avatarGradient, initialsOf } from "../../utils/auditFormat";
import { ContextStrip, DataWarning, KpiCard, Panel } from "./components/DashboardCards";
import ProductBars from "./components/ProductBars";
import StatusDonut from "./components/StatusDonut";
import { AdminUpdatesTable, RecentAccountsTable, RecentApplicationsTable } from "./components/DashboardTables";
import ProductExplorer from "./components/ProductExplorer";
import ModuleDashboardOverview from "./ModuleDashboardOverview";
import SupervisorDashboard from "./SupervisorDashboard";

/** Product rows have no dependable slug, so fall back to matching the label. */
const productSlug = (row: { slug?: string; label?: string }): string | undefined =>
  row.slug ??
  LOAN_TYPES.find((loan) => loan.label.toLowerCase() === (row.label ?? "").toLowerCase())?.slug;

type TabId = "products" | "applications" | "updates" | "accounts";

const TABS: { id: TabId; label: string }[] = [
  { id: "products", label: "By Product" },
  { id: "applications", label: "Recent Applications" },
  { id: "updates", label: "Admin Updates" },
  { id: "accounts", label: "Recent Accounts" },
];

/**
 * One admin update, read like a sentence: who (role) → on which product /
 * applicant → what they wrote → when. The stored name can be an email and the
 * role arrives as "SuperAdmin", so both are humanised here.
 */
/*
Super admin aur regular admin ka dashboard ek jaisa nahi dikhna chahiye — role
ke hisaab se hero, tab accent aur highlight colour badalte hain, layout same
rehta hai.
*/
const ROLE_THEME = {
  super: {
    label: "Super admin view",
    icon: ShieldCheck,
    gradient: "linear-gradient(135deg, rgb(6,106,156) 0%, rgb(17,146,138) 58%, rgb(38,174,144) 100%)",
    accent: "rgb(6,106,156)",
    soft: "rgba(6,106,156,0.1)",
    hairline: "rgba(250,204,21,0.85)",
  },
  admin: {
    label: "Admin view",
    icon: UserRound,
    gradient: "linear-gradient(135deg, rgb(49,46,129) 0%, rgb(67,56,202) 52%, rgb(14,165,233) 100%)",
    accent: "rgb(67,56,202)",
    soft: "rgba(67,56,202,0.1)",
    hairline: "rgba(125,211,252,0.9)",
  },
} as const;

/* Customer/franchise rows apne record par jaate hain, loans apne application par. */
const updateTargetPath = (update: AdminActivityUpdate): string | null | undefined => {
  if (update.entity === "customer") {
    return `/customers?customer=${encodeURIComponent(update.entityId || update.applicationId)}`;
  }
  if (update.entity === "franchise") {
    return `/franchises/${update.entityId || update.applicationId}`;
  }
  return applicationDetailPath(update.slug, update.applicationId);
};

/* Review record se us record ka page — feedback card ka "Open" link. */
const feedbackTargetPath = (record: ReviewRecord): string | null => {
  if (record.entity === "franchise" && record.applicationId) {
    return `/franchises/${record.applicationId}`;
  }
  if (record.entity === "customer" && record.applicationId) {
    return `/customers?customer=${encodeURIComponent(record.applicationId)}`;
  }
  return applicationDetailPath(record.slug, record.applicationId);
};

const AdminUpdateRow = ({ update }: { update: AdminActivityUpdate }) => {
  const detailPath = updateTargetPath(update);
  const who = adminLabel(update.addedByName);
  const role = roleLabel(update.addedByRole);
  const isDecision = update.kind === "status";
  const isRecommendation = update.kind === "recommendation";
  const recordLabel =
    update.entity === "customer" ? "Customer" : update.entity === "franchise" ? "Franchise" : update.label;

  // Left border = kind, so the feed can be scanned without reading the chips.
  const accent = isDecision
    ? "border-l-emerald-400"
    : isRecommendation
      ? "border-l-amber-400"
      : "border-l-slate-300";

  // One chip carries the whole meaning: note, recommendation or decision.
  const kindChip = isDecision
    ? {
        text: update.suggestedStatus ? `Decision: ${update.suggestedStatus}` : "Decision",
        className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      }
    : isRecommendation
      ? {
          text: update.suggestedStatus
            ? `Recommends ${update.suggestedStatus}`
            : "Recommendation",
          className: "bg-amber-50 text-amber-800 ring-amber-200",
        }
      : { text: "Note", className: "bg-slate-50 text-slate-600 ring-slate-200" };

  const statusTone =
    update.loanStatus === "Approved"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : update.loanStatus === "Rejected"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-amber-50 text-amber-700 ring-amber-200";

  return (
    <li
      className={`flex items-start gap-3 border-l-[3px] px-5 py-3 transition hover:bg-slate-50/70 ${accent}`}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: avatarGradient(who) }}
        title={update.addedByName}
        aria-hidden
      >
        {initialsOf(who)}
      </span>

      <div className="min-w-0 flex-1">
        {/* kaun + kab, ek line me */}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-semibold text-slate-800" title={update.addedByName}>
            {who}
          </span>
          {role && (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isDecision || /super/i.test(update.addedByRole)
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {role}
            </span>
          )}
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] text-slate-400">
            <Clock size={11} /> {shortDateTime(update.addedAt)}
          </span>
        </div>

        {/* kis record par + open */}
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {recordLabel}
          </span>
          <span className="min-w-0 truncate text-xs font-medium text-slate-700" title={update.fullName}>
            {update.fullName || "Applicant"}
          </span>
          {update.applicationNo && (
            <span className="hidden shrink-0 font-mono text-[10px] text-slate-400 sm:inline">
              {update.applicationNo}
            </span>
          )}
          {detailPath && (
            <Link to={detailPath} className="ml-auto shrink-0 text-[10px] font-semibold whitespace-nowrap text-sky-700 hover:underline">
              Open
            </Link>
          )}
        </div>

        <p
          className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700"
          title={update.text}
        >
          {update.text || "—"}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 ${kindChip.className}`}
          >
            {isDecision ? (
              <CheckCircle2 size={11} />
            ) : isRecommendation ? (
              <Clock size={11} />
            ) : (
              <MessageSquare size={11} />
            )}
            {kindChip.text}
          </span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${statusTone}`}>
            {update.loanStatus}
          </span>
          {update.tag && update.tag !== "general" && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
              {updateTagLabel(update.tag)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
};

/*
Super admin / sub admin ka feedback — loan dashboard aur module dashboard dono
par same card. Pehle ye sirf loan branch ke andar tha, isliye customers /
franchises wale admins ko review ka note dikhta hi nahi tha.
*/
const SupervisorFeedbackPanel = ({ records }: { records: ReviewRecord[] }) => {
  if (records.length === 0) return null;

  return (
    <Panel
      className="mb-4"
      title="Supervisor feedback"
      subtitle="What the super admin or sub admin decided on your updates"
    >
      <ul className="divide-y divide-slate-100">
        {records.slice(0, 5).map((record) => {
          const meta = REVIEW_STATE_META[record.state];
          const path = feedbackTargetPath(record);
          return (
            <li key={record.key} className="flex items-start gap-3 px-5 py-3">
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                aria-hidden
              >
                <MessageSquare size={14} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${meta.chip}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    {adminLabel(record.reviewedByName)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatDateTime(record.reviewedAt)}
                  </span>
                </div>

                {/* Normal admin ko sirf action tag — reviewer ka note nahi. */}

                <div className="mt-1 flex items-center gap-2">
                  {record.applicationId && (
                    <span className="font-mono text-[10px] text-slate-400">
                      {record.applicationId}
                    </span>
                  )}
                  {path && (
                    <Link
                      to={path}
                      className="ml-auto text-[11px] font-semibold text-sky-700 hover:underline"
                    >
                      Open record
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {records.length > 5 && (
        <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400">
          Showing 5 of {records.length} reviews.
        </p>
      )}
    </Panel>
  );
};

const AdminDashboard = () => {
  const { admin, loanAccess, canAccessLoan, accessibleLoanTypes, isSuperAdmin, canAccessModule, moduleAccess } =
    useAuth();

 
  const canSeeCustomers = isSuperAdmin || canAccessModule("customers");
  const canSeeFranchises = isSuperAdmin || canAccessModule("franchises");
  /*
  Franchise-only admin (Franchises tick, Customers nahi): dashboard bhi sirf
  franchise customers ke loans ka hona chahiye — normal customer ke nahi.
  */
  const franchiseOnlyAdmin = isFranchiseOnlyScope(moduleAccess);

  const [rawStats, setRawStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [tab, setTab] = useState<TabId>("products");
  /* Super admin / sub admin ne mere updates par kya review kiya. */
  const [feedback, setFeedback] = useState<ReviewRecord[]>([]);
  /* Franchise-only dashboard: loan rows seedhe product endpoints se, taaki scope exact ho. */
  const [franchiseLoans, setFranchiseLoans] = useState<{
    key: string;
    products: { slug: string; rows: PersonalLoan[] }[] | null;
    error: string;
  } | null>(null);
  const loanSlugKey = accessibleLoanTypes.map((loan) => loan.slug).join(",");
  const franchiseLoansKey = `${loanSlugKey}:${reloadToken}`;
  const currentFranchiseLoans =
    franchiseLoans?.key === franchiseLoansKey ? franchiseLoans : null;
  /*
  Load hone tak normal (org-wide) dashboard flash na ho; aur koi product fail
  (403/500) ho to zeros ke bajaye backend stats par fallback rahe.
  */
  const franchiseLoansPending =
    franchiseOnlyAdmin && Boolean(loanSlugKey) && !currentFranchiseLoans;
  const franchiseLoansError = currentFranchiseLoans?.error ?? "";

  // No synchronous setState in the effect body — the previous version needed an
  // eslint-disable comment to get away with exactly that. State only settles
  // once the request resolves.
  useEffect(() => {
    let cancelled = false;
    /*
    Assigned admin ko franchise-customer loans bhi chahiye — wo stats alag
    endpoint se aate hain. Franchises module + koi assigned loan product ho tabhi
    fetch karte hain; super admin ke accounts wale call me pehle hi aa jaate hain.
    */
    getDashboardStats({
      includeAccounts: isSuperAdmin,
      includeFranchiseLoans: !isSuperAdmin && canSeeFranchises && accessibleLoanTypes.length > 0,
    })
      .then((data) => {
        if (!cancelled) setRawStats(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err, "Unable to load dashboard data."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, isSuperAdmin, canSeeFranchises, accessibleLoanTypes.length]);

  useEffect(() => {
    if (!franchiseOnlyAdmin || !loanSlugKey) return;
    let cancelled = false;
    const slugs = loanSlugKey.split(",");
    const key = `${loanSlugKey}:${reloadToken}`;
    Promise.allSettled(slugs.map((slug) => getLoansBySlug(slug))).then((results) => {
      if (cancelled) return;
      const failed = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      if (failed) {
        /* Ek product fail ho to scope adhoora hai — zeros dikhana galat hoga. */
        setFranchiseLoans({
          key,
          products: null,
          error: getApiErrorMessage(failed.reason, "Unable to load franchise loan statistics."),
        });
        return;
      }
      setFranchiseLoans({
        key,
        products: slugs.map((slug, index) => {
          const result = results[index];
          return { slug, rows: result.status === "fulfilled" ? result.value : [] };
        }),
        error: "",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [franchiseOnlyAdmin, loanSlugKey, reloadToken]);

  useEffect(() => {
    if (isSuperAdmin) return;
    let cancelled = false;
    fetchReceivedReviews().then((records) => {
      if (!cancelled) setFeedback(records);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, isSuperAdmin]);

  const refresh = () => {
    setError("");
    setLoading(true);
    setReloadToken((token) => token + 1);
  };

  /*
  A restricted admin only sees the products a super admin assigned. Totals are
  recomputed from those rows so the headline numbers, the donut and the product
  list all describe the same slice instead of leaking org-wide counts.
  */
  const backendMode = rawStats?.dashboardMode;
  const modeAllowed =
    backendMode === "customers"
      ? canSeeCustomers
      : backendMode === "franchises"
        ? canSeeFranchises
        : backendMode === "accounts"
          ? canSeeCustomers && canSeeFranchises
          : false;
  const dashboardMode = modeAllowed ? backendMode : undefined;
  /*
  Backend ne module overview bheja hai lekin wo admin ke access me nahi — ye
  loan dashboard nahi dikhana, warna module-only admin ko loan KPIs dikh jaate
  hain. Aise case me saaf "access nahi" state render hoti hai.
  */
  const modeBlocked = Boolean(backendMode) && !modeAllowed;

  /*
  Franchise-only admin ke dashboard numbers franchise loans se bante hain —
  normal customer ki applications kisi bhi KPI, chart ya table me nahi aati.
  Jab API franchise source mark hi nahi karti, tab rows sabhi assigned products
  ki hoti hain (list page jaisa hi fail-safe).
  */
  const franchiseScope = useMemo(() => {
    const groups = currentFranchiseLoans?.products;
    if (!franchiseOnlyAdmin || !groups) return null;
    /* Ek hi product marker bhejta hai to poore scope me filter valid hai. */
    const marked = groups.some(({ rows }) => rows.some(isFranchiseCustomerLoan));
    const scopedGroups = groups.map(({ slug, rows }) => ({
      slug,
      rows: marked ? rows.filter(isFranchiseCustomerLoan) : rows,
    }));

    const products: ProductStat[] = scopedGroups.map(({ slug, rows: scoped }) => {
      const statusCount = (status: string) =>
        scoped.filter((loan) => (loan.status ?? "").toLowerCase() === status).length;
      const approvedRows = scoped.filter((loan) => (loan.status ?? "").toLowerCase() === "approved");
      return {
        slug,
        label: getLoanTypeLabel(slug),
        total: scoped.length,
        submitted: statusCount("submitted"),
        pending: statusCount("pending"),
        approved: approvedRows.length,
        rejected: statusCount("rejected"),
        requestedAmount: scoped.reduce((total, loan) => total + (loan.loanAmount ?? 0), 0),
        approvedAmount: approvedRows.reduce((total, loan) => total + (loan.loanAmount ?? 0), 0),
      };
    });

    const visible = scopedGroups.flatMap(({ slug, rows }) => rows.map((loan) => ({ slug, loan })));
    const approved = products.reduce((total, product) => total + product.approved, 0);
    const rejected = products.reduce((total, product) => total + product.rejected, 0);
    const decided = approved + rejected;
    const recent: RecentApplication[] = [...visible]
      .sort((a, b) => new Date(b.loan.createdAt).getTime() - new Date(a.loan.createdAt).getTime())
      .slice(0, 10)
      .map(({ slug, loan }) => ({
        _id: loan._id,
        slug,
        label: getLoanTypeLabel(slug),
        fullName: loan.fullName ?? "",
        mobile: loan.mobile ?? "",
        loanType: loan.loanType ?? "",
        status: loan.status ?? "Submitted",
        loanAmount: loan.loanAmount,
        createdAt: loan.createdAt,
      }));

    return {
      products,
      recent,
      loanIds: new Set(visible.map(({ loan }) => loan._id)),
      totalApplications: products.reduce((total, product) => total + product.total, 0),
      submitted: products.reduce((total, product) => total + product.submitted, 0),
      pending: products.reduce((total, product) => total + product.pending, 0),
      approved,
      rejected,
      requestedAmount: products.reduce((total, product) => total + product.requestedAmount, 0),
      approvedAmount: products.reduce((total, product) => total + product.approvedAmount, 0),
      approvalRate: decided > 0 ? (approved / decided) * 100 : 0,
    };
  }, [franchiseOnlyAdmin, currentFranchiseLoans]);

  const baseStats: DashboardStats | null = rawStats
    ? loanAccess === "all"
      ? rawStats
      : (() => {
          const products = rawStats.products.filter((product) => canAccessLoan(productSlug(product)));
          const recent = rawStats.recent.filter((application) => canAccessLoan(productSlug(application)));
          const sum = (pick: (row: DashboardStats["products"][number]) => number) =>
            products.reduce((total, product) => total + pick(product), 0);
          const totalApplications = sum((product) => product.total);
          const approved = sum((product) => product.approved);
          const rejected = sum((product) => product.rejected);
          /*
          Approval rate ka matlab decided applications me se approved — backend
          bhi yahi formula use karta hai (approved / (approved + rejected)).
          Pehle yahan approved / total tha, isliye restricted admin ka rate super
          admin se different dikhta tha.
          */
          const decided = approved + rejected;
          return {
            ...rawStats,
            products,
            recent,
            totalApplications,
            submitted: sum((product) => product.submitted),
            pending: sum((product) => product.pending),
            approved,
            rejected,
            requestedAmount: sum((product) => product.requestedAmount),
            approvedAmount: sum((product) => product.approvedAmount),
            approvalRate: decided > 0 ? (approved / decided) * 100 : 0,
          };
        })()
    : null;

  /*
  Franchise-only admin: base (org-wide) numbers ki jagah franchise loans ka
  scope. Load hone tak stats null (normal data flash nahi hota); koi product
  fail ho to backend stats par fallback. Admin updates bhi sirf inhi
  applications ke rakhe jaate hain.
  */
  const stats: DashboardStats | null = !franchiseOnlyAdmin
    ? baseStats
    : franchiseLoansPending
      ? null
      : franchiseScope && baseStats
        ? {
          ...baseStats,
          products: franchiseScope.products,
          recent: franchiseScope.recent,
          totalApplications: franchiseScope.totalApplications,
          submitted: franchiseScope.submitted,
          pending: franchiseScope.pending,
          approved: franchiseScope.approved,
          rejected: franchiseScope.rejected,
          requestedAmount: franchiseScope.requestedAmount,
          approvedAmount: franchiseScope.approvedAmount,
          approvalRate: franchiseScope.approvalRate,
            recentUpdates: baseStats.recentUpdates.filter((update) =>
              franchiseScope.loanIds.has(update.applicationId)
            ),
          }
        : baseStats;

  /*
  "Recent Accounts" lists customer and franchise logins — super-admin context.
  A restricted admin's dashboard is loan products and applications only.
  */
  const tabs = isSuperAdmin ? TABS : TABS.filter((entry) => entry.id !== "accounts");

  const tabCount = (id: TabId) => {
    if (!stats) return 0;
    if (id === "products") return stats.products.length;
    if (id === "applications") return stats.recent.length;
    if (id === "updates") return stats.recentUpdates.length;
    return stats.recentAccounts.length;
  };

  const buckets: { key: Bucket; count: number }[] = stats
    ? [
        { key: "Approved", count: stats.approved },
        { key: "Pending", count: stats.pending },
        { key: "Submitted", count: stats.submitted },
        { key: "Rejected", count: stats.rejected },
      ]
    : [];

  /*
  Franchise customers ke loans — assigned admin ke liye, aur sirf uske assigned
  products tak. Franchise-only admin ka poora dashboard hi in loans ka hai,
  isliye panel ke numbers bhi scope se aate hain — do jagah alag counts nahi.
  */
  const franchiseLoanRows = franchiseScope
    ? franchiseScope.products
        .filter((product) => product.total > 0)
        .map((product) => ({ slug: product.slug, label: product.label, count: product.total }))
    : (stats?.franchiseCustomerLoans?.products ?? []).filter((product) =>
        canAccessLoan(product.slug)
      );
  const franchiseLoanTotal = franchiseScope
    ? franchiseScope.totalApplications
    : franchiseLoanRows.length
      ? franchiseLoanRows.reduce((total, product) => total + product.count, 0)
      : loanAccess === "all"
        ? stats?.franchiseCustomerLoans?.total ?? 0
        : 0;
  const showFranchiseLoans =
    !isSuperAdmin &&
    canSeeFranchises &&
    accessibleLoanTypes.length > 0 &&
    !!stats &&
    !modeBlocked &&
    /* Scope fail/load ho raha ho to mixed (fallback) stats ke saath panel na dikhe. */
    (!franchiseOnlyAdmin || Boolean(franchiseScope));

  const franchiseLoansPanel = showFranchiseLoans ? (
    <Panel
      className="mb-5"
      title="Franchise customer loans"
      subtitle="Applications filed by franchise customers for the products assigned to you"
      action={
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">
          {franchiseLoanTotal.toLocaleString("en-IN")}
        </span>
      }
    >
      {franchiseLoanRows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">
          No franchise-customer loans in your assigned products yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {franchiseLoanRows.map((product) => (
            <li
              key={product.slug ?? product.label}
              className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
            >
              <span className="truncate text-slate-600">{product.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                {product.count.toLocaleString("en-IN")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  ) : null;

  // The dashboard aggregates four endpoints separately, so a partial failure is
  // reported without hiding the numbers that did load.
  const warnings = stats
    ? [
        franchiseLoansError || undefined,
        stats.franchiseCustomersError && canSeeFranchises ? stats.franchiseCustomersError : undefined,
        stats.accountsError && canSeeCustomers && canSeeFranchises ? stats.accountsError : undefined,
      ].filter((message): message is string => Boolean(message))
    : [];

  const theme = isSuperAdmin ? ROLE_THEME.super : ROLE_THEME.admin;

  /* Hero ki ek line — nested ternary JSX me padhna mushkil tha. */
  const welcomeLine =
    dashboardMode === "customers"
      ? "Here is your customer account overview."
      : dashboardMode === "franchises"
        ? "Here is your franchise registration overview."
        : dashboardMode === "accounts"
          ? "Here is your customer and franchise account overview."
          : modeBlocked
            ? "This overview is not included in your module access."
            : loanAccess === "all"
              ? "Live overview across every loan product."
              : `Showing the ${stats?.products.length ?? 0} loan product(s) assigned to you.`;

  return (
    <AdminLayout>
      {/* ── Hero — role ke hisaab se rang ────────────────────────────────── */}
      <div
        className="relative mb-5 overflow-hidden rounded-2xl px-5 py-5 text-white shadow-md ring-1 ring-inset ring-white/10 sm:px-6 sm:py-6"
        style={{ background: theme.gradient }}
      >
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ring-inset ring-white/25">
              <theme.icon size={11} /> {theme.label}
            </span>
            <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-[28px]">Dashboard</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              Welcome back, {admin?.name}. {welcomeLine}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/80">
              <span className="rounded-full bg-white/10 px-2 py-0.5 ring-1 ring-inset ring-white/20">
                {isSuperAdmin
                  ? "Full organisation access"
                  : `${stats?.products.length ?? 0} assigned product(s)`}
              </span>
              {stats && <span>Updated {formatDateTime(stats.generatedAt)}</span>}
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold ring-1 ring-inset ring-white/30 backdrop-blur transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        <span
          aria-hidden
          className="relative mt-5 block h-[3px] w-full max-w-[11rem] rounded-full"
          style={{ background: theme.hairline, opacity: 0.75 }}
        />
      </div>

      {error && !stats ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <p className="text-sm font-medium text-red-600">{error}</p>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : (loading || franchiseLoansPending) && !stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="grid gap-4 xl:grid-cols-5">
            <div className="h-80 animate-pulse rounded-2xl bg-slate-100 xl:col-span-3" />
            <div className="h-80 animate-pulse rounded-2xl bg-slate-100 xl:col-span-2" />
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : stats ? (
        <>
          <DataWarning messages={error ? [error, ...warnings] : warnings} />
          {!isSuperAdmin && <SupervisorFeedbackPanel records={feedback} />}
          {dashboardMode ? (
            <>
              <ModuleDashboardOverview stats={{ ...stats, dashboardMode }} />
              {franchiseLoansPanel}
            </>
          ) : modeBlocked ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-6 py-14 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertTriangle size={22} />
              </span>
              <p className="text-sm font-semibold text-amber-900">
                Aapke paas is overview ka access nahi hai
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-amber-700">
                Dashboard response ek module overview{" "}
                <span className="font-semibold">
                  {" "}
                  {backendMode === "franchises"
                    ? "franchises"
                    : backendMode === "customers"
                      ? "customers"
                      : "accounts"}
                </span>{" "}
                ka hai, jo aapke module access me shamil nahi. Super admin se ye access
                mangwayein, phir dashboard refresh karein.
              </p>
            </div>
          ) : (
            <>

          {/* ── Headline numbers ─────────────────────────────────────────── */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total Applications"
              value={stats.totalApplications.toLocaleString("en-IN")}
              sub={`Across ${stats.products.length} loan product${stats.products.length === 1 ? "" : "s"}`}
              icon={FileText}
              color="rgb(0, 102, 153)"
              tint="rgba(0, 102, 153, 0.08)"
            />
            <KpiCard
              label="Pending Review"
              value={stats.pending.toLocaleString("en-IN")}
              sub={`${percentOf(stats.pending, stats.totalApplications).toFixed(1)}% awaiting a decision`}
              icon={Clock}
              color="#b45309"
              tint="#fffbeb"
            />
            <KpiCard
              label="Approved"
              value={stats.approved.toLocaleString("en-IN")}
              sub={`${stats.approvalRate.toFixed(1)}% approval rate`}
              icon={CheckCircle2}
              color="#047857"
              tint="#ecfdf5"
            />
            <KpiCard
              label="Rejected"
              value={stats.rejected.toLocaleString("en-IN")}
              sub={`${percentOf(stats.rejected, stats.totalApplications).toFixed(1)}% of all applications`}
              icon={XCircle}
              color="#be123c"
              tint="#fff1f2"
            />
          </div>

          {/* ── Context numbers ──────────────────────────────────────────── */}
          <div className="mb-4">
            <ContextStrip
              items={[
                // Customers / franchises are super-admin context only.
                ...(isSuperAdmin
                  ? [
                      {
                        label: "Customers",
                        value: stats.totalCustomers.toLocaleString("en-IN"),
                        title: "Accounts with the Customer role",
                      },
                      {
                        label: "Franchises",
                        value: stats.totalFranchises.toLocaleString("en-IN"),
                        title: "Franchise login accounts",
                      },
                      {
                        label: "Franchise Customers",
                        value: stats.franchiseCustomerTotal.toLocaleString("en-IN"),
                        title: "Customers referred by franchises",
                      },
                    ]
                  : []),
                /* Franchise-only admin ka Total Applications hi franchise loans hai. */
                ...(showFranchiseLoans && !franchiseOnlyAdmin
                  ? [
                      {
                        label: "Franchise customer loans",
                        value: franchiseLoanTotal.toLocaleString("en-IN"),
                        title: "Loans filed by franchise customers for your assigned products",
                      },
                    ]
                  : []),
                {
                  label: "Requested Value",
                  value: formatCompactCurrency(stats.requestedAmount),
                  title: formatCurrency(stats.requestedAmount),
                },
                {
                  label: "Sanctioned Value",
                  value: formatCompactCurrency(stats.approvedAmount),
                  title: formatCurrency(stats.approvedAmount),
                },
              ]}
            />
          </div>

          {/* ── Charts ───────────────────────────────────────────────────── */}
          <div className="mb-5 grid items-stretch gap-4 xl:grid-cols-5">
            <Panel
              className="xl:col-span-3"
              title="Applications by Product"
              subtitle={
                isSuperAdmin
                  ? "Volume and decision split for every loan product"
                  : "Volume and decision split for the products assigned to you"
              }
            >
              <ProductBars products={stats.products} />
            </Panel>
            <Panel
              className="xl:col-span-2"
              title="Application Status"
              subtitle="Totals of applications"
            >
              <StatusDonut slices={buckets} total={stats.totalApplications} />
            </Panel>
          </div>

          {franchiseLoansPanel}

          {/* ── Two-column layout: Decision Pending + Admin Updates ─────────── */}
          {isSuperAdmin && (
            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              {/* Left: Decision Pending Table */}
              <Panel
                title="Decision pending"
                subtitle="Applications awaiting your final decision"
                action={
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 tabular-nums">
                    {stats.pendingDecisions?.total ?? 0}
                  </span>
                }
              >
                {(stats.pendingDecisions?.items ?? []).length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                      <CheckCircle2 size={20} />
                    </span>
                    <p className="text-sm font-semibold text-slate-700">No decisions pending</p>
                    <p className="max-w-sm text-xs leading-relaxed text-slate-400">
                      Admin suggestions will appear here
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                      <table className="w-full">
                        <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Applicant</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Last act. date</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(stats.pendingDecisions?.items ?? []).map((item) => {
                            const reviewPath =
                              item.entity === "loan"
                                ? applicationDetailPath(item.slug, item.id) ?? "/applications"
                                : item.entity === "customer"
                                ? `/customers?customer=${encodeURIComponent(item.id)}`
                                : `/franchises/${item.id}`;
                            
                            const statusColor = item.suggestedStatus?.toLowerCase() === "approved"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : item.suggestedStatus?.toLowerCase() === "rejected"
                              ? "bg-red-50 text-red-700 ring-red-200"
                              : "bg-blue-50 text-blue-700 ring-blue-200";

                            return (
                              <tr key={`${item.entity}-${item.id}`} className="hover:bg-slate-50/70">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                      style={{ background: avatarGradient(item.name || item.referenceNo || item.id) }}
                                    >
                                      {initialsOf(item.name || "Record")}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-slate-800">
                                        {item.name || "Unnamed"}
                                      </p>
                                      {item.referenceNo && (
                                        <p className="truncate font-mono text-[10px] text-slate-400">
                                          {item.referenceNo}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-block rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                    {item.entity === "loan"
                                      ? item.productLabel ?? "Loan"
                                      : item.entity === "customer"
                                      ? "Customer"
                                      : "Franchise"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${statusColor}`}>
                                    {item.suggestedStatus || item.status || "Pending"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs text-slate-600">
                                    {item.requestedAt ? shortDateTime(item.requestedAt) : "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Link
                                    to={reviewPath}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[rgb(6,106,156)] hover:bg-slate-50 hover:text-[rgb(6,106,156)]"
                                  >
                                    Review
                                    <ArrowRight size={12} />
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {(stats.pendingDecisions?.total ?? 0) > 5 && (
                      <div className="border-t border-slate-100 px-4 py-2.5 text-center">
                        <p className="text-[11px] text-slate-400">
                          {stats.pendingDecisions?.total} total decisions pending • Scroll to view all
                        </p>
                      </div>
                    )}
                  </>
                )}
              </Panel>

              {/* Right: Admin Updates Feed */}
              <Panel
                title="Admin updates"
                subtitle="Latest activity from your team"
                action={
                  <Link
                    to="/activity"
                    className="shrink-0 text-xs font-semibold text-sky-700 hover:underline"
                  >
                    View all
                  </Link>
                }
              >
                {stats.recentUpdates.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <MessageSquare size={18} />
                    </span>
                    <p className="text-sm font-semibold text-slate-700">No admin updates yet</p>
                    <p className="max-w-sm text-xs leading-relaxed text-slate-400">
                      Team activity will appear here
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                      <ul className="divide-y divide-slate-100">
                        {stats.recentUpdates.map((update) => {
                          const detailPath = updateTargetPath(update);
                          const who = adminLabel(update.addedByName);
                          const isDecision = update.kind === "status";
                          const isRecommendation = update.kind === "recommendation";
                          
                          const kindChip = isDecision
                            ? { text: "Decision", className: "bg-emerald-50 text-emerald-700" }
                            : isRecommendation
                            ? { text: "Recommendation", className: "bg-amber-50 text-amber-700" }
                            : { text: "Note", className: "bg-blue-50 text-blue-700" };

                          return (
                            <li key={update._id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/70">
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                                style={{ background: avatarGradient(who) }}
                              >
                                {initialsOf(who)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">
                                      {who}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-600">
                                      {update.fullName || "Applicant"}
                                      {update.applicationNo && (
                                        <span className="ml-1 font-mono text-[10px] text-slate-400">
                                          {update.applicationNo}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <span className="shrink-0 text-[10px] text-slate-400">
                                    {shortDateTime(update.addedAt)}
                                  </span>
                                </div>
                                
                                <p className="mt-1.5 line-clamp-2 text-sm text-slate-700">
                                  {update.text || "—"}
                                </p>
                                
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindChip.className}`}>
                                    {kindChip.text}
                                  </span>
                                  {update.suggestedStatus && (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                      {update.suggestedStatus}
                                    </span>
                                  )}
                                  {detailPath && (
                                    <Link
                                      to={detailPath}
                                      className="ml-auto text-[10px] font-semibold text-sky-700 hover:underline"
                                    >
                                      View →
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    {stats.recentUpdates.length > 5 && (
                      <div className="border-t border-slate-100 px-4 py-2.5 text-center">
                        <p className="text-[11px] text-slate-400">
                          {stats.recentUpdates.length} total updates • Scroll to view all
                        </p>
                      </div>
                    )}
                  </>
                )}
              </Panel>
            </div>
          )}

          {/* ── Regular admin ka admin updates panel ─────────────────────── */}
          {!isSuperAdmin && stats.recentUpdates.length > 0 && (
            <Panel
              className="mb-4"
              title="Admin updates"
              subtitle="Latest notes and recommendations on the products assigned to you"
            >
              <ul className="divide-y divide-slate-100">
                {stats.recentUpdates.slice(0, 4).map((update) => (
                  <AdminUpdateRow key={update._id} update={update} />
                ))}
              </ul>
              {stats.recentUpdates.length > 4 && (
                <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400">
                  Showing the 5 most recent of {stats.recentUpdates.length} updates.
                </p>
              )}
            </Panel>
          )}

          {/* ── Detail tables ────────────────────────────────────────────── */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div
              role="tablist"
              aria-label="Dashboard detail tables"
              className="scrollbar-hidden flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/60 px-3 pt-3"
            >
              {tabs.map(({ id, label }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`dashboard-tab-${id}`}
                    aria-selected={active}
                    aria-controls={`dashboard-panel-${id}`}
                    onClick={() => setTab(id)}
                    className={`relative shrink-0 rounded-t-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
                      active ? "bg-white shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-700"
                    }`}
                    style={active ? { color: theme.accent } : undefined}
                  >
                    {active && (
                      <span
                        className="absolute inset-x-0 top-0 h-[2px] rounded-t"
                        style={{ background: theme.gradient }}
                      />
                    )}
                    {label}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                        active ? "" : "bg-slate-200/70 text-slate-500"
                      }`}
                      style={active ? { background: theme.soft, color: theme.accent } : undefined}
                    >
                      {tabCount(id)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              id={`dashboard-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`dashboard-tab-${tab}`}
            >
              {tab === "products" && <ProductExplorer products={stats.products} />}
              {tab === "applications" && <RecentApplicationsTable applications={stats.recent} />}
              {tab === "updates" && <AdminUpdatesTable updates={stats.recentUpdates} />}
              {tab === "accounts" && <RecentAccountsTable accounts={stats.recentAccounts} />}
            </div>
          </section>
            </>
          )}
        </>
      ) : null}
    </AdminLayout>
  );
};

/**
 * Role ke hisaab se do dashboard:
 *   sub admin -> supervision console (review queue, escalations, admins)
 *   baaki sab -> yahi purana loan/application dashboard
 */
const Dashboard = () => {
  const { isSubAdmin } = useAuth();
  return isSubAdmin ? <SupervisorDashboard /> : <AdminDashboard />;
};

export default Dashboard;
