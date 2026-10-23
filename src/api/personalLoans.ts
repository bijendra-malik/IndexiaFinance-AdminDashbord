import axiosInstance from "./axiosInstance";

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
  /** Rejection / review note saved with the last status change (max 500 chars). */
  adminNote?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;

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

/** Fetch all applications for a given loan type slug */
export const getLoansBySlug = async (slug: string): Promise<PersonalLoan[]> => {
  const endpoint = SLUG_ENDPOINT[slug];
  if (!endpoint) throw new Error(`No endpoint mapped for slug: ${slug}`);

  const res = await axiosInstance.get<Record<string, unknown>>(endpoint);
  if (import.meta.env.DEV) console.log(`[loans] GET ${endpoint}:`, res.data);
  return extractList(res.data);
};

/** Fetch a single application by ID for a given loan type slug */
export const getLoanBySlug = async (slug: string, id: string): Promise<PersonalLoan> => {
  const endpoint = SLUG_ENDPOINT[slug];
  if (!endpoint) throw new Error(`No endpoint mapped for slug: ${slug}`);

  const path = `${endpoint}/${id}`;
  const res = await axiosInstance.get<Record<string, unknown>>(path);
  if (import.meta.env.DEV) console.log(`[loans] GET ${path}:`, res.data);
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

/** Delete a single application by ID for a given loan type slug */
export const deleteLoanBySlug = async (slug: string, id: string): Promise<void> => {
  const endpoint = SLUG_ENDPOINT[slug];
  if (!endpoint) throw new Error(`No endpoint mapped for slug: ${slug}`);

  const path = `${endpoint}/${id}`;
  if (import.meta.env.DEV) console.log(`[loans] DELETE ${path}`);
  await axiosInstance.delete(path);
};

// ── Keep named exports for any direct usage ───────────────────────────────────

export const getPersonalLoans  = () => getLoansBySlug("personal-loan");
export const getBusinessLoans  = () => getLoansBySlug("business-loan");
export const getHomeLoans      = () => getLoansBySlug("home-loan");
export const getGoldLoans      = () => getLoansBySlug("gold-loan");
export const getFdiLoans       = () => getLoansBySlug("fdi-loan");

export const getPersonalLoan   = (id: string) => getLoanBySlug("personal-loan", id);
export const getBusinessLoan   = (id: string) => getLoanBySlug("business-loan", id);
export const getHomeLoan       = (id: string) => getLoanBySlug("home-loan", id);
export const getGoldLoan       = (id: string) => getLoanBySlug("gold-loan", id);
export const getFdiLoan        = (id: string) => getLoanBySlug("fdi-loan", id);

export const deletePersonalLoan = (id: string) => deleteLoanBySlug("personal-loan", id);
export const deleteGoldLoan     = (id: string) => deleteLoanBySlug("gold-loan", id);
export const deleteFdiLoan      = (id: string) => deleteLoanBySlug("fdi-loan", id);
