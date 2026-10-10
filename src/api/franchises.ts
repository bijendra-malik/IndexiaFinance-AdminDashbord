import axiosInstance from "./axiosInstance";
import { getApiErrorMessage } from "../utils/apiError";

export { getApiErrorMessage };

export interface Franchise {
  _id: string;
  franchiseId?: string;
  name?: string;
  fullName?: string;
  businessName?: string;
  contactPerson?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  city?: string;
  state?: string;
  continent?: string;
  country?: string;
  status?: string;
  panNumber?: string;
  package?: string;
  isVerified?: boolean;
  isActive?: boolean;
  lastLogin?: string;
  franchiseAppliedAt?: string;
  franchiseApprovedAt?: string;
  franchiseRejectedAt?: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  address?: string;
  pincode?: string;
  experience?: string;
  loanCount?: number;
  credentials?: FranchiseCredentials | null;
}

export interface FranchiseCredentials {
  loginId?: string;
  password?: string;
  passwordIsMobile?: boolean;
  note?: string;
}

export interface FranchisePage {
  franchises: Franchise[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FranchiseLoan {
  _id: string;
  loanType: string;
  loanAmount: number;
  fullName?: string;
  mobile?: string;
  email?: string;
  status?: string;
  createdAt?: string;
}

export interface FranchiseLoanProduct {
  product: string;
  loans: FranchiseLoan[];
}

export interface FranchiseLoans {
  total: number;
  products: FranchiseLoanProduct[];
}

export interface FranchiseActionResult {
  franchise?: Franchise;
  credentials?: FranchiseCredentials | null;
}

const recordOf = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const firstArray = (...values: unknown[]): unknown[] | undefined =>
  values.find(Array.isArray) as unknown[] | undefined;

const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined;

const firstText = (...values: unknown[]): string | undefined =>
  values.map(optionalText).find((value) => value !== undefined && value.trim() !== "");

const toCredentials = (value: unknown): FranchiseCredentials => {
  const credential = recordOf(value);
  return {
    loginId: optionalText(credential.loginId),
    password: optionalText(credential.password),
    passwordIsMobile:
      typeof credential.passwordIsMobile === "boolean" ? credential.passwordIsMobile : undefined,
    note: optionalText(credential.note),
  };
};

const toFranchise = (value: unknown): Franchise => {
  const item = recordOf(value);
  const business = recordOf(item.businessDetails ?? item.businessInfo ?? item.business);
  const contact = recordOf(item.contactDetails ?? item.contactInfo ?? item.contact);
  const location = recordOf(item.location ?? item.addressDetails);
  const application = recordOf(item.franchiseApplication ?? item.application);
  const credentials = item.credentials === null
    ? null
    : item.credentials !== undefined
      ? toCredentials(item.credentials)
      : undefined;
  return {
    _id: optionalText(item._id ?? item.id) ?? "",
    franchiseId: firstText(item.franchiseId, item.loginId, recordOf(credentials).loginId),
    name: firstText(item.name, contact.name),
    fullName: firstText(item.fullName, contact.fullName),
    businessName: firstText(item.businessName, business.businessName, business.name),
    contactPerson: firstText(item.contactPerson, contact.contactPerson, contact.name, contact.fullName),
    email: firstText(item.email, contact.email),
    mobile: firstText(item.mobile, item.mobileNumber, contact.mobile, contact.mobileNumber),
    phone: firstText(item.phone, item.phoneNumber, contact.phone, contact.phoneNumber),
    city: firstText(item.city, location.city),
    state: firstText(item.state, location.state),
    continent: firstText(item.continent, location.continent),
    country: firstText(item.country, location.country),
    status: firstText(item.franchiseStatus, application.status, item.status),
    panNumber: firstText(item.panNumber, item.pan, business.panNumber, contact.panNumber),
    package: firstText(item.package, item.packageName, business.package, business.packageName),
    isVerified: typeof item.isVerified === "boolean" ? item.isVerified : undefined,
    isActive: typeof item.isActive === "boolean" ? item.isActive : undefined,
    lastLogin: optionalText(item.lastLogin),
    franchiseAppliedAt: firstText(item.franchiseAppliedAt, application.appliedAt),
    franchiseApprovedAt: firstText(item.franchiseApprovedAt, application.approvedAt),
    franchiseRejectedAt: firstText(item.franchiseRejectedAt, application.rejectedAt),
    rejectionReason: firstText(
      item.rejectionReason,
      item.rejectionNote,
      item.rejectedReason,
      application.rejectionReason,
      application.rejectionNote,
      application.reason
    ),
    createdAt: optionalText(item.createdAt),
    updatedAt: optionalText(item.updatedAt),
    address: firstText(item.address, location.address, location.fullAddress),
    pincode: firstText(item.pincode, item.pinCode, location.pincode, location.pinCode),
    experience: firstText(item.experience, business.experience),
    loanCount: typeof item.loanCount === "number" ? item.loanCount : undefined,
    credentials,
  };
};

const toActionResult = (response: unknown): FranchiseActionResult => {
  const root = recordOf(response);
  const nested = recordOf(root.data);
  const franchiseValue = root.franchise ?? nested.franchise;
  const result: FranchiseActionResult = {};
  if (franchiseValue !== undefined) result.franchise = toFranchise(franchiseValue);

  const franchiseRecord = recordOf(franchiseValue);
  const credentialsValue = Object.prototype.hasOwnProperty.call(root, "credentials")
    ? root.credentials
    : Object.prototype.hasOwnProperty.call(nested, "credentials")
      ? nested.credentials
      : franchiseRecord.credentials;
  if (credentialsValue === null) result.credentials = null;
  else if (credentialsValue !== undefined) result.credentials = toCredentials(credentialsValue);
  return result;
};

const extractFranchiseList = (response: unknown): unknown[] => {
  const root = recordOf(response);
  const nested = recordOf(root.data);
  const list = firstArray(root.franchises, root.data, root.results, nested.franchises, nested.results);
  if (!list) throw new Error("Unexpected response while loading franchise applications.");
  return list;
};

export const getFranchises = async (params: {
  status?: string;
  search?: string;
  page: number;
  limit: number;
}): Promise<FranchisePage> => {
  const res = await axiosInstance.get<unknown>("/franchises", { params });
  const root = recordOf(res.data);
  const nested = recordOf(root.data);
  const list = extractFranchiseList(res.data).map(toFranchise);
  const pagination = recordOf(root.pagination ?? nested.pagination);
  const total = Number(root.total ?? nested.total ?? pagination.total ?? list.length);
  const page = Number(root.page ?? nested.page ?? pagination.page ?? params.page);
  const limit = Number(root.limit ?? nested.limit ?? pagination.limit ?? params.limit);
  const totalPages = Number(
    root.totalPages ?? nested.totalPages ?? pagination.totalPages ?? Math.ceil(total / limit)
  );
  return { franchises: list, total, page, limit, totalPages };
};

export const getFranchise = async (id: string): Promise<Franchise> => {
  const res = await axiosInstance.get<unknown>(`/franchises/${encodeURIComponent(id)}`);
  const root = recordOf(res.data);
  const nested = recordOf(root.data);
  const item = root.franchise ?? nested.franchise ?? root.data ?? res.data;
  const franchise = toFranchise(item);
  if (!franchise._id) throw new Error("Unexpected response while loading franchise details.");
  const loanCount = root.loanCount ?? nested.loanCount ?? recordOf(item).loanCount;
  franchise.loanCount = typeof loanCount === "number" ? loanCount : undefined;
  const actionResult = toActionResult(res.data);
  if (Object.prototype.hasOwnProperty.call(actionResult, "credentials")) {
    franchise.credentials = actionResult.credentials;
  }
  return franchise;
};

const toLoan = (value: unknown, product?: string): FranchiseLoan => {
  const loan = recordOf(value);
  return {
    _id: optionalText(loan._id ?? loan.id) ?? "",
    loanType: optionalText(loan.loanType ?? loan.product ?? product) ?? "Loan",
    loanAmount: Number(loan.loanAmount ?? loan.amount ?? 0),
    fullName: optionalText(loan.fullName ?? loan.applicantName ?? loan.name),
    mobile: optionalText(loan.mobile),
    email: optionalText(loan.email),
    status: optionalText(loan.status),
    createdAt: optionalText(loan.createdAt),
  };
};

export const getFranchiseLoans = async (id: string): Promise<FranchiseLoans> => {
  const res = await axiosInstance.get<unknown>(`/franchises/${encodeURIComponent(id)}/loans`);
  const root = recordOf(res.data);
  const nested = recordOf(root.data);
  const list = firstArray(root.data, root.loans, root.applications, nested.data, nested.loans, nested.applications);
  if (!list) throw new Error("Unexpected response while loading franchise loan applications.");
  const products = list.map((value) => {
    const group = recordOf(value);
    const product = optionalText(group.product ?? group.loanType ?? group.name) ?? "Other";
    const groupLoans = firstArray(group.loans, group.applications, group.data);
    return {
      product,
      loans: groupLoans
        ? groupLoans.map((loan) => toLoan(loan, product))
        : [toLoan(value, product)],
    };
  });
  const flatLoans = products.flatMap((product) => product.loans);
  const groupedProducts = new Map<string, FranchiseLoan[]>();
  flatLoans.forEach((loan) => {
    const product = loan.loanType || "Other";
    groupedProducts.set(product, [...(groupedProducts.get(product) ?? []), loan]);
  });
  const grouped = [...groupedProducts].map(([product, loans]) => ({ product, loans }));
  return {
    total: Number(root.total ?? nested.total ?? flatLoans.length),
    products: grouped,
  };
};

export const approveFranchise = async (id: string): Promise<FranchiseActionResult> => {
  const res = await axiosInstance.patch<unknown>(`/franchises/${encodeURIComponent(id)}/approve`);
  return toActionResult(res.data);
};

export const rejectFranchise = async (id: string, note: string): Promise<void> => {
  await axiosInstance.patch(`/franchises/${encodeURIComponent(id)}/reject`, { note });
};

export const resetFranchisePassword = async (id: string): Promise<FranchiseActionResult> => {
  const res = await axiosInstance.patch<unknown>(
    `/franchises/${encodeURIComponent(id)}/reset-password`
  );
  return toActionResult(res.data);
};
