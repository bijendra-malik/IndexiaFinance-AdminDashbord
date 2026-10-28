import axiosInstance from "./axiosInstance";
import { getLoanTypeLabel } from "../constants/loanTypes";
import { resourceToSlug } from "./personalLoans";

export { getApiErrorMessage } from "../utils/apiError";

/**
 * Which route a rejection came through:
 *   customer           -> customer ne khud apply kiya,
 *   franchise-customer -> franchise ne apne customer ke naam par file kiya,
 *   franchise          -> franchise ki khud ki registration/application.
 */
export type RejectionChannel = "customer" | "franchise-customer" | "franchise";

/** One rejected application, flattened across every loan product. */
export interface RejectedLoan {
  _id: string;
  /**
   * Backend URL segment (e.g. `npa-loans`) — detail link ke liye slug me map hota
   * hai. Credit-score rejections (jahan koi application submit nahi hui) me null.
   */
  resource?: string | null;
  productKey?: string | null;
  productLabel: string;
  status: string;
  applicationNo?: string | null;
  loanType?: string;
  loanAmount?: number;
  fullName?: string;
  mobile?: string;
  /** Channel: franchise id/`FRN…` code set hone par application franchise ne file ki hai. */
  franchise?: string | null;
  franchiseCode?: string | null;
  franchiseCustomer?: string | null;
  /** Reject reason — backend `adminNote` (customer-facing message). */
  rejectionReason: string;
  /** Kis type ka rejection hai — derived below, backend field par depend nahi karta. */
  channel: RejectionChannel;
  /** true = eligibility gate ne khud reject kiya (30 din baad delete), false = admin decision. */
  isAutoRejected: boolean;
  /** Admin decisions par — kis admin ne reject kiya (naam), rule rows par nahi. */
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  autoRejectedAt?: string | null;
  createdAt: string;
  employmentType?: string;
  companyType?: string;
  salaryReceivedAs?: string;
  creditScore?: number | null;
  [key: string]: unknown;
}

// ── Raw → typed mapping ──────────────────────────────────────────────────────
//
// `GET /rejected-loans` is a cross-product aggregate, so its rows mix the shapes
// of three different collections plus the loan documents' decision stamps. The
// backend is not consistent about any of it: `channel` is often absent, the
// reason lives in `adminNote` on applications but in `rejectionReason` /
// `rejectionNote` on franchises, and a franchise reference can arrive as an id
// string or as a populated object. Everything is normalised here so the screen
// only ever reads the interface above.

type RawRow = Record<string, unknown>;

const recordOf = (value: unknown): RawRow =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRow)
    : {};

/** First non-empty string (or finite number) among the candidates. */
const textOf = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const numberOf = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
};

/** Id of a reference that may be a plain id or a populated document. */
const idOf = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" || typeof value === "number") return textOf(value);
  const nested = recordOf(value);
  return textOf(nested._id, nested.id, nested.code, nested.franchiseId);
};

/** A decision maker may arrive as an id, a name string, or `{ name, email }`. */
const actorOf = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" || typeof value === "number") return textOf(value);
  const nested = recordOf(value);
  return textOf(nested.name, nested.fullName, nested.email);
};

const CHANNELS: readonly RejectionChannel[] = ["customer", "franchise-customer", "franchise"];

/**
 * The backend does not always send `channel`. The franchise references are the
 * authoritative signal, and `franchiseCustomer` wins over `franchise` because a
 * franchise-customer row carries both (the franchise is the referrer). Without
 * this derivation every row fell back to "customer", so the Franchise Customer
 * and Franchise tabs stayed empty and franchise rows lost their delete route.
 */
const toChannel = (row: RawRow): RejectionChannel => {
  const declared = textOf(row.channel, row.type, row.rejectionChannel)?.toLowerCase();
  if (declared && (CHANNELS as readonly string[]).includes(declared)) {
    return declared as RejectionChannel;
  }
  if (
    idOf(row.franchiseCustomer) ??
    textOf(row.franchiseCustomerId, row.franchiseCustomerCode, row.franchiseCustomerName)
  ) {
    return "franchise-customer";
  }
  if (idOf(row.franchise) ?? textOf(row.franchiseId, row.franchiseCode)) {
    return "franchise";
  }
  return "customer";
};

/** `adminNote` is what the status route stamps; franchises use the other names. */
const toReason = (row: RawRow): string => {
  const business = recordOf(row.businessDetails);
  return (
    textOf(
      row.rejectionReason,
      row.adminNote,
      row.rejectionNote,
      row.rejectReason,
      row.reason,
      row.note,
      business.adminNote,
      business.rejectionReason,
      business.rejectionNote
    ) ?? ""
  );
};

/** Rule rejections are flagged by the scheduler; accept every name it has used. */
const toAutoRejected = (row: RawRow): boolean => {
  for (const key of ["isAutoRejected", "autoRejected", "rejectedByRule", "ruleBased", "isRuleRejected"]) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1) return true;
    if (value === "false" || value === 0) return false;
  }
  return Boolean(textOf(row.autoRejectedAt, row.autoRejectedOn, row.ruleRejectedAt));
};

const toProductLabel = (row: RawRow): string => {
  const declared = textOf(row.productLabel, row.product, row.loanType, row.productName);
  if (declared) return declared;
  const slug = resourceToSlug(textOf(row.resource, row.resourceName, row.endpoint));
  return slug ? getLoanTypeLabel(slug) : "Loan application";
};

const toRejectedLoan = (value: unknown): RejectedLoan | null => {
  const row = recordOf(value);
  const id = textOf(row._id, row.id, row.applicationId, row.loanId);
  if (!id) return null;

  const employment = recordOf(row.employmentDetails);
  const channel = toChannel(row);
  const resource = textOf(row.resource, row.resourceName, row.endpoint);
  const productLabel = toProductLabel(row);

  // The raw row is spread first on purpose: every normalised field below must
  // win, otherwise a raw `channel: undefined` would overwrite the derived one.
  return {
    ...row,
    _id: id,
    resource: resource ?? null,
    productKey: textOf(row.productKey, row.productModel) ?? null,
    productLabel,
    status: textOf(row.status) ?? "Rejected",
    applicationNo: textOf(row.applicationNo, row.applicationNumber, row.appNo) ?? null,
    loanType: textOf(row.loanType, row.product) ?? productLabel,
    loanAmount: numberOf(row.loanAmount, row.amount, row.requestedAmount),
    fullName: textOf(row.fullName, row.applicantName, row.customerName, row.name),
    mobile: textOf(row.mobile, row.phone, row.mobileNumber, row.contactNumber),
    franchise: idOf(row.franchise) ?? textOf(row.franchiseId) ?? null,
    franchiseCode: textOf(row.franchiseCode, recordOf(row.franchise).franchiseId) ?? null,
    franchiseCustomer: idOf(row.franchiseCustomer) ?? textOf(row.franchiseCustomerId) ?? null,
    rejectionReason: toReason(row),
    channel,
    isAutoRejected: toAutoRejected(row),
    rejectedBy: actorOf(row.rejectedBy) ?? actorOf(row.approvedBy) ?? actorOf(row.decidedBy) ?? null,
    rejectedAt: textOf(row.rejectedAt, row.rejectedOn, row.decisionAt) ?? null,
    autoRejectedAt: textOf(row.autoRejectedAt, row.autoRejectedOn, row.ruleRejectedAt) ?? null,
    createdAt: textOf(row.createdAt, row.appliedAt, row.created_at) ?? "",
    employmentType: textOf(row.employmentType, employment.type),
    companyType: textOf(row.companyType, employment.companyType),
    salaryReceivedAs: textOf(row.salaryReceivedAs, employment.salaryReceivedAs),
    creditScore: numberOf(row.creditScore, row.credit_score) ?? null,
  };
};

/**
 * Accept every envelope this aggregate has been seen (or documented) in.
 * Returns `null` when nothing list-shaped is present, so the caller can tell
 * "no rejections" apart from "we do not understand this payload".
 */
const rowsFrom = (payload: unknown): unknown[] | null => {
  if (Array.isArray(payload)) return payload;
  const root = recordOf(payload);
  const nested = recordOf(root.data);
  return (
    [
      root.loans,
      root.rejectedLoans,
      root.rejections,
      root.data,
      root.results,
      nested.loans,
      nested.rejectedLoans,
      nested.rejections,
      nested.results,
    ].find(Array.isArray) ?? null
  );
};

/**
 * `GET /rejected-loans` — sabhi products ki rejections, newest first.
 *
 * Throws instead of returning an empty array when no list can be found: an
 * unexpected payload must not render as "No rejected applications yet", which
 * looks like a genuinely empty queue.
 */
export const getRejectedLoans = async (): Promise<RejectedLoan[]> => {
  const res = await axiosInstance.get<unknown>("/rejected-loans");
  const rows = rowsFrom(res.data);
  if (rows === null) {
    throw new Error("Unexpected response while loading rejected loans.");
  }
  return rows.map(toRejectedLoan).filter((loan): loan is RejectedLoan => loan !== null);
};
