# Project structure review

## Current tree

```
src/
├─ api/                         # one module per backend resource, plain axios calls
│  ├─ axiosInstance.ts          # baseURL + auth header + global 401 handling
│  ├─ auth.ts                   # login, forgot/reset password, admin profile
│  ├─ customers.ts              # customer list/detail/delete + per-customer applications
│  ├─ dashboard.ts              # dashboard stats + product/recent aggregation
│  ├─ franchiseCustomers.ts     # franchise network customers + CIBIL stats
│  ├─ franchisePlans.ts         # investment plans CRUD + best-value pin
│  ├─ franchises.ts             # franchise list/detail/approve/reject/loans
│  ├─ locationMasters.ts        # continent → country → state → city → pincode
│  ├─ masters.ts                # generic master CRUD + banks + type lookup + bootstrap
│  └─ personalLoans.ts          # slug → endpoint map, list/detail per product
├─ assets/                      # brand images
│  ├─ logo-img.gif
│  └─ main-logo.gif
├─ components/
│  ├─ common/                   # ConfirmDialog, FilterSelect, Pagination, ProtectedRoute
│  ├─ layout/                   # AdminLayout (sidebar + topbar + nav groups)
│  └─ masters/                  # GroupSwitcher, NewMasterModal, ValueListEditor
├─ constants/
│  ├─ loanTypes.ts              # slug ↔ label registry (single source of truth)
│  └─ masterTypes.ts            # master type keys + location type set
├─ context/                     # AuthContext, ToastContext
├─ pages/
│  ├─ applications/             # LoanApplicationsList, LoanApplicationDetail
│  │  └─ (LoanApplicationDetail keeps its local useActiveSection hook)
│  ├─ customers/                # CustomersList
│  ├─ dashboard/
│  │  ├─ Dashboard.tsx
│  │  ├─ dashboardUtils.ts      # feature-local pure helpers
│  │  └─ components/            # DashboardCards, DashboardTables, ProductBars,
│  │                            # ProductExplorer, StackedBar, StatusDonut
│  ├─ franchises/               # one route per file (no route switching inside a file)
│  │  ├─ FranchiseList.tsx      # /franchises
│  │  ├─ FranchiseDetail.tsx    # /franchises/:id
│  │  ├─ FranchisePlans.tsx     # /franchise-plans (card grid + table toggle)
│  │  ├─ FranchiseCustomers.tsx # /franchise-customers, /stats, /:id
│  │  ├─ franchiseUtils.ts      # shared formatters/pills for this feature
│  │  └─ components/            # StatusPill (feature-only widgets)
│  ├─ masters/                  # MastersList, MasterDetail, LocationMasterAdmin
│  │                            # (LocationsManager.tsx exists but is unrouted — see nitpicks)
│  ├─ ForgotPassword.tsx
│  ├─ Login.tsx
│  └─ Profile.tsx
├─ utils/                       # apiError, masterValidation
├─ App.tsx                      # every route lives here, wrapped in ProtectedRoute
├─ main.tsx
├─ index.css
└─ vite-env.d.ts
docs/
├─ BACKEND_API.md               # backend contract
└─ PROJECT_STRUCTURE.md         # this file
```

## Verdict: the layout is sound

The layering is conventional and unchanged: `api` (transport) → `pages`
(screens) → `components` (reusable UI), with `constants` / `utils` / `context`
supporting them. Imports only flow downward, and each backend resource has
exactly one api module.

### Folder rules (follow these when adding code)

| Kind of code | Location | Existing example |
|---|---|---|
| Backend call | `src/api/<resource>.ts` | `api/franchises.ts` |
| Screen / route | `src/pages/<feature>/<Name>.tsx`, registered in `App.tsx` | `pages/franchises/FranchiseDetail.tsx` |
| Pure helpers used by one feature | `src/pages/<feature>/<feature>Utils.ts` | `franchiseUtils.ts`, `dashboardUtils.ts` |
| Widget used by one feature only | `src/pages/<feature>/components/` | `franchises/components/StatusPill.tsx` |
| Widget used by 2+ features | `src/components/common/` | `FilterSelect.tsx`, `Pagination.tsx` |
| Nav / shell | `src/components/layout/AdminLayout.tsx` | sidebar groups live here |
| Loan product | `constants/loanTypes.ts` + `SLUG_ENDPOINT` in `personalLoans.ts` | appears in sidebar/dashboard automatically |

Feature folders are allowed a `components/` subfolder **only** for widgets no
other feature imports — the moment a second feature needs it, move it to
`components/common/` (this is how `FilterSelect` and `Pagination` landed there).

### Fixed in this pass

| Issue | Resolution |
|---|---|
| `src/data/dummyApplications.ts` — fake dashboard data | Deleted; dashboard reads `api/dashboard.ts`. |
| Master lists hard-coded inside `MastersList.tsx` | Moved to `constants/masterTypes.ts`. |
| Franchise screens: one 610-line file served both list and detail routes | Split into `FranchiseList.tsx` + `FranchiseDetail.tsx`; the combined file is deleted. |
| Four top-level franchise nav entries with a hand-rolled active-state ternary | Grouped into one sidebar dropdown driven by `FRANCHISE_LINKS[].match`. |
| Every list page hand-rolled its own `<select>` and pagination | Shared `components/common/FilterSelect.tsx` + `Pagination.tsx`. |

### Remaining nitpicks (optional, low value)

1. **Auth pages sit at the root of `pages/`** while every other screen is in a
   feature folder. Leave it (true one-offs) or move to `pages/auth/`. Cosmetic.
2. **`pages/masters/LocationsManager.tsx` is unrouted** — nothing imports it;
   `/masters/locations` renders `LocationMasterAdmin.tsx`. Candidate for
   deletion after a quick check that it is not still wanted as a reference.
3. **`api/masters.ts` has four sections** (generic CRUD, type lookup, banks,
   bootstrap) and is ~245 lines. Split into `api/masters.ts` +
   `api/locations.ts` only if it grows again.
4. **No path alias.** `../../api/...` chains appear everywhere. Adding `@/*` →
   `src/*` in `tsconfig.app.json` + `vite.config.ts` would shorten imports.
5. **No tests.** No test runner is configured (`npm run` has dev/build/lint/preview
   only). `masterValidation.ts`, `dashboardUtils.ts` and `franchiseUtils.ts`
   are pure functions and are the cheapest first Vitest targets.
6. **One inline hook.** `useActiveSection` lives inside `LoanApplicationDetail.tsx`.
   Extract to `src/hooks/` only when a second screen needs it.

## Where to add things from here

| You are adding… | Put it in |
|---|---|
| A new backend call | `src/api/<resource>.ts` (add loan products to `SLUG_ENDPOINT`) |
| A new screen | `src/pages/<feature>/<Name>.tsx`, wired in `App.tsx` inside `ProtectedRoute` |
| A new franchise sub-screen | `src/pages/franchises/<Name>.tsx` — one route per file |
| A new sidebar group | `src/components/layout/AdminLayout.tsx` (`FRANCHISE_LINKS`-style array with a `match`) |
| A new loan product | `constants/loanTypes.ts` + `SLUG_ENDPOINT` |
| A shared widget | `src/components/common/` |
| A new master type | `src/constants/masterTypes.ts` (+ backend per `docs/BACKEND_API.md`) |
