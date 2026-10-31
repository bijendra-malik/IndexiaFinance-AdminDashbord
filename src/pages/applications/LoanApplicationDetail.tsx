import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Briefcase, Building2, Calendar,
  Check, CheckCircle2, Clock, Copy, CreditCard, Hash,
  IndianRupee, Mail, MapPin, MessageSquarePlus, Phone,
  RefreshCw, Send, ShieldAlert, TrendingDown, Trash2, User, XCircle,
  Car, Coins, FileText, GraduationCap, Home, Landmark, LayoutList,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getLoanTypeLabel } from "../../constants/loanTypes";
import {
  addLoanUpdateBySlug,
  deleteLoanBySlug,
  getLoanBySlug,
  getApiErrorMessage,
  MINIMUM_CREDIT_SCORE,
  updateLoanStatusBySlug,
  type LoanStatus,
  type PersonalLoan,
} from "../../api/personalLoans";

// ── Formatters ────────────────────────────────────────────────────────────────
const INR = (v?: number | null) =>
  v != null ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v) : null;

const DT = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;

const V = (v?: string | number | boolean | null): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v).trim() || null;
};

const initials = (n?: string) =>
  n ? n.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") : "?";

// Label formatter — camelCase → Title Case
const toLabel = (key: string) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .trim();

// ── Scroll-spy for the in-page section navigation ────────────────────────────
const useActiveSection = (ids: string[]) => {
  const key = ids.join("|");
  const [active, setActive] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    if (!key) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -60% 0px", threshold: 0 }
    );
    key.split("|").forEach((sectionId) => {
      const el = document.getElementById(sectionId);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [key]);

  return active;
};

const flattenDetail = (label: string, value: unknown): { label: string; value: unknown }[] => {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) {
    if (!value.length) return [];
    if (value.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item))) {
      return [{ label, value: value.filter((item) => item !== null) }];
    }
    return value.flatMap((item, index) => flattenDetail(`${label} ${index + 1}`, item));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => flattenDetail(`${label} / ${toLabel(key)}`, item));
  }
  return [{ label, value }];
};

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
type StatusConfig = {
  bg: string;
  text: string;
  ring: string;
  dot: string;
  icon: IconComponent;
  glow: string;
};

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, StatusConfig> = {
  Submitted: { bg: "#eff6ff", text: "#1d4ed8", ring: "#bfdbfe", dot: "#3b82f6", icon: Send,         glow: "#3b82f6" },
  Pending:   { bg: "#fffbeb", text: "#b45309", ring: "#fde68a", dot: "#f59e0b", icon: Clock,         glow: "#f59e0b" },
  Approved:  { bg: "#f0fdf4", text: "#15803d", ring: "#bbf7d0", dot: "#22c55e", icon: CheckCircle2,  glow: "#22c55e" },
  Rejected:  { bg: "#fff1f2", text: "#be123c", ring: "#fecdd3", dot: "#f43f5e", icon: XCircle,       glow: "#f43f5e" },
};

// ── Loan type icon ────────────────────────────────────────────────────────────
const LOAN_ICON: Record<string, IconComponent> = {
  "personal-loan":         User,
  "business-loan":         Briefcase,
  "home-loan":             Home,
  "loan-against-property": Landmark,
  "project-loan":          Building2,
  "car-loan":              Car,
  "education-loan":        GraduationCap,
  "credit-card":           CreditCard,
  "balance-transfer":      TrendingDown,
  "npa-loan":              FileText,
  "gold-loan":             Coins,
  "fdi-loan":              Landmark,
};

// ── Sub-components ────────────────────────────────────────────────────────────

type DataFieldProps = {
  label: string;
  value?: string | null;
  mono?: boolean;
  highlight?: boolean;
  className?: string;
};

const DataField = ({
  label, value, mono = false, highlight = false, className = "",
}: DataFieldProps) => (
  <div className={`rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 ${className}`}>
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</span>
    {value
      ? <span className={`mt-2 block text-sm leading-snug break-words ${mono ? "font-mono" : "font-semibold"} ${highlight ? "text-[#066a9c]" : "text-slate-800"}`}>{value}</span>
      : <span className="mt-2 block text-sm text-slate-300 font-light">Not provided</span>}
  </div>
);

type TagListProps = {
  label: string;
  items: string[];
};

const TagList = ({ label, items }: TagListProps) => (
  <div className="col-span-full flex flex-col gap-2">
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</span>
    <div className="flex flex-wrap gap-2">
      {items.length > 0
        ? items.map((item, i) => (
            <span key={i} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-200">
              {item}
            </span>
          ))
        : <span className="text-sm text-slate-300 font-light">None</span>}
    </div>
  </div>
);

type InfoSectionProps = {
  id?: string;
  title: string;
  subtitle: string;
  icon: IconComponent;
  accent: string;
  children: React.ReactNode;
};

const InfoSection = ({
  id, title, subtitle, icon: Icon, accent, children,
}: InfoSectionProps) => (
  <div id={id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)] scroll-mt-28">
    <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-4"
      style={{ background: "linear-gradient(90deg,#f8fafc 0%,#f1f5f9 100%)" }}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/60 shadow-sm"
        style={{ background: `${accent}18`, color: accent }}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 py-6 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  </div>
);

type KpiTileProps = {
  label: string;
  value: string;
  icon: IconComponent;
  color: string;
  sub?: string;
};

const KpiTile = ({
  label, value, icon: Icon, color, sub,
}: KpiTileProps) => (
  <div className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10"
      style={{ background: `${color}22`, color }}>
      <Icon size={17} />
    </div>
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-200">{label}</p>
      <p className="mt-1 text-lg font-extrabold leading-tight text-white">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-200">{sub}</p>}
    </div>
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────
const LoanApplicationDetail = () => {
  const { loanType, id } = useParams<{ loanType: string; id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const label    = getLoanTypeLabel(loanType ?? "");
  const { canAccessLoan, isSuperAdmin } = useAuth();
  const allowed  = canAccessLoan(loanType);

  const [loan,  setLoan]  = useState<PersonalLoan | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<LoanStatus | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [updateText, setUpdateText] = useState("");
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [updateSuggestedStatus, setUpdateSuggestedStatus] = useState<LoanStatus | "">("");

  const load = async () => {
    if (!id || !loanType || !allowed) return;
    setError("");
    try { setLoan(await getLoanBySlug(loanType, id)); }
    catch (err) { setError(getApiErrorMessage(err, "Unable to load.")); }
  };
  useEffect(() => { load(); }, [id, loanType]); // eslint-disable-line

  /*
  Score snapshot stored ON THIS APPLICATION at submit time. Not the customer's
  current account score: a re-check for a later loan updates the account and
  must never rewrite this application's score.
  */
  const creditScore = loan?.creditScore ?? null;
  const creditScoreText = creditScore == null ? "Not recorded for this application" : `${creditScore} / 900`;
  const isCreditEligible = creditScore != null &&
    Boolean(loan?.creditEligible ?? creditScore >= MINIMUM_CREDIT_SCORE);
  const creditEligibilityText = creditScore == null
    ? "Not recorded for this application"
    : isCreditEligible
      ? `Eligible (minimum ${MINIMUM_CREDIT_SCORE})`
      : `Not eligible (below ${MINIMUM_CREDIT_SCORE})`;

  /*
  Backend runs a 24-hour eligibility window from the score check
  (`creditEligibilityExpiresAt` on the snapshot). Ineligible scores and very
  old snapshots have no window, so fall back to an explicit text.
  */
  const creditExpiryText = creditScore == null
    ? "Not recorded for this application"
    : loan?.creditEligibilityExpiresAt
      ? DT(loan.creditEligibilityExpiresAt)
      : isCreditEligible
        ? "Not recorded for this application"
        : `Not applicable — below ${MINIMUM_CREDIT_SCORE}`;

  /* Source channel: franchise sale (FRN code) vs direct customer. */
  const channelText = loan?.franchiseCode
    ? `Franchise — ${loan.franchiseCode}`
    : loan?.franchise
      ? "Franchise"
      : "Direct customer";

  /* Decision stamp — approvedAt for approvals, rejectedAt for rejections. */
  const decidedAt = loan?.approvedAt ?? loan?.rejectedAt ?? null;
  const applicationNo = loan
    ? (loan.applicationNo ?? `#${loan._id.slice(-8).toUpperCase()}`)
    : "";

  /* Newest first so the history reads correctly even for older records. */
  const adminUpdates = [...(loan?.adminUpdates ?? [])].sort(
    (a, b) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime()
  );

  const copyId = async () => {
    if (!loan) return;
    try {
      await navigator.clipboard.writeText(loan._id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  // ── Delete application ────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!loan || !loanType) return;
    setIsDeleting(true);
    try {
      await deleteLoanBySlug(loanType, loan._id);
      showToast(`${label} application deleted`, "success");
      navigate(`/applications/${loanType}`, { replace: true });
    } catch (err) {
      showToast(getApiErrorMessage(err, "Unable to delete this application."), "error");
      setIsDeleting(false);
      setPendingDelete(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!loan || !loanType || !pendingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const updatedLoan = await updateLoanStatusBySlug(
        loanType,
        loan._id,
        pendingStatus,
        statusNote.trim()
      );
      setLoan(updatedLoan);
      showToast(`Application marked ${pendingStatus.toLowerCase()}.`, "success");
      setPendingStatus(null);
      setStatusNote("");
    } catch (err) {
      showToast(getApiErrorMessage(err, "Unable to update this application's status."), "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!loan || !loanType || (!updateText.trim() && !updateSuggestedStatus)) return;
    setIsAddingUpdate(true);
    try {
      const updatedLoan = await addLoanUpdateBySlug(
        loanType,
        loan._id,
        updateText.trim(),
        updateSuggestedStatus
      );
      setLoan(updatedLoan);
      setUpdateText("");
      setUpdateSuggestedStatus("");
      showToast("Update added successfully.", "success");
    } catch (err) {
      showToast(getApiErrorMessage(err, "Unable to add update."), "error");
    } finally {
      setIsAddingUpdate(false);
    }
  };

  const nextStatuses: LoanStatus[] =
    loan?.status === "Submitted"
      ? ["Pending", "Approved", "Rejected"]
      : loan?.status === "Pending"
        ? ["Approved", "Rejected"]
        : [];

  const isBiz   = loanType === "business-loan";
  const sCfg    = loan ? (STATUS_MAP[loan.status] ?? STATUS_MAP.Submitted) : null;
  const StatusIcon = sCfg?.icon ?? Send;
  const LoanIcon   = LOAN_ICON[loanType ?? ""] ?? LayoutList;

  const existingBanks = loan ? [...(loan.existingBanks ?? []), ...(loan.otherBankList ?? [])].filter(Boolean) : [];
  const existingLoans = loan ? [...(loan.existingLoanTypes ?? []), ...(loan.otherLoanList ?? [])].filter(Boolean) : [];

  const transactionBankValue = loan?.transactionBankName;
  const transactionBanks: string[] = Array.isArray(transactionBankValue)
    ? transactionBankValue.filter((bank): bank is string => typeof bank === "string" && Boolean(bank.trim()))
    : typeof transactionBankValue === "object" && transactionBankValue !== null
      ? transactionBankValue.banks?.filter((bank) => Boolean(bank?.trim())) ?? loan?.transactionBanks ?? []
      : loan?.transactionBanks ??
        (typeof transactionBankValue === "string" && transactionBankValue !== "Other"
          ? transactionBankValue.split(",").map((bank) => bank.trim()).filter(Boolean)
          : []);
  const transactionBankDisplayName =
    typeof transactionBankValue === "object" && transactionBankValue !== null && !Array.isArray(transactionBankValue)
      ? transactionBankValue.displayName ?? loan?.transactionBankDisplayName ?? transactionBanks.join(", ")
      : typeof transactionBankValue === "string"
        ? transactionBankValue === "Other"
          ? V(loan?.transactionBankOther) ?? loan?.transactionBankDisplayName ?? "Other"
          : loan?.transactionBankDisplayName ?? transactionBankValue
        : loan?.transactionBankDisplayName ?? (transactionBanks.length > 1 ? "Multiple Transaction Banks" : transactionBanks[0] ?? null);

  // ── Section flags + fields already displayed in curated sections ──────────
  const sectionFlags = {
    salaried: loan?.employmentType === "Salaried",
    business: !isBiz && loan?.employmentType === "Self Employed - Business",
    professional: !isBiz && loan?.employmentType === "Self Employed - Professional",
    lease: Boolean(loan?.monthlyLeaseIncome || loan?.leasePropertyMarketValue),
    buyingProperty: Boolean(loan?.buyingPropertyType || loan?.buyingPropertyMarketValue),
    isBiz,
    liabilities: Boolean(
      loan &&
        (loan.existingEMI != null ||
          loan.existingLoanAmount != null ||
          existingBanks.length > 0 ||
          existingLoans.length > 0)
    ),
  };


  const displayedFields = new Set([
    "_id", "user", "__v", "loanType", "loanAmount", "loanTenure", "status", "createdAt", "updatedAt",
    "fullName", "mobile", "email", "dob", "panNumber", "state", "city", "pincode", "residenceStatus",
    // Curated above (credit block, channel, timeline) — keep them out of "Additional".
    "creditScore", "creditEligible", "creditScoreCheckedAt", "creditEligibilityExpiresAt",
    "applicationNo", "franchise", "franchiseCode", "adminNote", "approvedBy", "approvedAt", "rejectedAt",
    ...(sectionFlags.salaried ? [
      "employmentType", "companyName", "companyType", "monthlySalary", "salaryReceivedAs", "salaryBankName",
      ...(loan?.companyType === "Other" ? ["companyTypeOther"] : []),
      ...(loan?.salaryReceivedAs === "Other" ? ["salaryReceivedAsOther"] : []),
      ...(loan?.salaryBankName === "Other" ? ["salaryBankOther"] : []),
    ] : []),
    ...(sectionFlags.business ? [
      "employmentType", "businessName", "businessType", "natureOfBusiness", "industryType", "subIndustry",
      "gstNumber", "companyPanNumber", "businessEstablishedDate", "businessPlaceStatus", "businessState",
      "businessCity", "businessPincode", "transactionBankName", "transactionBanks",
      ...(loan?.businessType === "Other" ? ["businessTypeOther"] : []),
      ...(loan?.natureOfBusiness === "Other" ? ["natureOfBusinessOther"] : []),
      ...(loan?.industryType === "Other" ? ["industryTypeOther"] : []),
      ...(loan?.businessPlaceStatus === "Other" ? ["businessPlaceStatusOther"] : []),
      "lastYearTurnover", "last2YearsTurnover", "lastYearNetIncome", "last2YearsNetIncome",
    ] : []),
    ...(sectionFlags.professional ? [
      "employmentType", "profession", "businessPlaceStatus", "businessPlaceStatusOther",
      "businessState", "businessCity", "businessPincode", "businessPincodeOther",
      "transactionBankName", "transactionBankDisplayName", "transactionBankOther", "transactionBanks",
      "currentYearTurnover", "priorYearTurnover", "currentYearNetIncome", "previousYearNetIncome",
    ] : []),
    ...(sectionFlags.lease ? [
      "monthlyLeaseIncome", "totalLeaseAmount", "leasePropertyDuration", "leasePropertyMarketValue",
      "leasePropertyAge", "leasePropertyState", "leasePropertyCity", "leasePropertyPincode",
    ] : []),
    ...(sectionFlags.buyingProperty ? [
      "buyingPropertyType", "buyingPropertyMarketValue", "buyingPropertyAge", "buyingPropertyState",
      "buyingPropertyCity", "buyingPropertyPincode",
      ...(loan?.buyingPropertyType === "Other" ? ["buyingPropertyTypeOther"] : []),
    ] : []),
    ...(sectionFlags.isBiz ? [
      "businessName", "businessType", "businessVintage", "gstNumber", "udyamNumber", "companyName", "companyType",
      "currentYearTurnover", "priorYearTurnover", "lastYearTurnover", "currentYearNetIncome", "previousYearNetIncome",
      ...(loan?.companyType === "Other" ? ["companyTypeOther"] : []),
    ] : []),
    ...(sectionFlags.liabilities ? [
      "existingEMI", "existingLoanAmount", "existingBanks", "otherBankList", "existingLoanTypes", "otherLoanList",
    ] : []),
  ]);

  const extraFields = loan
    ? Object.entries(loan)
        .filter(([key, value]) => !displayedFields.has(key) && value !== "" && value !== null && value !== undefined)
        .flatMap(([key, value]) => flattenDetail(toLabel(key), value))
    : [];

  const flags = { ...sectionFlags, extra: extraFields.length > 0 };
  const navItems: { id: string; label: string }[] = [
    { id: "applicant", label: "Applicant" },
    ...(flags.salaried ? [{ id: "employment", label: "Employment" }] : []),
    ...(flags.business
      ? [{ id: "business", label: "Business" }, { id: "business-financials", label: "Financials" }]
      : []),
    ...(flags.professional
      ? [{ id: "professional", label: "Professional" }, { id: "professional-financials", label: "Financials" }]
      : []),
    ...(flags.lease ? [{ id: "lease-property", label: "Lease Property" }] : []),
    ...(flags.buyingProperty ? [{ id: "buying-property", label: "Property" }] : []),
    ...(flags.isBiz
      ? [{ id: "biz-info", label: "Business Info" }, { id: "biz-financials", label: "Financial Details" }]
      : []),
    ...(flags.extra ? [{ id: "additional", label: "Additional" }] : []),
    ...(flags.liabilities ? [{ id: "liabilities", label: "Liabilities" }] : []),
    { id: "timeline", label: "Timeline" },
  ];

  const activeSection = useActiveSection(navItems.map((n) => n.id));

  const jumpTo = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Not assigned to this admin ───────────────────────────────────────────
  if (!allowed) return (
    <AdminLayout>
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
          <ShieldAlert size={22} />
        </div>
        <h2 className="mt-3 text-base font-semibold text-slate-800">No access to {label}</h2>
        <p className="mt-1 text-sm text-slate-500">
          This application belongs to a product your super admin has not assigned to you.
        </p>
        <button onClick={() => navigate("/dashboard")}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          style={{ background: "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))" }}>
          Back to dashboard
        </button>
      </div>
    </AdminLayout>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!loan && !error) return (
    <AdminLayout>
      <div className="animate-pulse space-y-5">
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-slate-100" /><div className="h-8 w-52 rounded-xl bg-slate-100" /></div>
        <div className="h-52 rounded-3xl bg-slate-100" />
        <div className="grid grid-cols-4 gap-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-24 rounded-2xl bg-slate-100"/>)}</div>
        <div className="h-48 rounded-2xl bg-slate-100" />
        <div className="h-44 rounded-2xl bg-slate-100" />
      </div>
    </AdminLayout>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <AdminLayout>
      <div className="flex flex-col items-center py-32 gap-5 text-center">
        <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center shadow-sm">
          <XCircle size={32} className="text-red-400" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-700">Unable to load application</p>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">{error}</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl bg-white border border-slate-200 shadow hover:shadow-md transition">
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>

      {/* ── Nav bar ── */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition shrink-0">
          <ArrowLeft size={15} className="text-slate-500" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Loan Application</p>
          <h1 className="text-xl font-extrabold text-slate-900 leading-tight">{label}</h1>
        </div>
        <div className="hidden md:flex items-center gap-1.5">
          {loan!.mobile && (
            <a href={`tel:${loan!.mobile}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-600 hover:text-[#066a9c] transition">
              <Phone size={13} /> Call
            </a>
          )}
          {loan!.email && (
            <a href={`mailto:${loan!.email}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-600 hover:text-[#066a9c] transition">
              <Mail size={13} /> Email
            </a>
          )}
          <button onClick={copyId}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-600 hover:text-[#066a9c] transition">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy ID"}
          </button>
        </div>
        {sCfg && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shadow-sm"
            style={{ background: sCfg.bg, color: sCfg.text, boxShadow: `0 0 0 1.5px ${sCfg.ring}` }}>
            <StatusIcon size={14} />
            {loan!.status}
          </div>
        )}
      </div>

      <div className="space-y-5">

        {loan?.statusRecommendation?.status &&
          (loan.status === "Submitted" || loan.status === "Pending") && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-amber-900">Admin recommendation</h3>
                  <p className="mt-1 text-xs text-amber-800">
                    <span className="font-semibold">
                      {loan.statusRecommendation.recommendedByName || "An admin"}
                    </span>{" "}
                    recommended marking this application{" "}
                    <span className="font-semibold">{loan.statusRecommendation.status}</span>
                    {loan.statusRecommendation.recommendedAt
                      ? ` on ${DT(loan.statusRecommendation.recommendedAt)}`
                      : ""}
                    .
                  </p>
                  {loan.statusRecommendation.note && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-amber-900">
                      {loan.statusRecommendation.note}
                    </p>
                  )}
                </div>
                <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-800">
                  Pending super admin decision
                </span>
              </div>
            </section>
          )}

        {isSuperAdmin ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Application status</h3>
              <p className="mt-1 text-xs text-slate-500">
                {nextStatuses.length
                  ? "Choose a permitted next status. Approved and rejected decisions cannot be changed."
                  : "This application has a final status and can no longer be changed."}
              </p>
            </div>
            {nextStatuses.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setPendingStatus(status)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      status === "Rejected"
                        ? "border border-red-200 text-red-700 hover:bg-red-50"
                        : status === "Approved"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "border border-amber-200 text-amber-800 hover:bg-amber-50"
                    }`}
                  >
                    {status === "Pending" ? "Mark Pending" : status}
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Application status</h3>
              <p className="mt-1 text-xs text-slate-500">
                Only super admins can finalise the status. Add an update with a recommended status below — it appears instantly on the super admin dashboard.
              </p>
            </div>
          </section>
        )}

        {/*
        Admin updates. Super admin reviews the full history only — adding
        follow-ups is the assigned admin's job. The card stays hidden for a
        super admin when no admin has touched the application yet.
        */}
        {(!isSuperAdmin || adminUpdates.length > 0) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {isSuperAdmin ? "Admin updates" : "Application Updates"}
                {adminUpdates.length > 0 && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {adminUpdates.length}
                  </span>
                )}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {isSuperAdmin
                  ? "Full history of notes, status recommendations and final decisions on this application."
                  : "Add follow-ups (call done, documents verified, etc.) and recommend a status — the super admin sees it instantly."}
              </p>
            </div>
          </div>

          {!isSuperAdmin && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              placeholder="Add an update (e.g. Called customer, Verified documents...)"
              maxLength={500}
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-[rgb(6,106,156)] focus:outline-none focus:ring-2 focus:ring-[rgba(6,106,156,0.2)]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleAddUpdate();
                }
              }}
            />
            {!isSuperAdmin && (
              <select
                value={updateSuggestedStatus}
                onChange={(e) => setUpdateSuggestedStatus(e.target.value as LoanStatus | "")}
                aria-label="Recommend a status with this update"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-[rgb(6,106,156)] focus:outline-none focus:ring-2 focus:ring-[rgba(6,106,156,0.2)]"
              >
                <option value="">No status recommendation</option>
                <option value="Pending">Recommend: Under review</option>
                <option value="Approved">Recommend: Approve</option>
                <option value="Rejected">Recommend: Reject</option>
              </select>
            )}
            <button
              type="button"
              onClick={() => void handleAddUpdate()}
              disabled={isAddingUpdate || (!updateText.trim() && !updateSuggestedStatus)}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))" }}
            >
              <MessageSquarePlus size={16} />
              {isAddingUpdate ? "Adding..." : "Add Update"}
            </button>
          </div>
          )}

          <div className="mt-4 space-y-3">
            {adminUpdates.length === 0 ? (
              <p className="text-xs text-slate-400">No updates added yet.</p>
            ) : (
              adminUpdates.map((update, idx) => (
                  <div
                    key={update._id || `${update.addedAt}-${idx}`}
                    className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          {update.addedByName || "Admin"}
                        </span>
                        {update.addedByRole && (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 border border-slate-200">
                            {String(update.addedByRole).replace("_", " ")}
                          </span>
                        )}
                        {update.suggestedStatus && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              update.kind === "status"
                                ? "bg-slate-800 text-white"
                                : update.suggestedStatus === "Approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : update.suggestedStatus === "Rejected"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {update.kind === "status" ? "Status" : "Recommends"}{" "}
                            {update.suggestedStatus}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {update.addedAt ? new Date(update.addedAt).toLocaleString("en-IN") : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap break-words">{update.text}</p>
                  </div>
                ))
            )}
          </div>
        </section>
        )}

        {/* ════════════ HERO ════════════════════════════════════════════════ */}
        <div className="rounded-3xl overflow-hidden shadow-lg"
          style={{ background: "linear-gradient(135deg,#03405e 0%,#055a84 45%,#0c8a7c 100%)" }}>
          <div className="relative px-8 py-8 overflow-hidden">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/[0.04] pointer-events-none" />
            <div className="absolute top-4 right-48 w-32 h-32 rounded-full bg-white/[0.04] pointer-events-none" />
            <div className="absolute -bottom-12 left-1/3 w-48 h-48 rounded-full bg-white/[0.04] pointer-events-none" />

            <div className="relative z-10 flex items-center gap-6">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white border-2 border-white/25 shadow-2xl"
                  style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(16px)" }}>
                  {initials(loan!.fullName)}
                </div>
                {sCfg && (
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full border-[2.5px] border-white flex items-center justify-center shadow-lg"
                    style={{ background: sCfg.glow }}>
                    <StatusIcon size={10} className="text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-white text-2xl font-extrabold leading-tight">{loan!.fullName ?? "—"}</h2>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-3">
                  {loan!.mobile && (
                    <a href={`tel:${loan!.mobile}`} className="flex items-center gap-1.5 text-white/65 text-[13px] hover:text-white transition">
                      <Phone size={11} className="shrink-0" />{loan!.mobile}
                    </a>
                  )}
                  {loan!.email && (
                    <a href={`mailto:${loan!.email}`} className="flex items-center gap-1.5 text-white/65 text-[13px] hover:text-white transition">
                      <Mail size={11} className="shrink-0" />{loan!.email}
                    </a>
                  )}
                  {loan!.panNumber && (
                    <span className="flex items-center gap-1.5 text-white/50 text-[13px] font-mono">
                      <Hash size={11} className="shrink-0" />{loan!.panNumber}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(loan!.city || loan!.state) && (
                    <span className="flex items-center gap-1.5 bg-white/10 text-white/75 text-[11px] font-semibold px-3 py-1 rounded-full border border-white/10">
                      <MapPin size={9} />{[loan!.city, loan!.state, loan!.pincode].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {loan!.residenceStatus && (
                    <span className="bg-white/10 text-white/75 text-[11px] font-semibold px-3 py-1 rounded-full border border-white/10">
                      {loan!.residenceStatus}
                    </span>
                  )}
                  {loan!.dob && (
                    <span className="flex items-center gap-1.5 bg-white/10 text-white/75 text-[11px] font-semibold px-3 py-1 rounded-full border border-white/10">
                      <Calendar size={9} />{DT(loan!.dob)}
                    </span>
                  )}
                </div>
              </div>

              <div className="hidden xl:flex flex-col items-end gap-2 shrink-0 text-right">
                <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3">
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Applied</p>
                  <p className="text-white font-bold text-sm mt-0.5">{DT(loan!.createdAt) ?? "—"}</p>
                </div>
                <p className="text-white/30 text-[11px]">Updated {DT(loan!.updatedAt) ?? "—"}</p>
              </div>
            </div>
          </div>

          {/* KPI row */}
          <div className="px-6 pb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiTile label="Loan Amount" value={INR(loan!.loanAmount) ?? "—"} icon={IndianRupee} color="#22d3ee" sub="Requested" />
            <KpiTile label="Tenure"      value={loan!.loanTenure ? `${loan!.loanTenure} mo` : "—"} icon={Calendar} color="#4ade80" sub="Months" />
            <KpiTile label="Loan Type"   value={V(loan!.loanType) ?? "—"} icon={LoanIcon} color="#c084fc" sub="Category" />
            <KpiTile label="App. ID"     value={`#${loan!._id.slice(-8).toUpperCase()}`} icon={Hash} color="#fbbf24" sub="Reference" />
          </div>
        </div>

        {/* ── Section navigation (sticky) ── */}
        <nav className="sticky top-0 z-20">
          <div className="scrollbar-hidden flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white/95 px-2.5 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md">
            <span className="shrink-0 border-r border-slate-200 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
              Sections
            </span>
            {navItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => jumpTo(item.id)}
                aria-current={activeSection === item.id ? "location" : undefined}
                className={`group inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 ${
                  activeSection === item.id
                    ? "text-white shadow-md shadow-sky-900/15"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                style={activeSection === item.id
                  ? { background: "linear-gradient(135deg,#066a9c,#26ae90)" }
                  : undefined}
              >
                <span className={`font-mono text-[10px] tabular-nums ${
                  activeSection === item.id ? "text-white/70" : "text-slate-400 group-hover:text-slate-500"
                }`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ════════════ APPLICANT INFO ═══════════════════════════════════════ */}
        <InfoSection id="applicant" icon={User} accent="#066a9c" title="Applicant Information" subtitle="Personal identification and contact details">
          <DataField label="Full Name"         value={V(loan!.fullName)} />
          <DataField label="Mobile Number"     value={V(loan!.mobile)} mono />
          <DataField label="Email Address"     value={V(loan!.email)} />
          <DataField label="Date of Birth"     value={DT(loan!.dob)} />
          <DataField label="PAN Number"        value={V(loan!.panNumber)} mono />
          <DataField label="Residence Status"  value={V(loan!.residenceStatus)} />
          <DataField label="State"             value={V(loan!.state)} />
          <DataField label="City"              value={V(loan!.city)} />
          <DataField label="Pincode"           value={V(loan!.pincode)} mono />
          <DataField label="Credit Score (at apply)" value={creditScoreText} highlight />
          <DataField label="Credit Eligibility"      value={creditEligibilityText} />
          <DataField label="Score Checked On"        value={DT(loan!.creditScoreCheckedAt)} />
          <DataField label="Eligibility Valid Until" value={creditExpiryText} />
          <DataField label="Application Source"      value={channelText} />
          <DataField label="Application No"          value={applicationNo} mono />
        </InfoSection>

        {/* ════════════ EMPLOYMENT — adapts to employmentType ══════════════ */}
        {flags.salaried && (
          <InfoSection id="employment" icon={Briefcase} accent="#0d9488" title="Employment & Salary" subtitle="Salaried employment details">
            <DataField label="Employment Type"    value={V(loan!.employmentType)} />
            <DataField label="Company Name"       value={V(loan!.companyName)} />
            <DataField label="Company Type"
              value={loan!.companyType === "Other" ? `Other — ${V(loan!.companyTypeOther) ?? ""}` : V(loan!.companyType)} />
            <DataField label="Monthly Salary"     value={INR(loan!.monthlySalary)} highlight />
            <DataField label="Salary Received As"
              value={loan!.salaryReceivedAs === "Other" ? `Other — ${V(loan!.salaryReceivedAsOther) ?? ""}` : V(loan!.salaryReceivedAs)} />
            <DataField label="Salary Bank"
              value={loan!.salaryBankName === "Other" ? `Other — ${V(loan!.salaryBankOther) ?? ""}` : V(loan!.salaryBankName)} />
          </InfoSection>
        )}

        {flags.business && (
          <>
            <InfoSection id="business" icon={Building2} accent="#0d9488" title="Business Details" subtitle="Self-employed business information">
              <DataField label="Employment Type"          value={V(loan!.employmentType)} />
              <DataField label="Business Name"            value={V(loan!.businessName)} />
              <DataField label="Business Type"
                value={loan!.businessType === "Other" ? `Other — ${V(loan!.businessTypeOther) ?? ""}` : V(loan!.businessType)} />
              <DataField label="Nature of Business"
                value={loan!.natureOfBusiness === "Other" ? `Other — ${V(loan!.natureOfBusinessOther) ?? ""}` : V(loan!.natureOfBusiness)} />
              <DataField label="Industry Type"
                value={loan!.industryType === "Other" ? `Other — ${V(loan!.industryTypeOther) ?? ""}` : V(loan!.industryType)} />
              {V(loan!.subIndustry) && <DataField label="Sub Industry" value={V(loan!.subIndustry)} />}
              <DataField label="GST Number"               value={V(loan!.gstNumber)} mono />
              <DataField label="Company PAN"              value={V(loan!.companyPanNumber)} mono />
              <DataField label="Business Established"     value={DT(loan!.businessEstablishedDate)} />
              <DataField label="Business Place Status"
                value={loan!.businessPlaceStatus === "Other" ? `Other — ${V(loan!.businessPlaceStatusOther) ?? ""}` : V(loan!.businessPlaceStatus)} />
              <DataField label="Business State"           value={V(loan!.businessState)} />
              <DataField label="Business City"            value={V(loan!.businessCity)} />
              <DataField label="Business Pincode"         value={V(loan!.businessPincode)} mono />
              <DataField label="Transaction Bank Selection" value={V(transactionBankDisplayName)} />
              <TagList   label="Transaction Banks"        items={transactionBanks} />
            </InfoSection>
            <InfoSection id="business-financials" icon={TrendingDown} accent="#d97706" title="Business Financials" subtitle="Annual turnover and net income">
              <DataField label="Last Year Turnover"       value={INR(loan!.lastYearTurnover)} highlight />
              <DataField label="Last 2 Years Turnover"    value={INR(loan!.last2YearsTurnover)} />
              <DataField label="Last Year Net Income"     value={INR(loan!.lastYearNetIncome)} highlight />
              <DataField label="Last 2 Years Net Income"  value={INR(loan!.last2YearsNetIncome)} />
            </InfoSection>
          </>
        )}

        {flags.professional && (
          <>
            <InfoSection id="professional" icon={Briefcase} accent="#0d9488" title="Professional Details" subtitle="Self-employed professional information">
              <DataField label="Employment Type"       value={V(loan!.employmentType)} />
              <DataField label="Profession" value={V(loan!.profession)} />
              <DataField label="Business Place Status"
                value={loan!.businessPlaceStatus === "Other"
                  ? `Other — ${V(loan!.businessPlaceStatusOther) ?? "Not specified"}`
                  : V(loan!.businessPlaceStatus)} />
              <DataField label="Business State"        value={V(loan!.businessState)} />
              <DataField label="Business City"         value={V(loan!.businessCity)} />
              <DataField label="Business Pincode"
                value={loan!.businessPincode === "Other"
                  ? `Other — ${V(loan!.businessPincodeOther) ?? "Not specified"}`
                  : V(loan!.businessPincode) ?? V(loan!.businessPincodeOther)} mono />
              <DataField label="Transaction Bank Selection" value={V(transactionBankDisplayName)} />
              <TagList   label="Transaction Banks"     items={transactionBanks} />
              {V(loan!.transactionBankOther) && (
                <DataField label="Other Transaction Bank" value={V(loan!.transactionBankOther)} />
              )}
            </InfoSection>
            <InfoSection id="professional-financials" icon={TrendingDown} accent="#d97706" title="Professional Financials" subtitle="Annual turnover and net income">
              <DataField label="Current Year Turnover"    value={INR(loan!.currentYearTurnover)} highlight />
              <DataField label="Prior Year Turnover"      value={INR(loan!.priorYearTurnover)} />
              <DataField label="Current Year Net Income"  value={INR(loan!.currentYearNetIncome)} highlight />
              <DataField label="Previous Year Net Income" value={INR(loan!.previousYearNetIncome)} />
            </InfoSection>
          </>
        )}

        {/* ════════════ LEASE PROPERTY (Lease Rental Discounting) ══════════ */}
        {flags.lease && (
          <InfoSection id="lease-property" icon={Building2} accent="#0891b2" title="Lease Property Details" subtitle="Property being leased and rental income">
            <DataField label="Monthly Lease Income"   value={INR(loan!.monthlyLeaseIncome)} highlight />
            <DataField label="Total Lease Amount"     value={INR(loan!.totalLeaseAmount)} />
            <DataField label="Lease Duration"         value={loan!.leasePropertyDuration ? `${loan!.leasePropertyDuration} years` : null} />
            <DataField label="Property Market Value"  value={INR(loan!.leasePropertyMarketValue)} highlight />
            <DataField label="Property Age"           value={loan!.leasePropertyAge ? `${loan!.leasePropertyAge} years` : null} />
            <DataField label="Property State"         value={V(loan!.leasePropertyState)} />
            <DataField label="Property City"          value={V(loan!.leasePropertyCity)} />
            <DataField label="Property Pincode"       value={V(loan!.leasePropertyPincode)} mono />
          </InfoSection>
        )}

        {/* ════════════ BUYING PROPERTY (commercial purchase / LAP) ═════════ */}
        {flags.buyingProperty && (
          <InfoSection id="buying-property" icon={Building2} accent="#7c3aed" title="Property Details" subtitle="Property being purchased / mortgaged">
            <DataField label="Property Type"
              value={loan!.buyingPropertyType === "Other" ? `Other — ${V(loan!.buyingPropertyTypeOther) ?? ""}` : V(loan!.buyingPropertyType)} />
            <DataField label="Market Value"   value={INR(loan!.buyingPropertyMarketValue)} highlight />
            <DataField label="Property Age"   value={V(loan!.buyingPropertyAge) ? `${loan!.buyingPropertyAge} years` : null} />
            <DataField label="State"          value={V(loan!.buyingPropertyState)} />
            <DataField label="City"           value={V(loan!.buyingPropertyCity)} />
            <DataField label="Pincode"        value={V(loan!.buyingPropertyPincode)} mono />
          </InfoSection>
        )}

        {/* ════════════ BUSINESS (standalone business-loan type) ════════════ */}
        {flags.isBiz && (
          <>
            <InfoSection id="biz-info" icon={Building2} accent="#0d9488" title="Business Information" subtitle="Company and registration details">
              <DataField label="Business Name"    value={V(loan!.businessName)} />
              <DataField label="Business Type"    value={V(loan!.businessType)} />
              <DataField label="Business Vintage" value={V(loan!.businessVintage)} />
              <DataField label="GST Number"       value={V(loan!.gstNumber)} mono />
              <DataField label="Udyam Number"     value={V(loan!.udyamNumber)} mono />
              <DataField label="Company Name"     value={V(loan!.companyName)} />
              <DataField label="Company Type"
                value={loan!.companyType === "Other" ? `Other — ${V(loan!.companyTypeOther) ?? ""}` : V(loan!.companyType)} />
            </InfoSection>
            <InfoSection id="biz-financials" icon={TrendingDown} accent="#d97706" title="Financial Details" subtitle="Annual turnover and net income">
              <DataField label="Current Year Turnover"    value={INR(loan!.currentYearTurnover)} highlight />
              <DataField label="Prior Year Turnover"      value={INR(loan!.priorYearTurnover)} />
              <DataField label="Last Year Turnover"       value={INR(loan!.lastYearTurnover)} />
              <DataField label="Current Year Net Income"  value={INR(loan!.currentYearNetIncome)} highlight />
              <DataField label="Previous Year Net Income" value={INR(loan!.previousYearNetIncome)} />
            </InfoSection>
          </>
        )}

        {/* ════════════ EXTRA FIELDS (loan-type specific) ════════════════════
            Dynamically renders any field returned by the API that is not
            already shown in the sections above — covers project loan,
            car loan, education loan, LAP, balance transfer, etc.          */}
        {extraFields.length > 0 && (
          <InfoSection id="additional" icon={LayoutList} accent="#7c3aed" title="Additional Details" subtitle={`${label}-specific information`}>
            {extraFields.map(({ label: fieldLabel, value }) => {
              if (Array.isArray(value)) {
                return (
                  <TagList
                    key={fieldLabel}
                    label={fieldLabel}
                    items={value.map(String).filter(Boolean)}
                  />
                );
              }
              const formatted =
                typeof value === "number" && /amount|value|cost|price/i.test(fieldLabel) ? INR(value)
                : V(value as string | number | boolean);
              return (
                <DataField
                  key={fieldLabel}
                  label={fieldLabel}
                  value={formatted}
                  mono={typeof value === "number"}
                />
              );
            })}
          </InfoSection>
        )}

        {/* ════════════ LIABILITIES ═════════════════════════════════════════ */}
        {flags.liabilities && (
          <InfoSection id="liabilities" icon={CreditCard} accent="#dc2626" title="Existing Liabilities" subtitle="Current running loans and monthly EMI obligations">
            <DataField label="Monthly EMI"            value={INR(loan!.existingEMI)} />
            <DataField label="Total Loan Outstanding" value={INR(loan!.existingLoanAmount)} />
            <TagList label="Banks with Existing Loans" items={existingBanks} />
            <TagList label="Existing Loan Types"        items={existingLoans} />
          </InfoSection>
        )}

        {/* ════════════ FOOTER META ═════════════════════════════════════════ */}
        <div id="timeline" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden scroll-mt-28">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Application Timeline</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100">
            {[
              { icon: Hash,       label: "Application No", value: applicationNo,                    mono: true  },
              { icon: Hash,       label: "Application ID", value: loan!._id,                  mono: true  },
              { icon: Calendar,   label: "Applied On",     value: DT(loan!.createdAt) ?? "—", mono: false },
              ...(decidedAt ? [{ icon: StatusIcon, label: "Decision On", value: DT(decidedAt) ?? "—", mono: false }] : []),
              { icon: RefreshCw,  label: "Last Updated",   value: DT(loan!.updatedAt) ?? "—", mono: false },
              { icon: StatusIcon, label: "Current Status", value: loan!.status,               mono: false },
            ].map(({ icon: Icon, label: l, value: v, mono }) => (
              <div key={l} className="px-5 py-4 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={13} className="text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{l}</p>
                  <p className={`text-xs font-semibold text-slate-700 break-all ${mono ? "font-mono" : ""}`}>{v}</p>
                </div>
              </div>
            ))}
          </div>
          {V(loan!.adminNote) && (
            <div className="border-t border-slate-100 px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                {loan!.status === "Rejected" ? "Rejection note" : "Review note"}
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">{loan!.adminNote}</p>
            </div>
          )}
        </div>

        {/* ════════════ DANGER ZONE ═════════════════════════════════════════ */}
        {isSuperAdmin && (
          <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-red-700 mb-1">Danger Zone</h3>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-slate-500">
                Permanently delete this application and all of its saved details. This cannot be undone.
              </p>
              <button
                onClick={() => setPendingDelete(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-xl transition"
              >
                <Trash2 size={15} />
                Delete Application
              </button>
            </div>
          </div>
        )}

      </div>

      {pendingDelete && loan && (
        <ConfirmDialog
          title={`Delete ${label} application?`}
          message={`Applicant: ${loan.fullName ?? "—"} · ID: ${loan._id}. Their saved form details will be removed permanently.`}
          confirmText={loan._id.slice(-8).toUpperCase()}
          confirmLabel="Delete Application"
          isSubmitting={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(false)}
        />
      )}
      {pendingStatus && pendingStatus !== "Rejected" && (
        <ConfirmDialog
          title={`Set application to ${pendingStatus.toLowerCase()}?`}
          message={`This records the application as ${pendingStatus.toLowerCase()}. This decision cannot be changed later.`}
          confirmLabel={`Set ${pendingStatus}`}
          danger={false}
          isSubmitting={isUpdatingStatus}
          onConfirm={() => void handleStatusUpdate()}
          onCancel={() => setPendingStatus(null)}
        />
      )}
      {pendingStatus === "Rejected" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleStatusUpdate();
            }}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-slate-800">Reject application?</h2>
            <p className="mt-1 text-sm text-slate-500">
              This decision is final. Add an optional note for the rejection record.
            </p>
            <textarea
              autoFocus
              value={statusNote}
              onChange={(event) => setStatusNote(event.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Reason for rejection (optional)"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <p className="mt-1 text-right text-xs text-slate-400">{statusNote.length}/500</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => {
                  setPendingStatus(null);
                  setStatusNote("");
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingStatus}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isUpdatingStatus ? "Please wait..." : "Reject application"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
};

export default LoanApplicationDetail;
