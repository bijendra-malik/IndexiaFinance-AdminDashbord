import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check, Coins, Eye, EyeOff, LoaderCircle, Pencil, Plus, RefreshCw, Search, Star, Trash2, X,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import {
  createFranchisePlan,
  deleteFranchisePlan,
  getFranchisePlans,
  setFranchisePlanBestValue,
  setFranchisePlanStatus,
  updateFranchisePlan,
  type FranchisePlan,
  type FranchisePlanPayload,
} from "../../api/franchisePlans";
import { getApiErrorMessage } from "../../utils/apiError";
import FilterSelect from "../../components/common/FilterSelect";
import { BRAND_GRADIENT } from "./franchiseUtils";

type StatusFilter = "all" | "live" | "hidden";
type PlanDraft = {
  code: string;
  name: string;
  durationMonths: string;
  fee: string;
  gstPercent: string;
  renewalFee: string;
  renewalNote: string;
  features: string[];
  sortOrder: string;
  isBestValue: boolean;
  isActive: boolean;
};
type FieldErrors = Record<string, string>;
type PlanAction = { kind: "hide" | "show" | "delete"; plan: FranchisePlan };

const money = (amount?: number | null) =>
  amount == null || !Number.isFinite(amount)
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(amount);

const dateTime = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
};

const actorName = (value: FranchisePlan["updatedBy"]) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return value.name || value.email || "Admin";
  return "—";
};

const emptyDraft = (): PlanDraft => ({
  code: "",
  name: "",
  durationMonths: "",
  fee: "",
  gstPercent: "18",
  renewalFee: "",
  renewalNote: "As applicable",
  features: [""],
  sortOrder: "",
  isBestValue: false,
  isActive: true,
});

const draftFromPlan = (plan: FranchisePlan): PlanDraft => ({
  code: plan.code,
  name: plan.name,
  durationMonths: String(plan.durationMonths),
  fee: String(plan.fee),
  gstPercent: String(plan.gstPercent),
  renewalFee: plan.renewalFee == null ? "" : String(plan.renewalFee),
  renewalNote: plan.renewalNote || "",
  features: plan.features.length ? [...plan.features] : [""],
  sortOrder: String(plan.sortOrder),
  isBestValue: plan.isBestValue,
  isActive: plan.isActive,
});

const inputClass = (hasError: boolean) =>
  `mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-100"
      : "border-slate-200 focus:border-sky-500 focus:ring-sky-100"
  }`;

const franchisePlanErrorDetails = (error: unknown): { message: string; fields: FieldErrors } => {
  const value = error as {
    response?: { status?: number; data?: { message?: string; errors?: unknown } };
  };
  const status = value.response?.status;
  const data = value.response?.data;
  const fields: FieldErrors = {};
  if (Array.isArray(data?.errors)) {
    data.errors.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const detail = entry as { field?: unknown; path?: unknown; message?: unknown };
      const field = typeof detail.field === "string"
        ? detail.field
        : typeof detail.path === "string" ? detail.path : "";
      if (field && typeof detail.message === "string") fields[field] = detail.message;
    });
  }
  if (status === 409 && /code/i.test(data?.message ?? "")) {
    fields.code = "This code is already used.";
  }
  return {
    message: data?.message || getApiErrorMessage(error, "Unable to save franchise plan."),
    fields,
  };
};

const FranchisePlans = () => {
  const { showToast } = useToast();
  const [plans, setPlans] = useState<FranchisePlan[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingPlan, setEditingPlan] = useState<FranchisePlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<PlanDraft>(emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [feeConfirmOpen, setFeeConfirmOpen] = useState(false);
  const [actionPlanId, setActionPlanId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<PlanAction | null>(null);
  // Cards are the default (responsive: columns on wide screens, stacked rows on phones).
  const [view, setView] = useState<"cards" | "table">("cards");

  useEffect(() => {
    let cancelled = false;
    const request = async () => {
      try {
        const result = await getFranchisePlans(
          status === "all" ? undefined : status === "live"
        );
        const liveResult = status === "hidden"
          ? await getFranchisePlans(true)
          : null;
        if (cancelled) return;
        setPlans(result.plans);
        setActiveCount(
          status === "live"
            ? result.count
            : liveResult?.count ?? result.plans.filter((plan) => plan.isActive).length
        );
      } catch (loadError) {
        if (!cancelled) {
          const statusCode = (loadError as { response?: { status?: number } })?.response?.status;
          setError(statusCode === 404
            ? "Franchise Plans API route not found (404). The backend must implement GET /api/admin/franchise-plans."
            : getApiErrorMessage(loadError, "Unable to load franchise plans."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError("");
      void request();
    });
    return () => { cancelled = true; };
  }, [status, refreshKey]);

  const visiblePlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = plans.filter((plan) =>
      !query || plan.code.toLowerCase().includes(query) || plan.name.toLowerCase().includes(query)
    );
    return [...filtered].sort((left, right) => left.sortOrder - right.sortOrder);
  }, [plans, search]);

  const planCodeOptions = useMemo(() => {
    const currentCode = editingPlan?.code.toUpperCase();
    const usedByOtherPlans = new Set(
      plans
        .filter((plan) => plan._id !== editingPlan?._id)
        .map((plan) => plan.code.toUpperCase())
    );
    return [...new Set(["6M", "1Y", "2Y", "3Y", "5Y", "10Y", ...plans.map((plan) => plan.code.toUpperCase())])]
      .map((code) => ({ code, isUsed: usedByOtherPlans.has(code) && code !== currentCode }));
  }, [editingPlan, plans]);

  const openCreate = () => {
    setEditingPlan(null);
    setDraft(emptyDraft());
    setFieldErrors({});
    setFormError("");
    setIsCreating(true);
  };

  const openEdit = (plan: FranchisePlan) => {
    setEditingPlan(plan);
    setDraft(draftFromPlan(plan));
    setFieldErrors({});
    setFormError("");
    setIsCreating(true);
  };

  const closeForm = () => {
    if (saving) return;
    setIsCreating(false);
    setEditingPlan(null);
    setFieldErrors({});
    setFormError("");
  };

  const validateDraft = (): FieldErrors => {
    const next: FieldErrors = {};
    if (draft.code.trim() && !/^[A-Z0-9_-]{1,20}$/.test(draft.code.trim().toUpperCase())) {
      next.code = "Use 1–20 letters, numbers, hyphens, or underscores.";
    }
    if (!draft.name.trim()) next.name = "Plan name is required.";
    const months = Number(draft.durationMonths);
    if (!Number.isInteger(months) || months < 1) next.durationMonths = "Enter a whole number of at least 1 month.";
    const fee = Number(draft.fee);
    if (!Number.isFinite(fee) || fee < 0) next.fee = "Enter a valid non-negative fee.";
    const gst = Number(draft.gstPercent);
    if (!Number.isFinite(gst) || gst < 0) next.gstPercent = "Enter a valid non-negative GST percentage.";
    if (draft.renewalFee !== "" && (!Number.isFinite(Number(draft.renewalFee)) || Number(draft.renewalFee) < 0)) {
      next.renewalFee = "Enter a valid fee or leave this blank.";
    }
    const sortOrder = draft.sortOrder.trim();
    if (sortOrder && (!Number.isInteger(Number(sortOrder)) || Number(sortOrder) < 0)) {
      next.sortOrder = "Enter a whole number of 0 or higher.";
    }
    const features = draft.features.map((feature) => feature.trim()).filter(Boolean);
    if (features.length > 20) next.features = "Use no more than 20 features.";
    if (draft.features.some((feature) => feature.length > 200)) next.features = "Each feature must be 200 characters or fewer.";
    if (!draft.isActive && activeCount === 0) {
      next.isActive = "At least one franchise plan must stay live.";
    }
    return next;
  };

  const payloadFromDraft = (): FranchisePlanPayload => {
    const code = draft.code.trim().toUpperCase();
    const all: FranchisePlanPayload = {
      ...(code ? { code } : {}),
      name: draft.name.trim(),
      durationMonths: Number(draft.durationMonths),
      fee: Number(draft.fee),
      gstPercent: Number(draft.gstPercent),
      renewalFee: draft.renewalFee.trim() ? Number(draft.renewalFee) : null,
      renewalNote: draft.renewalNote.trim(),
      features: draft.features.map((feature) => feature.trim()).filter(Boolean),
      isBestValue: draft.isBestValue,
      isActive: draft.isActive,
    };
    if (draft.sortOrder.trim()) all.sortOrder = Number(draft.sortOrder);
    if (!editingPlan) return all;

    const original = draftFromPlan(editingPlan);
    const changed: FranchisePlanPayload = {};
    (Object.keys(all) as (keyof FranchisePlanPayload)[]).forEach((key) => {
      const before = key === "features"
        ? original.features.map((feature) => feature.trim()).filter(Boolean)
        : key === "renewalFee"
          ? original.renewalFee.trim() ? Number(original.renewalFee) : null
          : key === "durationMonths" || key === "fee" || key === "gstPercent" || key === "sortOrder"
            ? original[key] ? Number(original[key]) : undefined
            : key === "code"
              ? original.code.trim().toUpperCase()
              : key === "name" || key === "renewalNote"
                ? original[key].trim()
                : original[key];
      const after = all[key];
      const equal = key === "features"
        ? JSON.stringify(before) === JSON.stringify(after)
        : before === after;
      if (!equal) Object.assign(changed, { [key]: after });
    });
    return changed;
  };

  const persistDraft = async () => {
    setSaving(true);
    try {
      const payload = payloadFromDraft();
      if (editingPlan) {
        if (Object.keys(payload).length === 0) {
          showToast("No plan changes to save.");
          closeForm();
          return;
        }
        await updateFranchisePlan(editingPlan._id, payload);
        showToast("Franchise plan updated.");
      } else {
        await createFranchisePlan(payload);
        showToast("Franchise plan created.");
      }
      setIsCreating(false);
      setEditingPlan(null);
      setRefreshKey((key) => key + 1);
    } catch (saveError) {
      const result = franchisePlanErrorDetails(saveError);
      const statusCode = (saveError as { response?: { status?: number } })?.response?.status;
      const message = statusCode === 404
        ? "This plan no longer exists. The list has been refreshed."
        : result.message;
      setFormError(message);
      setFieldErrors(result.fields);
      if (statusCode === 404) setRefreshKey((key) => key + 1);
      if (/at least one franchise plan must stay active/i.test(result.message)) {
        showToast("The franchise page needs at least one live plan.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateDraft();
    setFieldErrors(validation);
    setFormError("");
    if (Object.keys(validation).length) return;
    if (editingPlan && Number(draft.fee) !== editingPlan.fee) {
      setFeeConfirmOpen(true);
      return;
    }
    await persistDraft();
  };

  const performAction = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setActionPlanId(action.plan._id);
    try {
      if (action.kind === "hide") {
        await setFranchisePlanStatus(action.plan._id, false);
        showToast("Franchise plan hidden.");
      } else if (action.kind === "show") {
        await setFranchisePlanStatus(action.plan._id, true);
        showToast("Franchise plan is live.");
      } else {
        await deleteFranchisePlan(action.plan._id);
        showToast("Franchise plan removed from the public page.");
      }
      setConfirmAction(null);
      setRefreshKey((key) => key + 1);
    } catch (actionError) {
      const statusCode = (actionError as { response?: { status?: number } })?.response?.status;
      const serverMessage = getApiErrorMessage(actionError, "Unable to update franchise plan.");
      showToast(
        statusCode === 404
          ? "This plan no longer exists. The list has been refreshed."
          : statusCode === 400 && /at least one franchise plan must stay active/i.test(serverMessage)
            ? "The franchise page needs at least one live plan."
          : statusCode === 409 && /inactive|hidden/i.test(serverMessage)
            ? "That plan is already hidden."
            : serverMessage,
        "error"
      );
      setConfirmAction(null);
      if (statusCode === 404 || statusCode === 409) {
        setRefreshKey((key) => key + 1);
      }
    } finally {
      setActionPlanId(null);
    }
  };

  const toggleBestValue = async (plan: FranchisePlan) => {
    setActionPlanId(plan._id);
    try {
      await setFranchisePlanBestValue(plan._id, !plan.isBestValue);
      showToast(plan.isBestValue ? "Best Value pin removed." : "Best Value plan updated.");
      setRefreshKey((key) => key + 1);
    } catch (actionError) {
      const statusCode = (actionError as { response?: { status?: number } })?.response?.status;
      showToast(
        statusCode === 404
          ? "This plan no longer exists. The list has been refreshed."
          : getApiErrorMessage(actionError, "Unable to update Best Value plan."),
        "error"
      );
      if (statusCode === 404) setRefreshKey((key) => key + 1);
    } finally {
      setActionPlanId(null);
    }
  };

  const confirmCopy = confirmAction?.kind === "hide"
    ? {
        title: `Hide "${confirmAction.plan.name}"?`,
        message: "It will disappear from the franchise page immediately. Existing applications keep their recorded price, and you can show it again anytime.",
        label: "Hide plan",
      }
    : confirmAction?.kind === "show"
      ? {
          title: `Show "${confirmAction.plan.name}"?`,
          message: "This plan will appear on the franchise page for new applicants.",
          label: "Show plan",
        }
      : confirmAction
        ? {
            title: `Delete "${confirmAction.plan.name}"?`,
            message: "The plan will be hidden from the website. It is not erased, because existing franchise applications may reference it.",
            label: "Delete plan",
          }
        : null;

  // Shared between the card grid and the table so actions never drift apart.
  const renderPinButton = (plan: FranchisePlan) => (
    <button
      type="button"
      aria-label={`${plan.isBestValue ? "Unpin" : "Pin"} ${plan.name} as Best Value`}
      aria-pressed={plan.isBestValue}
      disabled={actionPlanId === plan._id}
      onClick={() => void toggleBestValue(plan)}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${plan.isBestValue ? "bg-amber-50 text-amber-700" : "text-slate-500 hover:bg-slate-100"}`}
    >
      <Star size={14} className={plan.isBestValue ? "fill-amber-400 text-amber-500" : ""} />
      {plan.isBestValue ? "Pinned" : "Pin"}
    </button>
  );

  const renderPlanActions = (plan: FranchisePlan) => {
    const isBusy = actionPlanId === plan._id;
    const cannotHideLastLivePlan = plan.isActive && activeCount <= 1;
    return (
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => openEdit(plan)} aria-label={`Edit ${plan.name}`} title="Edit" className="rounded-md p-2 text-slate-500 hover:bg-sky-50 hover:text-sky-700"><Pencil size={15} /></button>
        {plan.isActive ? (
          <button type="button" disabled={isBusy || cannotHideLastLivePlan} onClick={() => setConfirmAction({ kind: "hide", plan })} aria-label={`Hide ${plan.name}`} title={cannotHideLastLivePlan ? "At least one plan must stay live" : "Hide"} className="rounded-md p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-30"><EyeOff size={15} /></button>
        ) : (
          <button type="button" disabled={isBusy} onClick={() => setConfirmAction({ kind: "show", plan })} aria-label={`Show ${plan.name}`} title="Show" className="rounded-md p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"><Eye size={15} /></button>
        )}
        <button type="button" disabled={isBusy || !plan.isActive || cannotHideLastLivePlan} onClick={() => setConfirmAction({ kind: "delete", plan })} aria-label={`Delete ${plan.name}`} title="Soft delete (hide from website)" className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={15} /></button>
      </div>
    );
  };

  const renderPlanCard = (plan: FranchisePlan) => (
    <article
      key={plan._id}
      className={`flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        plan.isBestValue ? "border-amber-300 ring-1 ring-amber-200/70" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-slate-400">{plan.code}</p>
          <h3 className="truncate text-base font-bold text-slate-800">{plan.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{plan.validityLabel || `${plan.durationMonths} months`}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${plan.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{plan.isActive ? "Live" : "Hidden"}</span>
      </div>

      <div className="mt-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/70 p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Total (incl. GST)</p>
        <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">{money(plan.totalWithGst)}</p>
        <p className="mt-1 text-xs text-slate-500">{money(plan.fee)} + {plan.gstPercent}% GST ({money(plan.gstAmount)})</p>
        {plan.effectiveMonthlyCost != null && (
          <p className="mt-1 text-xs font-semibold text-[rgb(6,106,156)]">≈ {money(plan.effectiveMonthlyCost)}/mo</p>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Renewal</dt>
          <dd className="mt-0.5 font-medium text-slate-700">{plan.renewalText || (plan.renewalFee != null ? money(plan.renewalFee) : plan.renewalNote || "As applicable")}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Order / franchises</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-slate-700">{plan.sortOrder} · {plan.franchiseCount ?? 0}</dd>
        </div>
      </dl>

      {plan.features.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {plan.features.slice(0, 3).map((feature) => (
            <li key={feature} className="flex gap-2 text-xs text-slate-600">
              <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" />
              <span className="min-w-0">{feature}</span>
            </li>
          ))}
          {plan.features.length > 3 && (
            <li className="text-xs font-medium text-slate-400">+{plan.features.length - 3} more</li>
          )}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="min-w-0 text-[11px] leading-snug text-slate-400">
          {actorName(plan.updatedBy || plan.createdBy)}
          <span className="block">{dateTime(plan.updatedAt || plan.createdAt)}</span>
        </p>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {renderPinButton(plan)}
          {renderPlanActions(plan)}
        </div>
      </div>
    </article>
  );

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: BRAND_GRADIENT }}>
            <Coins size={19} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Franchise Investment Plans</h1>
            <p className="mt-0.5 text-sm text-slate-500">Plans shown on the website /franchise page. Fee changes apply to new applicants only.</p>
          </div>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))" }}>
            <Plus size={16} /> New Plan
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search plans by code or name</span>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by plan code or name" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
        </label>
        <FilterSelect
          label="Filter plans by status"
          value={status}
          onChange={(value) => setStatus(value as StatusFilter)}
          options={[
            { value: "all", label: "All plans" },
            { value: "live", label: "Live" },
            { value: "hidden", label: "Hidden" },
          ]}
          className="sm:w-48"
        />
        <div role="group" aria-label="Choose plan view" className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["cards", "table"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
                view === option ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <span className="shrink-0 text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-slate-700">{visiblePlans.length}</span> of{" "}
          <span className="font-bold text-slate-700">{plans.length}</span> plans
        </span>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="mt-2 inline-flex items-center gap-1 font-semibold hover:underline">
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}
        {loading ? (
          <div className="space-y-3 p-5" aria-label="Loading franchise plans">
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
          </div>
        ) : error ? null : visiblePlans.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h2 className="font-semibold text-slate-800">No plans found</h2>
            <p className="mt-1 text-sm text-slate-500">
              {plans.length ? "Try another search or status filter." : "No plans yet — your franchise page is showing no pricing."}
            </p>
            {!plans.length && <button type="button" onClick={openCreate} className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))" }}><Plus size={15} /> New Plan</button>}
          </div>
        ) : view === "cards" ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {visiblePlans.map((plan) => renderPlanCard(plan))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Validity</th>
                  <th className="px-4 py-3 text-right">Fee excl. GST</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Renewal</th>
                  <th className="px-4 py-3">Best Value</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePlans.map((plan) => (
                    <tr key={plan._id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 tabular-nums text-slate-600">{plan.sortOrder}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{plan.name}</span>
                        {plan.effectiveMonthlyCost != null && (
                          <span className="mt-0.5 block text-xs text-slate-500">≈ {money(plan.effectiveMonthlyCost)}/mo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{plan.code}</td>
                      <td className="px-4 py-3 text-slate-600">{plan.validityLabel || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-700">{money(plan.fee)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {money(plan.gstAmount)}
                        <span className="ml-1 text-xs text-slate-400">({plan.gstPercent}%)</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{money(plan.totalWithGst)}</td>
                      <td className="px-4 py-3 text-slate-600">{plan.renewalText || (plan.renewalFee != null ? money(plan.renewalFee) : plan.renewalNote || "As applicable")}</td>
                      <td className="px-4 py-3">{renderPinButton(plan)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${plan.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{plan.isActive ? "Live" : "Hidden"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <span className="block">{actorName(plan.updatedBy || plan.createdBy)}</span>
                        <span>{dateTime(plan.updatedAt || plan.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3">{renderPlanActions(plan)}</td>
                    </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              Changing a fee updates the published page for new applicants. Existing franchise applications keep the price they applied at.
            </p>
          </div>
        )}
      </section>

      {isCreating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm();
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="plan-form-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h2 id="plan-form-title" className="text-lg font-bold text-slate-800">{editingPlan ? "Edit franchise plan" : "Create franchise plan"}</h2>
                <p className="text-xs text-slate-500">Plan pricing updates the public page for new applicants only.</p>
              </div>
              <button type="button" onClick={closeForm} disabled={saving} aria-label="Close plan form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
            </header>
            <form onSubmit={(event) => void submitForm(event)} className="grid gap-6 p-5 lg:grid-cols-[1fr_260px]">
              <div className="space-y-4">
                {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Plan code {editingPlan ? "*" : "(optional)"}
                    <select value={draft.code} onChange={(event) => { setDraft({ ...draft, code: event.target.value }); setFieldErrors({ ...fieldErrors, code: "" }); }} className={inputClass(!!fieldErrors.code)}>
                      {!editingPlan && <option value="">Auto-generate from duration</option>}
                      {planCodeOptions.map(({ code, isUsed }) => (
                        <option key={code} value={code} disabled={isUsed}>
                          {isUsed ? `${code} (already used)` : code}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.code && <span className="mt-1 block text-xs text-red-600">{fieldErrors.code}</span>}
                    {!editingPlan && <span className="mt-1 block text-xs font-normal text-slate-500">Leave this as-is to generate a unique code from the plan duration.</span>}
                    {editingPlan && <span className="mt-1 block text-xs font-normal text-amber-700">This is a reporting key. Changing the code may affect reports that use it.</span>}
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Plan name *
                    <input value={draft.name} maxLength={100} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={inputClass(!!fieldErrors.name)} placeholder="3-Year Plan" />
                    {fieldErrors.name && <span className="mt-1 block text-xs text-red-600">{fieldErrors.name}</span>}
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Fee (excluding GST) *
                    <span className="relative mt-1 block">
                      <span className="absolute left-3 top-2 text-sm text-slate-400">₹</span>
                      <input type="number" min="0" step="0.01" value={draft.fee} onChange={(event) => setDraft({ ...draft, fee: event.target.value })} className={`${inputClass(!!fieldErrors.fee)} pl-7`} placeholder="249000" />
                    </span>
                    {fieldErrors.fee && <span className="mt-1 block text-xs text-red-600">{fieldErrors.fee}</span>}
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    GST %
                    <input type="number" min="0" step="0.01" value={draft.gstPercent} onChange={(event) => setDraft({ ...draft, gstPercent: event.target.value })} className={inputClass(!!fieldErrors.gstPercent)} />
                    {fieldErrors.gstPercent && <span className="mt-1 block text-xs text-red-600">{fieldErrors.gstPercent}</span>}
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Renewal fee (₹)
                    <input type="number" min="0" step="0.01" value={draft.renewalFee} onChange={(event) => setDraft({ ...draft, renewalFee: event.target.value })} className={inputClass(!!fieldErrors.renewalFee)} placeholder="Leave blank if applicable" />
                    {fieldErrors.renewalFee && <span className="mt-1 block text-xs text-red-600">{fieldErrors.renewalFee}</span>}
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Renewal note
                    <input value={draft.renewalNote} maxLength={200} onChange={(event) => setDraft({ ...draft, renewalNote: event.target.value })} className={inputClass(false)} placeholder="As applicable" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Display order
                    <input type="number" min="0" step="1" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} className={inputClass(!!fieldErrors.sortOrder)} placeholder="Append last" />
                    {fieldErrors.sortOrder && <span className="mt-1 block text-xs text-red-600">{fieldErrors.sortOrder}</span>}
                  </label>
                </div>

                <fieldset>
                  <legend className="text-sm font-semibold text-slate-700">Features</legend>
                  <div className="mt-2 space-y-2">
                    {draft.features.map((feature, index) => (
                      <div key={index} className="flex gap-2">
                        <input value={feature} maxLength={200} aria-label={`Plan feature ${index + 1}`} onChange={(event) => setDraft({ ...draft, features: draft.features.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500" placeholder="Franchise access for 3 years" />
                        <button type="button" aria-label={`Remove feature ${index + 1}`} disabled={draft.features.length <= 1} onClick={() => setDraft({ ...draft, features: draft.features.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-lg border border-slate-200 px-3 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><X size={15} /></button>
                      </div>
                    ))}
                    {fieldErrors.features && <p className="text-xs text-red-600">{fieldErrors.features}</p>}
                    <button type="button" disabled={draft.features.length >= 20} onClick={() => setDraft({ ...draft, features: [...draft.features, ""] })} className="text-xs font-semibold text-sky-700 hover:underline disabled:opacity-40">+ Add feature</button>
                  </div>
                </fieldset>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                    <input type="checkbox" checked={draft.isBestValue} onChange={(event) => setDraft({ ...draft, isBestValue: event.target.checked })} className="accent-amber-500" />
                    <span><span className="block font-semibold">Best Value</span><span className="text-xs text-slate-500">Moves the badge from any other plan.</span></span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      disabled={!!editingPlan?.isActive && activeCount <= 1}
                      onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
                      className="accent-emerald-600"
                    />
                    <span>
                      <span className="block font-semibold">Live on site</span>
                      <span className="text-xs text-slate-500">At least one plan must remain live.</span>
                      {fieldErrors.isActive && <span className="mt-1 block text-xs text-red-600">{fieldErrors.isActive}</span>}
                    </span>
                  </label>
                </div>
              </div>

              <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-800">Public card values</h3>
                {editingPlan ? (
                  <>
                    {editingPlan.isBestValue && <p className="mt-3 text-xs font-bold uppercase tracking-wide text-amber-700">★ Best Value</p>}
                    <p className="mt-3 font-semibold text-slate-800">{editingPlan.name}</p>
                    <p className="mt-1 text-xs uppercase text-slate-500">{editingPlan.validityLabel}</p>
                    <p className="mt-3 text-lg font-bold text-slate-900">{money(editingPlan.fee)}</p>
                    <p className="text-xs text-slate-500">GST inclusive: {money(editingPlan.totalWithGst)}</p>
                    {editingPlan.effectiveMonthlyCost != null && <p className="mt-2 text-xs text-slate-500">≈ {money(editingPlan.effectiveMonthlyCost)}/mo</p>}
                    <p className="mt-2 text-xs text-slate-500">Renewal: {editingPlan.renewalText}</p>
                    <p className="mt-3 text-[11px] text-slate-400">Displayed values are from the saved API record. Updated values appear after saving.</p>
                  </>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    The API returns the public validity label, GST, total, renewal text, and effective monthly cost after the plan is saved. This form does not calculate public pricing in the browser.
                  </p>
                )}
              </aside>

              <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4 lg:col-span-2">
                <button type="button" disabled={saving} onClick={closeForm} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))" }}>
                  {saving && <LoaderCircle size={15} className="animate-spin" />}
                  {saving ? "Saving..." : editingPlan ? "Save changes" : "Create plan"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {feeConfirmOpen && editingPlan && (
        <ConfirmDialog
          title={`Update fee to ${money(Number(draft.fee))}?`}
          message="New applicants will see the new price. Existing franchise applications keep the price they applied at."
          confirmLabel="Update fee"
          danger={false}
          isSubmitting={saving}
          onConfirm={() => {
            setFeeConfirmOpen(false);
            void persistDraft();
          }}
          onCancel={() => setFeeConfirmOpen(false)}
        />
      )}

      {confirmAction && confirmCopy && (
        <ConfirmDialog
          title={confirmCopy.title}
          message={confirmCopy.message}
          confirmLabel={confirmCopy.label}
          danger={confirmAction.kind !== "show"}
          isSubmitting={actionPlanId === confirmAction.plan._id}
          onConfirm={() => void performAction()}
          onCancel={() => { if (!actionPlanId) setConfirmAction(null); }}
        />
      )}
    </AdminLayout>
  );
};

export default FranchisePlans;
