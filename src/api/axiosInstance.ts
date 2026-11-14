import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/admin",
  headers: {
    "Content-Type": "application/json",
  },
});

/*
The session is per tab (sessionStorage) so two tabs can stay signed in as
different admins. `localStorage` is read only as a one-time migration fallback.
*/
const readToken = (): string | null => {
  try {
    return sessionStorage.getItem("admin_token") ?? localStorage.getItem("admin_token");
  } catch {
    return localStorage.getItem("admin_token");
  }
};

const clearToken = (): void => {
  try {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_user");
  } catch {
    /* ignore */
  }
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
};

// Attach admin token to every request if available
axiosInstance.interceptors.request.use(
  (config) => {
    const token = readToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/*
Admin tokens that are expired, invalid, or no longer authorised must sign out.

Har 403 par sign-out karna galat tha: sub admin ke paas kisi page ki permission
na ho to woh 403 khaata hai, session clear ho jaata hai aur wo wapas /login par
chala jaata hai — bahar se lagta hai "login hi nahi ho raha". Ab sirf session
invalid karne wale 403 (deactivated account / wrong token type) sign out karte
hain; permission denial page par error ban kar dikhta hai.
*/
const endsSession = (status?: number, message = ""): boolean => {
  if (status === 401) return true;
  if (status !== 403) return false;
  return /deactivated|invalid token|admin access only|unauthorized/i.test(message);
};

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = String(error.response?.data?.message ?? "");
    if (endsSession(error.response?.status, message)) {
      clearToken();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
