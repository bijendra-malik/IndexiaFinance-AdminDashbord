import axiosInstance from "./axiosInstance";

export type LocationStatus = "active" | "inactive" | "coming_soon";
export type LocationResource = "continents" | "countries" | "states" | "cities" | "pincodes";

export interface LocationRecord {
  id: string;
  name: string;
  status: LocationStatus;
  prefix?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PincodeTableRow {
  id: string;
  pincode: string;
  prefix?: string;
  status: LocationStatus;
  city: string;
  state: string;
  country: string;
}

export interface PincodeTablePage {
  data: PincodeTableRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LocationCounts {
  totalContinents: number;
  totalCountries: number;
  totalStates: number;
  totalCities: number;
  totalPincodes: number;
}

const resourcePath = (resource: LocationResource) => `/masters/location/${resource}`;
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const unwrap = (body: unknown): Record<string, unknown> => {
  if (!isObject(body)) throw new Error("Unexpected location API response");
  const data = body.data;
  return isObject(data) ? data : body;
};

const normalizeRecord = (value: unknown, resource: LocationResource): LocationRecord => {
  if (!isObject(value)) throw new Error(`Unexpected ${resource} record`);
  const id = value.id ?? value._id;
  const rawName = resource === "pincodes" ? value.pincode ?? value.name : value.name;
  const status = value.status;
  if (typeof id !== "string" || typeof rawName !== "string") {
    throw new Error(`Unexpected ${resource} record shape`);
  }
  return {
    id,
    name: rawName,
    status: status === "inactive" || status === "coming_soon" ? status : "active",
    ...(typeof value.prefix === "string" ? { prefix: value.prefix } : {}),
    ...(typeof value.createdAt === "string" ? { createdAt: value.createdAt } : {}),
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {}),
  };
};

export const getLocationCounts = async (): Promise<LocationCounts> => {
  const response = await axiosInstance.get("/masters/location");
  return unwrap(response.data) as unknown as LocationCounts;
};

export const getLocationRecords = async (
  resource: LocationResource,
  parentId?: string,
  filters: { status?: LocationStatus; search?: string } = {}
): Promise<LocationRecord[]> => {
  const parentParam: Partial<Record<LocationResource, string>> = {
    countries: "continentId",
    states: "countryId",
    cities: "stateId",
    pincodes: "cityId",
  };
  const params: Record<string, string> = {
    limit: resource === "pincodes" ? "5000" : "all",
  };
  const parentKey = parentParam[resource];
  if (parentKey && parentId) params[parentKey] = parentId;
  if (filters.status) params.status = filters.status;
  if (filters.search) params.search = filters.search;

  const response = await axiosInstance.get(resourcePath(resource), { params });
  const body = isObject(response.data) ? response.data : {};
  const payload = body.data ?? body[resource];
  const records = Array.isArray(payload)
    ? payload
    : isObject(payload) && Array.isArray(payload.items)
      ? payload.items
      : isObject(payload) && Array.isArray(payload.records)
        ? payload.records
        : isObject(payload) && Array.isArray(payload[resource])
          ? payload[resource]
        : undefined;
  if (!records) throw new Error(`Unexpected response from ${resource} endpoint`);
  return records.map((record) => normalizeRecord(record, resource));
};

const joinedName = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (!isObject(value)) return "";
  const name = value.name ?? value.city ?? value.state ?? value.country;
  return typeof name === "string" ? name : "";
};

export const getPincodeTable = async (
  search: string,
  page: number,
  limit = 50
): Promise<PincodeTablePage> => {
  const response = await axiosInstance.get("/masters/location/pincodes/table", {
    params: { search: search.trim() || undefined, page, limit },
  });
  const body = isObject(response.data) ? response.data : {};
  const rows = Array.isArray(body.data) ? body.data : [];
  const data = rows.map((value): PincodeTableRow => {
    if (!isObject(value)) throw new Error("Unexpected pincode table row");
    const id = value.id ?? value._id;
    const pincode = value.pincode;
    if (typeof id !== "string" || typeof pincode !== "string") {
      throw new Error("Unexpected pincode table row shape");
    }
    const status = value.status;
    return {
      id,
      pincode,
      status: status === "inactive" || status === "coming_soon" ? status : "active",
      city: joinedName(value.city ?? value.cityName),
      state: joinedName(value.state ?? value.stateName),
      country: joinedName(value.country ?? value.countryName),
      ...(typeof value.prefix === "string" ? { prefix: value.prefix } : {}),
    };
  });
  const total = Number(body.total ?? body.count ?? data.length);
  const pageSize = Number(body.limit ?? limit);
  return {
    data,
    page: Number(body.page ?? page),
    limit: pageSize,
    total,
    totalPages: Number(body.totalPages ?? Math.ceil(total / pageSize)),
  };
};

export const createLocationRecord = async (
  resource: LocationResource,
  name: string,
  parentId?: string
): Promise<void> => {
  const parentField: Partial<Record<LocationResource, string>> = {
    countries: "continentId",
    states: "countryId",
    cities: "stateId",
    pincodes: "cityId",
  };
  const body: Record<string, string> = {
    [resource === "pincodes" ? "pincode" : "name"]: name,
    status: "active",
  };
  const parentKey = parentField[resource];
  if (parentKey && parentId) body[parentKey] = parentId;
  if (resource === "pincodes") body.prefix = name.slice(0, 3);
  await axiosInstance.post(resourcePath(resource), body);
};

export const updateLocationRecord = async (
  resource: LocationResource,
  id: string,
  changes: { name?: string; status?: LocationStatus }
): Promise<void> => {
  const body: Record<string, string> = {};
  if (changes.status) body.status = changes.status;
  if (changes.name !== undefined) {
    body[resource === "pincodes" ? "pincode" : "name"] = changes.name;
  }
  await axiosInstance.patch(`${resourcePath(resource)}/${encodeURIComponent(id)}`, body);
};

export const deleteLocationRecord = async (
  resource: LocationResource,
  id: string,
  options: { force?: boolean } = {}
): Promise<void> => {
  const params: Record<string, string> = {};
  if (options.force) params.force = "true";
  await axiosInstance.delete(`${resourcePath(resource)}/${encodeURIComponent(id)}`, { params });
};
