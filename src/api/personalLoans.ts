import axiosInstance from "./axiosInstance";
import type { AdminUpdate, StatusRecommendation } from "../types/admin.types";

export { getApiErrorMessage } from "../utils/apiError";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LoanStatus = "Pending" | "Approved" | "Rejected" | "Submitted";

export const MINIMUM_CREDIT_SCORE = 600;

export interface PersonalLoan {
  _id: string;
  user: string;
  loanType: string;
  loanAmount: number;
  loanTenure: number;

  // ── Common applicant fields ───────────────────────────────────────────────
  fullName?: string;
  mobile?: string;
  email?: string;
  dob?: string;
  panNumber?: string;
  state?: string;
  city?: string;
  pincode?: string;
  residenceStatus?: string;

  // ── Credit eligibility snapshot captured when the application is submitted
  creditScore?: number | null;
  creditEligible?: boolean;
  creditScoreCheckedAt?: string | null;
  /** 24-hour eligibility window end (null when the score was not eligible). */
  creditEligibilityExpiresAt?: string | null;

  // ── Review metadata stamped by PATCH /{resource}/:id/status ──────────────
  /** Public application number (e.g. LOAN000001); older records may lack it. */
  applicationNo?: string | null;
  /** Source channel — `franchise`/`franchiseCode` present = franchise sale, absent = direct customer. */
  franchise?: string | null;
  franchiseCode?: string | null;
  /** Franchise-customer reference — set jab franchise ne apne customer ke liye file ki ho. */
  franchiseCustomer?: string | null;
  franchiseId?: string | null;
  franchiseCustomerId?: string | null;
  franchiseCustomerCode?: string | null;
  isFranchiseCustomer?: boolean;
  channel?: string;
  /** Rejection / review note saved with the last status change (max 500 chars). */
  adminNote?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  /** Admin updates/remarks added by admins with access */
  adminUpdates?: AdminUpdate[];
  /** Latest status suggested by a regular admin (super admin takes the final call). */
  statusRecommendation?: StatusRecommendation | null;

  // ── Employment / salary fields ────────────────────────────────────────────
  employmentType?: string;
  companyName?: string;
  companyType?: string;
  companyTypeOther?: string;
  monthlySalary?: number;
  salaryReceivedAs?: string;
  salaryReceivedAsOther?: string;
  salaryBankName?: string;
  salaryBankOther?: string;

  // ── Existing liabilities ──────────────────────────────────────────────────
  existingEMI?: number;
  existingLoanAmount?: number;
  existingBanks?: string[];
  otherBankList?: string[];
  existingLoanTypes?: string[];
  otherLoanList?: string[];

  // ── Business loan fields ──────────────────────────────────────────────────
  businessName?: string;
  businessType?: string;
  businessTypeOther?: string;
  businessVintage?: string;
  businessEstablishedDate?: string;
  businessState?: string;
  businessCity?: string;
  businessPincode?: string;
  businessPincodeOther?: string;
  businessPlaceStatus?: string;
  businessPlaceStatusOther?: string;
  currentYearTurnover?: number;
  priorYearTurnover?: number;
  lastYearTurnover?: number;
  last2YearsTurnover?: number;
  currentYearNetIncome?: number;
  previousYearNetIncome?: number;
  lastYearNetIncome?: number;
  last2YearsNetIncome?: number;
  gstNumber?: string;
  udyamNumber?: string;
  companyPanNumber?: string;
  natureOfBusiness?: string;
  natureOfBusinessOther?: string;
  industryType?: string;
  industryTypeOther?: string;
  subIndustry?: string;
  transactionBankName?: string | string[] | { displayName?: string; banks?: string[] };
  transactionBankDisplayName?: string;
  transactionBankOther?: string;
  transactionBanks?: string[];

  // ── Self Employed - Professional fields ───────────────────────────────────
  profession?: string;
  professionOther?: string;

  // ── Project / property / commercial purchase fields ───────────────────────
  projectName?: string;
  projectType?: string;
  projectCost?: number;
  projectLocation?: string;
  propertyType?: string;
  propertyValue?: number;
  propertyLocation?: string;
  propertyAge?: string;
  builderName?: string;
  buyingPropertyType?: string;
  buyingPropertyTypeOther?: string;
  buyingPropertyMarketValue?: number;
  buyingPropertyAge?: number;
  buyingPropertyState?: string;
  buyingPropertyCity?: string;
  buyingPropertyPincode?: string;
  buyingPropertyPincodeOther?: string;

  // ── Car loan fields ───────────────────────────────────────────────────────
  vehicleType?: string;
  vehicleModel?: string;
  vehicleBrand?: string;
  vehicleYear?: string | number;
  vehiclePrice?: number;
  dealerName?: string;
  isNewVehicle?: boolean;

  // ── Education loan fields ─────────────────────────────────────────────────
  courseName?: string;
  instituteName?: string;
  courseType?: string;
  courseDuration?: string | number;
  admissionStatus?: string;
  countryOfStudy?: string;

  // ── Lease Rental Discounting fields ──────────────────────────────────────
  monthlyLeaseIncome?: number;
  totalLeaseAmount?: number;
  leasePropertyDuration?: number;
  leasePropertyMarketValue?: number;
  leasePropertyAge?: number;
  leasePropertyState?: string;
  leasePropertyCity?: string;
  leasePropertyPincode?: string;
  leasePropertyPincodeOther?: string;

  // ── Credit card fields ────────────────────────────────────────────────────
  cardType?: string;
  creditLimit?: number;
  annualIncome?: number;

  // ── Catch-all for any extra backend fields ────────────────────────────────
  [key: string]: unknown;

  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Extract the array from any of the common backend response shapes */
const extractList = (data: unknown): PersonalLoan[] => {
  if (Array.isArray(data)) return data as PersonalLoan[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const list = (obj.data ?? obj.loans ?? obj.applications) as PersonalLoan[] | undefined;
    if (Array.isArray(list)) return list;
    throw new Error(`Unexpected response shape. Keys: ${Object.keys(obj).join(", ")}`);
  }
  throw new Error("Unexpected non-object response from API");
};

/** Extract a single item from any of the common backend response shapes */
const extractItem = (data: unknown, path: string): PersonalLoan => {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const item = (obj.data ?? obj.loan ?? obj.application ?? (obj._id ? obj : undefined)) as PersonalLoan | undefined;
    if (item) return item;
    throw new Error(`Unexpected response shape at ${path}. Keys: ${Object.keys(obj).join(", ")}`);
  }
  throw new Error(`Unexpected non-object response at ${path}`);
};

// ── Slug → endpoint map ───────────────────────────────────────────────────────
// Add new loan types here when their backend routes go live.

const SLUG_ENDPOINT: Record<string, string> = {
  "personal-loan":              "/personal-loans",
  "business-loan":              "/business-loans",
  "home-loan":                  "/home-loans",
  "loan-against-property":      "/loan-against-properties",
  "balance-transfer":           "/balance-transfers",
  "project-loan":               "/project-loans",
  "car-loan":                   "/vehicle-loans",
  "education-loan":             "/education-loans",
  "credit-card":                "/credit-cards",
  "commercial-purchase":        "/commercial-purchases",
  "working-capital":            "/working-capitals",
  "lease-rental-discounting":   "/lease-rental-discountings",
  "odcc-limit":                 "/od-cc-limits",
  "loan-against-share":         "/loan-against-shares",
  "npa-loan":                   "/npa-loans",
  "gold-loan":                  "/gold-loans",
  "fdi-loan":                   "/fdi-loans",
  "film-funding":          "/film-fundings",
};

/** All slugs that have a live backend endpoint */
export const SUPPORTED_LOAN_SLUGS = new Set(Object.keys(SLUG_ENDPOINT));

/**
 * Reverse index: backend `resource` name → admin slug (`vehicle-loans` →
 * `car-loan`). The map values carry a leading slash, the payload does not, so
 * it is stripped while building the index.
 */
const RESOURCE_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_ENDPOINT).map(([slug, resource]) => [resource.replace(/^\//, ""), slug])
);

/**
 * Translate a backend `resource` field (e.g. `vehicle-loans`, the value the
 * endpoint builds its URL from) into the slugs the admin routes use
 * (`/applications/car-loan`). Unknown resources return `undefined` so
 * callers can render plain text instead of a broken link.
 */
export const resourceToSlug = (resource?: string): string | undefined =>
  resource ? RESOURCE_TO_SLUG[resource] : undefined;

// ── API calls ─────────────────────────────────────────────────────────────────

/** Populated reference bhi chal jaaye — `{ _id }`, `{ id }` ya plain string. */
const referenceText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return referenceText(record._id ?? record.id ?? record.code);
  }
  return "";
};

/** Channel as the application row itself declares it. */
export type LoanChannel = "franchise-customer" | "franchise" | "customer" | "unknown";

/**
 * Row apne aap ko kis channel ka batati hai?
 *
 * Backend source alag-alag key me bhejta hai (`channel`, `applicationSource`,
 * `source`, `customerType`) aur kabhi bilkul nahi. Declared source reference se
 * pehle dekha jaata hai: ek direct customer ki application par pada purana
 * franchise reference use franchise-customer bana deta tha, aur wo loan
 * franchise admin ke dashboard me ghus jaata tha.
 */
export const loanChannelOf = (loan: PersonalLoan): LoanChannel => {
  if (loan.isFranchiseCustomer === true) return "franchise-customer";

  const declared = [loan.channel, loan.applicationSource, loan.source, loan.customerType]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => value.trim().toLowerCase())
    .join(" ");

  const hasFranchiseCustomerRef = [
    loan.franchiseCustomer,
    loan.franchiseCustomerId,
    loan.franchiseCustomerCode,
  ].some((value) => Boolean(referenceText(value)));
  const hasFranchiseRef = [loan.franchise, loan.franchiseCode, loan.franchiseId].some((value) =>
    Boolean(referenceText(value))
  );

  if (/franchise[\s_-]*customer/.test(declared) || hasFranchiseCustomerRef) {
    return "franchise-customer";
  }
  /* Application khud "customer"/"direct" kehti hai — uspar laga franchise
     reference purana ho sakta hai, isliye declared source hi jeetta hai. */
  if (/\bcustomer\b|\bdirect\b/.test(declared)) return "customer";
  if (/\bfranchise\b/.test(declared) || hasFranchiseRef) return "franchise";

  return "unknown";
};

/** Application franchise side se aayi hai? Source na ho to references decide karte hain. */
export const isFranchiseCustomerLoan = (loan: PersonalLoan): boolean => {
  const channel = loanChannelOf(loan);
  return channel === "franchise-customer" || channel === "franchise";
};

/** `LOAN000143`, `LOAN-000143` ya `loan 143` — ek hi number maane jaate hain. */
const normalizeApplicationNo = (value?: string | null): string =>
  (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Application number har record par alag naam se mil sakta hai. */
const loanApplicationNo = (loan: PersonalLoan): string => {
  const raw = loan.applicationNo ?? loan.applicationNumber ?? loan.appNo;
  return typeof raw === "string" ? normalizeApplicationNo(raw) : "";
};

/** Sirf digits — number formats `LOAN000096`, `LOAN-96` aur `96` ko jodne ke liye. */
const digitsOnly = (value?: string | null): string => (value ?? "").replace(/\D/g, "");

/** Mobile compare ke liye aakhri 10 digits. */
const mobileDigits = (value?: string | null): string => {
  const digits = digitsOnly(value);
  return digits.length >= 10 ? digits.slice(-10) : "";
};

export interface LoanLookupHints {
  /** Applicant ka mobile — row par application number na ho to isi se match. */
  mobile?: string;
}

/**
 * Application number se loan dhoondho.
 *
 * Franchise-customer detail product label se slug guess karta hai, jo hamesha
 * sahi nahi hota, isliye saare assigned products ek saath try hote hain. Poora
 * number match na ho to digits se compare hota hai (`LOAN000096` vs `96`), aur
 * jis row par number hi nahi hota wahan applicant ka mobile unique match deta
 * hai. Har step par sirf **ek** match hi liya jaata hai — do possible loans me
 * se koi bhi kholna galat record khol dega.
 */
export const findLoanByApplicationNo = async (
  applicationNo: string,
  slugs: string[],
  hints: LoanLookupHints = {}
): Promise<{ slug: string; loan: PersonalLoan } | null> => {
  const target = normalizeApplicationNo(applicationNo);
  const targetDigits = digitsOnly(target);
  const mobile = mobileDigits(hints.mobile);
  if (!target && !mobile) return null;

  const queue = [...new Set(slugs)].filter((slug) => SUPPORTED_LOAN_SLUGS.has(slug));
  const lists = await Promise.all(
    queue.map(async (slug) => {
      try {
        return { slug, loans: await getLoansBySlug(slug) };
      } catch {
        /* Ek product fail ho to baaki products decide karte rahein. */
        return { slug, loans: [] as PersonalLoan[] };
      }
    })
  );

  const single = (matches: { slug: string; loan: PersonalLoan }[]) =>
    matches.length === 1 ? matches[0] : null;
  const collect = (predicate: (loan: PersonalLoan) => boolean) =>
    lists.flatMap(({ slug, loans }) =>
      loans.filter(predicate).map((loan) => ({ slug, loan }))
    );

  if (target) {
    const exact = single(collect((loan) => loanApplicationNo(loan) === target));
    if (exact) return exact;
  }

  if (targetDigits) {
    const byDigits = single(
      collect((loan) => {
        const rowDigits = digitsOnly(loanApplicationNo(loan));
        return Boolean(rowDigits) && Number(rowDigits) === Number(targetDigits);
      })
    );
    if (byDigits) return byDigits;
  }

  if (!mobile) return null;
  return single(collect((loan) => mobileDigits(loan.mobile) === mobile));
};

const inFlightLoanLists = new Map<string, Promise<PersonalLoan[]>>();

/** Fetch all applications for a given loan type slug */
export const getLoansBySlug = (slug: string): Promise<PersonalLoan[]> => {
  const endpoint = SLUG_ENDPOINT[slug];
  if (!endpoint) return Promise.reject(new Error(`No endpoint mapped for slug: ${slug}`));

  const pending = inFlightLoanLists.get(endpoint);
  if (pending) return pending;

  const request = axiosInstance
    .get<Record<string, unknown>>(endpoint)
    .then((res) => extractList(res.data))
    .finally(() => {
      inFlightLoanLists.delete(endpoint);
    });

  inFlightLoanLists.set(endpoint, request);
  return request;
};

/** Fetch a single application by ID for a given loan type slug */
export const getLoanBySlug = async (slug: string, id: string): Promise<PersonalLoan> => {
  const endpoint = SLUG_ENDPOINT[slug];
  if (!endpoint) throw new Error(`No endpoint mapped for slug: ${slug}`);

  const path = `${endpoint}/${id}`;
  const res = await axiosInstance.get<Record<string, unknown>>(path);
  return extractItem(res.data, path);
};

/** Update an application's status using the shared admin status endpoint. */
export const updateLoanStatusBySlug = async (
  slug: string,
  id: string,
  status: LoanStatus,
  note = ""
): Promise<PersonalLoan> => {
  const endpoint = SLUG_ENDPOINT[slug];
  if (!endpoint) throw new Error(`No endpoint mapped for slug: ${slug}`);

  const path = `${endpoint}/${id}/status`;
  const res = await axiosInstance.patch<Record<string, unknown>>(path, { status, note });
  return extractItem(res.data, path);
};

/** Add an update/remark to a loan application. Any admin with access can add. */
export const addLoanUpdateBySlug = async (
  slug: string,
  id: string,
  text: string,
  suggestedStatus?: LoanStatus | ""
): Promise<PersonalLoan> => {
  const endpoint = SLUG_ENDPOINT[slug];
  if (!endpoint) throw new Error(`No endpoint mapped for slug: ${slug}`);

  const path = `${endpoint}/${id}/updates`;
  const res = await axiosInstance.post<Record<string, unknown>>(path, {
    text,
    ...(suggestedStatus ? { suggestedStatus } : {}),
  });
  return extractItem(res.data, path);
};

/** Delete a single application by ID for a given loan type slug */
export const deleteLoanBySlug = async (slug: string, id: string): Promise<void> => {
  const endpoint = SLUG_ENDPOINT[slug];
  if (!endpoint) throw new Error(`No endpoint mapped for slug: ${slug}`);

  const path = `${endpoint}/${id}`;
  await axiosInstance.delete(path);
};
