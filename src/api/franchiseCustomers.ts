import axiosInstance from "./axiosInstance";

export interface FranchiseSummary {
  _id: string;
  name?: string;
  franchiseId?: string;
  franchiseStatus?: string;
}

export interface FranchiseCustomerCibil {
  status: "NotChecked" | "Checked" | "Failed" | string;
  score?: number | null;
  band?: { key?: string; label?: string; min?: number };
  provider?: string;
  referenceId?: string;
  checkedAt?: string | null;
  expiresAt?: string | null;
  failureReason?: string | null;
  threshold?: number;
  canApplyLoan?: boolean;
  locked?: boolean;
  reason?: string | null;
}

export interface FranchiseCustomer {
  _id: string;
  franchiseCode?: string;
  fullName?: string;
  mobile?: string;
  email?: string;
  panNumber?: string;
  dob?: string | null;
  cibilConsentAt?: string | null;
  cibil?: FranchiseCustomerCibil;
  loanForm?: { locked?: boolean; reason?: string | null; canApplyLoan?: boolean };
  franchise?: FranchiseSummary | null;
  loans?: {
    count?: number;
    lastAppliedAt?: string | null;
    /** Product-wise names — newer list responses bhejte hain, warna detail se aate hain. */
    byProduct?: { product: string; count: number }[];
    products?: string[];
  };
}

export interface FranchiseCustomerPage {
  customers: FranchiseCustomer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Per-franchise row of `GET /franchise-customers/stats`.
 *
 * The live backend returns `{ franchise, total }` only — the CIBIL funnel
 * columns were dropped from the payload, so they stay optional here and the UI
 * renders them only when the response actually supplies them.
 */
export interface FranchiseCustomerStatRow {
  franchise: FranchiseSummary | null;
  total: number;
  /** Is franchise ne apne customers ke kitne loans file kiye — product-wise. */
  loans?: {
    total: number;
    byProduct: { product: string; count: number }[];
  };
  consented?: number;
  notChecked?: number;
  checked?: number;
  failed?: number;
  eligible?: number;
  locked?: number;
  checkedLocked?: number;
}

export interface FranchiseCustomerStats {
  total: number;
  byFranchise: FranchiseCustomerStatRow[];
  /** Legacy CIBIL aggregate — only sent by older backend deployments. */
  threshold?: number;
  consented?: number;
  notChecked?: number;
  checked?: number;
  failed?: number;
  eligible?: number;
  locked?: number;
  checkedLocked?: number;
  byStatus?: Record<string, number>;
}

export interface FranchiseCustomerLoan {
  /** Application id — detail route ke liye. Backend `_id` ya `applicationId` bhejta hai. */
  _id?: string;
  applicationId?: string;
  id?: string;
  applicationNo?: string;
  status?: string;
  stage?: string;
  stageKey?: string;
  step?: number;
  loanAmount?: number | null;
  loanType?: string;
  /** Product ka route slug, jab row khud bheje. */
  slug?: string;
}

export interface FranchiseCustomerLoanGroup {
  product: string;
  count: number;
  applications: FranchiseCustomerLoan[];
}

export interface FranchiseCustomerDetail extends Omit<FranchiseCustomer, "loans"> {
  loans?: {
    total: number;
    byStatus: Record<string, number>;
    data: FranchiseCustomerLoanGroup[];
  };
}

export const getFranchiseCustomers = async (params: {
  search?: string;
  franchise?: string;
  cibilStatus?: string;
  locked?: string;
  page: number;
  limit: number;
}): Promise<FranchiseCustomerPage> => {
  const response = await axiosInstance.get<FranchiseCustomerPage>("/franchise-customers", { params });
  return response.data;
};

/**
 * Franchise customer ka applicant contact — loan row sirf inhi fields se match
 * hoti hai (naam unique nahi hota, is liye usse match nahi karte).
 */
export interface FranchiseCustomerContact {
  mobile: string;
  email: string;
}

/*
Franchise dashboard ko poore network ki directory chahiye (mobile/email), kyunki
har loan product ka list payload franchise reference nahi bhejta. Pehle ye pages
ek ke baad ek maangi jaati thin — 3,000 customers par 30 sequential round-trips,
aur dashboard tab tak loading me rehta tha. Ab page 1 ke baad baaki pages 5-5 ke
batch me parallel aate hain, aur result 5 minute cache rehta hai.

Cache scope ka nahi, numbers ka shortcut hai: purani directory se sirf kuch
franchise customers chhoot sakte hain (naya customer 5 min tak na dikhe), koi
direct customer ki application andar nahi aati. Page par cap nahi — adhoori
directory ka matlab adhoora (galat) scope hota hai.
*/
const DIRECTORY_PAGE_SIZE = 100;
const DIRECTORY_CONCURRENCY = 5;
const DIRECTORY_TTL_MS = 5 * 60_000;

interface DirectoryCache {
  fetchedAt: number;
  rows: FranchiseCustomerContact[];
}

let directoryCache: DirectoryCache | null = null;
let directoryInFlight: Promise<FranchiseCustomerContact[]> | null = null;

/** Items par bounded concurrency — result ka order input jaisa hi rehta hai. */
const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await work(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
};

const loadFranchiseCustomerDirectory = async (): Promise<FranchiseCustomerContact[]> => {
  const first = await getFranchiseCustomers({ page: 1, limit: DIRECTORY_PAGE_SIZE });
  const totalPages = Math.max(1, first.totalPages || 1);

  const rest = await mapWithConcurrency(
    Array.from({ length: totalPages - 1 }, (_, index) => index + 2),
    DIRECTORY_CONCURRENCY,
    (page) => getFranchiseCustomers({ page, limit: DIRECTORY_PAGE_SIZE })
  );

  const rows = [first, ...rest]
    .flatMap((page) => page.customers ?? [])
    .map((customer) => ({
      mobile: customer.mobile ?? "",
      email: customer.email ?? "",
    }));

  directoryCache = { fetchedAt: Date.now(), rows };
  return rows;
};

/**
 * Poore network ke franchise customers, page-by-page.
 *
 * `fresh: true` cache ko ignore karta hai (data badalne ke baad). Ek hi waqt me
 * do callers ho (StrictMode dev me effects do baar chalte hain) to dono ek hi
 * request share karte hain.
 */
export const getFranchiseCustomerDirectory = async (
  options: { fresh?: boolean } = {}
): Promise<FranchiseCustomerContact[]> => {
  const cached = directoryCache;
  if (!options.fresh && cached && Date.now() - cached.fetchedAt < DIRECTORY_TTL_MS) {
    return cached.rows;
  }

  if (directoryInFlight) return directoryInFlight;

  const request = loadFranchiseCustomerDirectory();
  directoryInFlight = request;

  try {
    return await request;
  } finally {
    if (directoryInFlight === request) directoryInFlight = null;
  }
};

/** GET /franchise-customers/stats — network-wide count, franchise by franchise. */
export const getFranchiseCustomerStats = async (): Promise<FranchiseCustomerStats> => {
  const response = await axiosInstance.get<{ stats?: FranchiseCustomerStats }>("/franchise-customers/stats");
  const stats = response.data.stats;
  if (!stats || !Array.isArray(stats.byFranchise)) {
    throw new Error("Unexpected response from GET /franchise-customers/stats");
  }
  return stats;
};

export const getFranchiseCustomer = async (id: string): Promise<{
  customer: FranchiseCustomerDetail;
  franchise: FranchiseSummary | null;
  loans: NonNullable<FranchiseCustomerDetail["loans"]>;
}> => {
  const response = await axiosInstance.get<{
    customer: FranchiseCustomerDetail;
    franchise: FranchiseSummary | null;
    loans: NonNullable<FranchiseCustomerDetail["loans"]>;
  }>(`/franchise-customers/${encodeURIComponent(id)}`);
  return response.data;
};

/*
DELETE /franchise-customers/:id
Super admin only — franchise customer record (CIBIL audit trail ke saath) hat jaata hai.
*/
export const deleteFranchiseCustomer = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/franchise-customers/${encodeURIComponent(id)}`);
};

export { getApiErrorMessage } from "../utils/apiError";
