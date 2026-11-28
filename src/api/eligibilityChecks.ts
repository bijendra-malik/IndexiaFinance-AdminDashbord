import axiosInstance from "./axiosInstance";

/*
==========================================
Eligibility checks API — /api/admin/eligibility-checks

Website ke /eligibility-calculator form se aaye checks (super admin only).
Base URL axiosInstance me /api/admin hai, isliye yahan sirf
"/eligibility-checks" likha hai.
==========================================
*/

export type EligibleFilter = "all" | "yes" | "no";

/** LAP checks ka property snapshot (baaki products par null). */
export interface EligibilityProperty {
  type: string;
  typeOther: string;
  usage: string;
  city: string;
  marketValue: number;
  monthlyRent: number;
  /** Rent ka 75% jo income me joda gaya. */
  rentCounted: number;
  existingLoan: number;
  ltvPercent: number | null;
}

export interface EligibilityCheck {
  id: string;
  checkNo: string;
  name: string;
  mobile: string;
  email: string;
  age: number | null;
  occupation: string;
  /** Product code (personal_loan) — filter/list isi par chalta hai. */
  product: string;
  productLabel: string;
  family: string;
  monthlyIncome: number;
  /** Business loan ki saal ki income (yearly); monthly income isi se banti hai. */
  annualIncome: number;
  /** Loan Against Property ka property detail; doosre products par null. */
  property: EligibilityProperty | null;
  existingEmi: number;
  netIncome: number;
  foirPercent: number | null;
  maxEmi: number;
  /** FOIR lagane wali counted income (LAP rented-out me rent ka 75% included). */
  foirIncome: number;
  /** Naye loan se pehle available EMI room (maxEmi − existing EMI). */
  emiHeadroom: number;
  roi: number | null;
  tenureMonths: number | null;
  maxLoanAmount: number | null;
  emi: number | null;
  eligible: boolean;
  reason: string | null;
  /** Machine-readable rule that stopped the check (null when eligible). */
  reasonCode: string | null;
  /** Full sentence the applicant saw on the website. */
  message: string;
  suggestions: string[];
  /** Which cap bounded the amount — e.g. "Repayment capacity". */
  binding: string | null;
  caps: { key: string; label: string; value: number }[];
  source: string;
  checkedAt: string | null;
}

export interface EligibilityProductRow {
  product: string;
  label: string;
  total: number;
  eligible: number;
}

export interface EligibilityCheckStats {
  total: number;
  eligible: number;
  notEligible: number;
  today: number;
  todayEligible: number;
  eligibleRate: number;
  avgNetIncome: number;
  byProduct: EligibilityProductRow[];
}

export interface EligibilityCheckList {
  checks: EligibilityCheck[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface EligibilityCheckFilters {
  search?: string;
  product?: string;
  eligible?: EligibleFilter;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

const recordOf = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asText = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : "";

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const asNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asDate = (value: unknown): string | null => {
  const text = asText(value);
  return text ? text : null;
};

const toProperty = (value: unknown): EligibilityProperty | null => {
  if (value === null || value === undefined || typeof value !== "object") return null;
  const item = recordOf(value);
  return {
    type: asText(item.type),
    typeOther: asText(item.typeOther),
    usage: asText(item.usage),
    city: asText(item.city),
    marketValue: asNumber(item.marketValue),
    monthlyRent: asNumber(item.monthlyRent),
    rentCounted: asNumber(item.rentCounted),
    existingLoan: asNumber(item.existingLoan),
    ltvPercent: asNumberOrNull(item.ltvPercent),
  };
};

const toCheck = (value: unknown): EligibilityCheck => {
  const item = recordOf(value);
  return {
    id: asText(item.id ?? item._id),
    checkNo: asText(item.checkNo),
    name: asText(item.name),
    mobile: asText(item.mobile),
    email: asText(item.email),
    age: asNumberOrNull(item.age),
    occupation: asText(item.occupation),
    product: asText(item.product),
    productLabel: asText(item.productLabel) || "—",
    monthlyIncome: asNumber(item.monthlyIncome),
    annualIncome: asNumber(item.annualIncome),
    property: toProperty(item.property),
    existingEmi: asNumber(item.existingEmi),
    netIncome: asNumber(item.netIncome),
    foirPercent: asNumberOrNull(item.foirPercent),
    maxEmi: asNumber(item.maxEmi),
    foirIncome: asNumber(item.foirIncome),
    emiHeadroom: asNumber(item.emiHeadroom),
    family: asText(item.family),
    roi: asNumberOrNull(item.roi),
    tenureMonths: asNumberOrNull(item.tenureMonths),
    maxLoanAmount: asNumberOrNull(item.maxLoanAmount),
    emi: asNumberOrNull(item.emi),
    eligible: Boolean(item.eligible),
    reason: asText(item.reason) || null,
    reasonCode: asText(item.reasonCode) || null,
    message: asText(item.message),
    suggestions: Array.isArray(item.suggestions)
      ? item.suggestions.map(asText).filter(Boolean)
      : [],
    binding: asText(item.binding) || null,
    caps: (Array.isArray(item.caps) ? item.caps : []).map((cap) => {
      const row = recordOf(cap);
      return { key: asText(row.key), label: asText(row.label), value: asNumber(row.value) };
    }),
    source: asText(item.source),
    checkedAt: asDate(item.checkedAt ?? item.createdAt),
  };
};

export const getEligibilityChecks = async (
  filters: EligibilityCheckFilters = {}
): Promise<EligibilityCheckList> => {
  const { data } = await axiosInstance.get<Record<string, unknown>>(
    "/eligibility-checks",
    {
      params: {
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.product && filters.product !== "all"
          ? { product: filters.product }
          : {}),
        ...(filters.eligible && filters.eligible !== "all"
          ? { eligible: filters.eligible }
          : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(filters.page ? { page: filters.page } : {}),
        ...(filters.limit ? { limit: filters.limit } : {}),
      },
    }
  );

  return {
    checks: (Array.isArray(data.checks) ? data.checks : []).map(toCheck),
    total: asNumber(data.total),
    page: asNumber(data.page) || 1,
    limit: asNumber(data.limit) || 25,
    pages: Math.max(1, asNumber(data.pages) || 1),
  };
};

export const getEligibilityCheck = async (id: string): Promise<EligibilityCheck> => {
  const { data } = await axiosInstance.get<{ check?: unknown }>(
    `/eligibility-checks/${id}`
  );

  return toCheck(data.check);
};

/* Permanent delete — backend 404 deta hai agar row pehle hi delete ho chuki ho. */
export const deleteEligibilityCheck = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/eligibility-checks/${id}`);
};

export const getEligibilityCheckStats = async (): Promise<EligibilityCheckStats> => {
  const { data } = await axiosInstance.get<{ stats?: unknown }>(
    "/eligibility-checks/stats"
  );
  const stats = recordOf(data.stats);

  return {
    total: asNumber(stats.total),
    eligible: asNumber(stats.eligible),
    notEligible: asNumber(stats.notEligible),
    today: asNumber(stats.today),
    todayEligible: asNumber(stats.todayEligible),
    eligibleRate: asNumber(stats.eligibleRate),
    avgNetIncome: asNumber(stats.avgNetIncome),
    byProduct: (Array.isArray(stats.byProduct) ? stats.byProduct : []).map((row) => {
      const item = recordOf(row);
      return {
        product: asText(item.product),
        label: asText(item.label) || asText(item.product),
        total: asNumber(item.total),
        eligible: asNumber(item.eligible),
      };
    }),
  };
};

export const formatRupees = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  return "₹" + Math.round(value).toLocaleString("en-IN");
};
