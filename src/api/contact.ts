import axiosInstance from "./axiosInstance";

/*
==========================================
Contact / enquiry API — /api/admin/contacts

Website ke contact form (full name, mobile, email, "interested in", message)
se aayi enquiries. Base URL axiosInstance me /api/admin hai, isliye yahan
sirf "/contacts" likha hai.
==========================================
*/

export const CONTACT_STATUSES = ["new", "in-progress", "closed"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export type ContactStatusFilter = ContactStatus | "all";

/** Backend enum ka wahi order/labels — filter dropdown isi se banta hai. */
export const CONTACT_TOPICS = [
  "Personal Loan",
  "Business Loan",
  "Home Loan",
  "Loan Against Property",
  "Balance Transfer",
  "Vehicle Loan",
  "Education Loan",
  "Credit Card",
  "Project Loan",
  "Commercial Purchase",
  "Working Capital",
  "Lease Rental Discounting",
  "OD CC Limit",
  "Loan Against Share",
  "Film Funding",
  "NPA",
  "Gold Loan",
  "FDI",
  "Franchisee",
  "Other",
] as const;

export interface ContactEnquiry {
  id: string;
  name: string;
  mobile: string;
  email: string;
  /** "I'm interested in" — product ka label. */
  topic: string;
  message: string;
  source: string;
  status: ContactStatus;
  /** Admin ka internal note — customer ko nahi dikhta. */
  note: string;
  handledByName: string;
  handledAt: string | null;
  receivedAt: string | null;
  updatedAt: string | null;
}

export interface ContactEnquiryStats {
  total: number;
  new: number;
  inProgress: number;
  closed: number;
}

export interface ContactEnquiryList {
  enquiries: ContactEnquiry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  stats: ContactEnquiryStats;
}

export interface ContactEnquiryFilters {
  status?: ContactStatusFilter;
  topic?: string;
  search?: string;
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

const asStatus = (value: unknown): ContactStatus =>
  value === "in-progress" || value === "closed" ? value : "new";

const asDate = (value: unknown): string | null => {
  const text = asText(value);
  return text ? text : null;
};

const toEnquiry = (value: unknown): ContactEnquiry => {
  const item = recordOf(value);
  return {
    id: asText(item.id ?? item._id),
    name: asText(item.name),
    mobile: asText(item.mobile),
    email: asText(item.email),
    topic: asText(item.topic) || "Other",
    message: asText(item.message),
    source: asText(item.source) || "website-contact",
    status: asStatus(item.status),
    note: asText(item.note),
    handledByName: asText(item.handledByName),
    handledAt: asDate(item.handledAt),
    receivedAt: asDate(item.receivedAt ?? item.createdAt),
    updatedAt: asDate(item.updatedAt),
  };
};

export const getContactEnquiries = async (
  filters: ContactEnquiryFilters = {}
): Promise<ContactEnquiryList> => {
  const { data } = await axiosInstance.get<Record<string, unknown>>("/contacts", {
    params: {
      ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
      ...(filters.topic && filters.topic !== "all" ? { topic: filters.topic } : {}),
      ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
      ...(filters.page ? { page: filters.page } : {}),
      ...(filters.limit ? { limit: filters.limit } : {}),
    },
  });

  const stats = recordOf(data.stats);

  return {
    enquiries: (Array.isArray(data.enquiries) ? data.enquiries : []).map(toEnquiry),
    total: asNumber(data.total),
    page: asNumber(data.page) || 1,
    limit: asNumber(data.limit) || 25,
    pages: Math.max(1, asNumber(data.pages) || 1),
    stats: {
      total: asNumber(stats.total),
      new: asNumber(stats.new),
      inProgress: asNumber(stats.inProgress),
      closed: asNumber(stats.closed),
    },
  };
};

export const updateContactEnquiry = async (
  id: string,
  payload: { status?: ContactStatus; note?: string }
): Promise<ContactEnquiry> => {
  const { data } = await axiosInstance.patch<{ enquiry?: unknown }>(
    `/contacts/${encodeURIComponent(id)}`,
    payload
  );
  return toEnquiry(data.enquiry);
};

export const deleteContactEnquiry = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/contacts/${encodeURIComponent(id)}`);
};
