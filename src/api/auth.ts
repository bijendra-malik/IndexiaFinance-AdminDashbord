import axiosInstance from "./axiosInstance";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ApiAdmin {
  _id: string;
  name: string;
  email: string;
  role: string;
  /** Sign-in handle (`admin02`) when the backend provides one. */
  loginId?: string;
  /** Per-loan permission from the backend: `"all"` or the allowed slugs. */
  loanAccess?: "all" | string[];
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  admin: ApiAdmin;
}

export interface ProfileResponse {
  success: boolean;
  admin: ApiAdmin;
}

// ── API Calls ────────────────────────────────────────────────────────────────

/**
 * Admin login with email + password.
 * POST /admin/auth/login
 */
export const loginAdmin = async (
  payload: LoginPayload
): Promise<LoginResponse> => {
  const response = await axiosInstance.post<LoginResponse>(
    "/auth/login",
    payload
  );
  return response.data;
};

/**
 * Fetch authenticated admin profile (requires token in localStorage).
 * GET /admin/auth/profile
 */
export const fetchAdminProfile = async (): Promise<ProfileResponse> => {
  const response = await axiosInstance.get<ProfileResponse>("/auth/profile");
  return response.data;
};

/**
 * Forgot Password — Step 1: request an OTP by email.
 * POST /admin/auth/forgot-password
 */
export const requestPasswordResetOtp = async (
  email: string
): Promise<{ success: boolean; message: string }> => {
  const response = await axiosInstance.post("/auth/forgot-password", { email });
  return response.data;
};

/**
 * Forgot Password — Step 2: verify OTP and set a new password.
 * POST /admin/auth/reset-password
 */
export const resetPasswordWithOtp = async (payload: {
  email: string;
  otp: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> => {
  const response = await axiosInstance.post("/auth/reset-password", payload);
  return response.data;
};

/**
 * Change password while logged in.
 * PUT /admin/auth/change-password
 */
export const changeAdminPassword = async (payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> => {
  const response = await axiosInstance.put("/auth/change-password", payload);
  return response.data;
};

/**
 * Update the logged-in admin's name/email.
 * PUT /admin/auth/profile
 */
export const updateAdminProfile = async (payload: {
  name: string;
  email: string;
}): Promise<ApiAdmin> => {
  const response = await axiosInstance.put<{ success: boolean; message: string; admin: ApiAdmin }>(
    "/auth/profile",
    payload
  );
  return response.data.admin;
};
