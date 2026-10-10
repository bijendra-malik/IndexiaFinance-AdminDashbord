import axiosInstance from "./axiosInstance";

export interface FranchisePlan {
  _id: string;
  code: string;
  name: string;
  durationMonths: number;
  validityLabel: string;
  fee: number;
  gstPercent: number;
  gstAmount: number;
  totalWithGst: number;
  renewalFee: number | null;
  renewalNote: string;
  renewalText: string;
  features: string[];
  sortOrder: number;
  isBestValue: boolean;
  isActive: boolean;
  effectiveMonthlyCost: number | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | { name?: string; email?: string } | null;
  updatedBy?: string | { name?: string; email?: string } | null;
  franchiseCount?: number;
}

export interface FranchisePlansResponse {
  plans: FranchisePlan[];
  count: number;
  bestValueCode?: string;
  bestValueIsPinned?: boolean;
}

export type FranchisePlanPayload = Partial<
  Pick<
    FranchisePlan,
    | "code"
    | "name"
    | "durationMonths"
    | "fee"
    | "gstPercent"
    | "renewalFee"
    | "renewalNote"
    | "features"
    | "sortOrder"
    | "isBestValue"
    | "isActive"
  >
>;

const recordOf = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const numeric = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
      ? Number(value)
      : undefined;

const optionalNumber = (value: unknown): number | null | undefined =>
  value === null ? null : numeric(value);

const optionalBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const normalizePlan = (value: unknown): FranchisePlan | null => {
  const plan = recordOf(value);
  const id = optionalString(plan._id ?? plan.id);
  const code = optionalString(plan.code);
  const name = optionalString(plan.name);
  const durationMonths = numeric(plan.durationMonths);
  const fee = numeric(plan.fee);
  if (!id || !code || !name || durationMonths === undefined || fee === undefined) return null;

  const features = Array.isArray(plan.features)
    ? plan.features.filter((feature): feature is string => typeof feature === "string")
    : [];
  const gstPercent = numeric(plan.gstPercent) ?? 18;
  const gstAmount = optionalNumber(plan.gstAmount) ?? 0;
  const totalWithGst = optionalNumber(plan.totalWithGst) ?? fee + gstAmount;
  const renewalFee = optionalNumber(plan.renewalFee) ?? null;

  return {
    _id: id,
    code,
    name,
    durationMonths,
    validityLabel: optionalString(plan.validityLabel) ?? `${durationMonths} Months`,
    fee,
    gstPercent,
    gstAmount,
    totalWithGst,
    renewalFee,
    renewalNote: optionalString(plan.renewalNote) ?? "As applicable",
    renewalText: optionalString(plan.renewalText) ?? (
      renewalFee === null ? optionalString(plan.renewalNote) ?? "As applicable" : `₹${renewalFee.toLocaleString("en-IN")}`
    ),
    features,
    sortOrder: numeric(plan.sortOrder) ?? 0,
    isBestValue: optionalBoolean(plan.isBestValue) ?? false,
    isActive: optionalBoolean(plan.isActive) ?? true,
    effectiveMonthlyCost: optionalNumber(plan.effectiveMonthlyCost) ?? null,
    ...(optionalString(plan.createdAt) ? { createdAt: optionalString(plan.createdAt) } : {}),
    ...(optionalString(plan.updatedAt) ? { updatedAt: optionalString(plan.updatedAt) } : {}),
    ...(plan.createdBy !== undefined ? { createdBy: plan.createdBy as FranchisePlan["createdBy"] } : {}),
    ...(plan.updatedBy !== undefined ? { updatedBy: plan.updatedBy as FranchisePlan["updatedBy"] } : {}),
    ...(numeric(plan.franchiseCount) !== undefined ? { franchiseCount: numeric(plan.franchiseCount) } : {}),
  };
};

export const getFranchisePlans = async (
  active?: boolean
): Promise<FranchisePlansResponse> => {
  const response = await axiosInstance.get<unknown>("/franchise-plans", {
    params: active === undefined ? undefined : { active },
  });
  const root = recordOf(response.data);
  const nested = recordOf(root.data);
  const plansValue =
    root.plans ??
    root.franchisePlans ??
    root.results ??
    nested.plans ??
    nested.franchisePlans ??
    nested.results ??
    nested.items ??
    (Array.isArray(root.data) ? root.data : undefined);
  if (!Array.isArray(plansValue)) {
    throw new Error(
      `Unexpected response while loading franchise plans. Expected plans[] in the API response; received top-level fields: ${Object.keys(root).join(", ") || "none"}.`
    );
  }
  const plans = plansValue.map((plan, index) => {
    const normalized = normalizePlan(plan);
    if (!normalized) {
      throw new Error(
        `Unexpected franchise plan at index ${index}. Each plan must include _id, code, name, durationMonths, and fee.`
      );
    }
    return normalized;
  });
  const count = Number(root.count ?? nested.count ?? root.total ?? nested.total ?? plans.length);
  return {
    plans,
    count: Number.isFinite(count) ? count : plans.length,
    bestValueCode: typeof root.bestValueCode === "string"
      ? root.bestValueCode
      : typeof nested.bestValueCode === "string" ? nested.bestValueCode : undefined,
    bestValueIsPinned: typeof root.bestValueIsPinned === "boolean"
      ? root.bestValueIsPinned
      : typeof nested.bestValueIsPinned === "boolean" ? nested.bestValueIsPinned : undefined,
  };
};

export const createFranchisePlan = async (
  payload: FranchisePlanPayload
): Promise<void> => {
  await axiosInstance.post("/franchise-plans", payload);
};

export const updateFranchisePlan = async (
  id: string,
  payload: FranchisePlanPayload
): Promise<void> => {
  await axiosInstance.patch(
    `/franchise-plans/${encodeURIComponent(id)}`,
    payload
  );
};

export const setFranchisePlanBestValue = async (
  id: string,
  isBestValue: boolean
): Promise<void> => {
  await axiosInstance.patch(
    `/franchise-plans/${encodeURIComponent(id)}/best-value`,
    { isBestValue }
  );
};

export const setFranchisePlanStatus = async (
  id: string,
  isActive: boolean
): Promise<void> => {
  await axiosInstance.patch(
    `/franchise-plans/${encodeURIComponent(id)}/status`,
    { isActive }
  );
};

export const deleteFranchisePlan = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/franchise-plans/${encodeURIComponent(id)}`);
};
