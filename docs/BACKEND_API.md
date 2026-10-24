# Backend API contract — Loan Portal Admin

Base URL (dev): `http://localhost:5000/api/admin`
The frontend reads it from `VITE_API_BASE_URL` (`src/api/axiosInstance.ts`).

## Conventions

| Concern | Convention |
|---|---|
| Auth | `Authorization: Bearer <token>` on every request except login/forgot-password. A `401` clears the session client-side and redirects to `/login`. |
| Success envelope | `{ "success": true, ... }` — the payload is keyed by resource (`customers`, `masters`, `master`, `loans`, …). |
| Error envelope | Non-2xx with `{ "success": false, "message": "Human readable reason" }`. The UI shows `message` verbatim, so keep it user-safe. |
| Dates | ISO-8601 UTC strings. |
| Money | Rupees as plain numbers (no paise), e.g. `250000`. |
| Status values | Loan applications use `"Submitted" \| "Pending" \| "Approved" \| "Rejected"`. |

> The frontend tolerates a few response shapes (e.g. `data` / `loans` / `applications`), but the shapes below are the ones to standardise on.

---

## 1. Auth — `/auth`

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/auth/login` | `{ email, password }` | `{ success, message, token, admin }` |
| `GET` | `/auth/profile` | — | `{ success, admin }` |
| `PUT` | `/auth/profile` | `{ name, email }` | `{ success, message, admin }` |
| `PUT` | `/auth/change-password` | `{ currentPassword, newPassword }` | `{ success, message }` |
| `POST` | `/auth/forgot-password` | `{ email }` | `{ success, message }` (sends OTP) |
| `POST` | `/auth/reset-password` | `{ email, otp, newPassword }` | `{ success, message }` |

`admin` = `{ _id, name, email, role, isActive, lastLogin, createdAt, updatedAt }`.

---

## 2. Dashboard — `/dashboard`  ⭐ NEW / recommended

The dashboard reads pre-aggregated loan metrics from this endpoint and makes
additional requests to `/customers`, `/franchises`, and
`/franchise-customers/stats`. Customer and franchise account totals/details
come from their respective account endpoints; franchise-customer totals are
separate and count customers referred through franchises. This keeps loan
statistics to one request instead of calling every product endpoint separately.

### `GET /dashboard/stats`

```jsonc
{
  "success": true,
  "stats": {
    "totalCustomers": 128,
    "totalFranchises": 7,          // new: franchise count straight from the API
    "totalApplications": 342,
    "submitted": 40,
    "pending": 120,
    "approved": 150,
    "rejected": 32,
    "requestedAmount": 187500000,
    "approvedAmount": 92500000,
    "approvalRate": 43.9,          // percent, 0–100, decided applications only
    "products": [
      {
        "resource": "personal-loans",   // URL segment, NOT the admin slug
        "label": "Personal loan",
        "total": 90,
        "Submitted": 5,                  // NOTE: capitalised status keys
        "Pending": 30,
        "Approved": 45,
        "Rejected": 10,
        "requestedAmount": 45000000,
        "approvedAmount": 22500000
      }
    ],
    "recent": [
      {
        "_id": "6ad33ae5c0c6d4799cf56f1d",
        "resource": "education-loans",
        "product": "Education loan",     // the display label
        "applicantName": "Sita",         // NOT fullName
        "mobile": "9876543210",
        "loanType": "Education Loan",
        "status": "Submitted",
        "loanAmount": 1000000,
        "createdAt": "2026-10-17T09:07:49.023Z"
      }
    ],
    "generatedAt": "2026-09-29T10:00:00.000Z"
  }
}
```

**Frontend normalisation.** The dashboard keeps reading the shapes above
capitalised/undetailed job-free: `src/api/dashboard.ts` converts `Submitted` /
`Pending` / `Approved` / `Rejected` to the lowercase `ProductStat` fields,
maps `resource` → the admin slug (`resourceToSlug`, e.g. `/vehicle-loans` →
`car-loan`), and turns `applicantName` / `product` into `fullName` / `label`.
New fields belong in that mapper, not in the components.

The dashboard uses the count from `GET /customers` for Customer-role accounts,
and the `total` field from the paginated `GET /franchises?page=1&limit=10`
response for Franchise-role accounts. The returned franchise page supplies
the latest franchise profiles; `/customers` supplies customer profiles. If an
account endpoint fails, loan statistics still render, the account table
reports the error, and the customer total falls back to `/dashboard/stats`.

The dashboard also reads `{ stats: { total, byFranchise } }` from
`GET /franchise-customers/stats`. This is a separate count for customers
registered through franchises, not a count of franchise login accounts. If
this endpoint fails, the loan dashboard remains available and the
franchise-customer KPI reports the error.

---

## 3. Customers — `/customers`

| Method | Path | Notes |
|---|---|---|
| `GET` | `/customers?search=&isActive=` | `{ success, customers: Customer[] }`. `search` matches name / email / mobile; `isActive` filters active accounts. |
| `GET` | `/customers/:id` | `{ success, customer }` |

Also live (all consumed by the admin Customers page):

| Method | Path | Notes |
|---|---|---|
| `DELETE` | `/customers/:id` | `404` unknown id; `409` while the customer still has `Submitted`/`Pending` applications (message includes the open count). Otherwise the account + its closed application archive are removed together. |
| `GET` | `/customers?page=&limit=&isActive=` | Server-side pagination + filters (`limit` capped at 100; omitted → full list, which is what the UI uses for client-side paging today). |
| `PATCH` | `/customers/:id/status` | `{ isActive: true\|false }` — activate / deactivate. |
| `GET` | `/customers/:id/applications` | Applications grouped per product → `{ success, customer, total, data: [{ product, count, applications }] }` (`product` is the model key, e.g. `personal`, not the URL resource). |

`Customer` = `{ _id, customerId, name, mobile, email, dob, panNumber,
continent, country, state, city, pincode, isVerified, isActive, role,
lastLogin, createdAt, updatedAt }`. The account document also carries the
**latest** credit fields (`creditScore`, `creditEligible`,
`creditScoreCheckedAt`, `creditEligibilityExpiresAt`) — the UI never shows
those as an application's score (see §4).

---

## 4. Loan applications

One REST resource per product. The frontend maps slugs to endpoints in
`SLUG_ENDPOINT` (`src/api/personalLoans.ts`).

| Product slug | Endpoint | Wired? |
|---|---|---|
| `personal-loan` | `/personal-loans` | ✅ |
| `business-loan` | `/business-loans` | ✅ |
| `home-loan` | `/home-loans` | ✅ |
| `loan-against-property` | `/loan-against-properties` | ✅ |
| `balance-transfer` | `/balance-transfers` | ✅ |
| `project-loan` | `/project-loans` | ✅ |
| `car-loan` | `/vehicle-loans` | ✅ |
| `education-loan` | `/education-loans` | ✅ |
| `credit-card` | `/credit-cards` | ✅ |
| `commercial-purchase` | `/commercial-purchases` | ✅ |
| `working-capital` | `/working-capitals` | ✅ |
| `lease-rental-discounting` | `/lease-rental-discountings` | ✅ |
| `odcc-limit` | `/od-cc-limits` | ✅ |
| `loan-against-share` | `/loan-against-shares` | ✅ |
| `npa-loan` | `/npa-loans` | ✅ |
| `gold-loan` | `/gold-loans` | ✅ |
| `fdi-loan` | `/fdi-loans` | ✅ |
| `film-funding` | `/film-fundings` | ✅ |

Every resource needs the same four routes:

```http
GET    /{resource}                # list — newest first, raw documents
GET    /{resource}/:id            # single application (all fields)
PATCH  /{resource}/:id/status     # { status, note? } — LIVE (admin actions use it)
DELETE /{resource}/:id            # LIVE — the application detail page has a delete action
```

All 18 resources above are registered in the backend's `RESOURCE_ROUTES`
registry, so every product gets the same four endpoints.

`DELETE` returns `{ "success": true }`, `404` for an unknown id. Deleting an
application removes the saved form details permanently (the admin confirms by
typing the last 8 characters of the application id).

List response: `{ "success": true, "loans": [ ...documents ] }`
Detail response: `{ "success": true, "loan": { ...document, user, status } }`

Each application document must snapshot the applicant's credit data at submission
using `creditScore` (number or `null`), `creditEligible` (boolean),
`creditScoreCheckedAt` (ISO timestamp or `null`), and
`creditEligibilityExpiresAt` (ISO timestamp or `null`). These fields represent
the values used for that specific application and must not be rewritten when the
customer's account score is checked or updated later. The application detail
screen reads only this snapshot; it does not substitute the customer's current
score. The customer profile screen also shows only per-application snapshots —
the account's latest score is never displayed as an application's score. For
older applications without a snapshot, the credit fields display as "Not
recorded for this application". The current eligibility threshold is 600:
scores of 600 or higher are eligible. The backend must use this same threshold
when creating the snapshot's `creditEligible` value.

**Eligibility window (current backend flow).** The customer now submits the
loan form first (held as a temporary draft), then enters a credit score for
that draft. A qualifying score (≥ 600) finalises the draft and starts a
**24-hour window**: `creditEligibilityExpiresAt = creditScoreCheckedAt + 24h`.
A score below 600 sets `creditEligibilityExpiresAt` to `null`. On the
application snapshot the UI renders that timestamp as **"Eligibility Valid
Until"**; when it is absent it falls back to "Not recorded…" (legacy
snapshot) or "Not applicable — below 600" (ineligible score).

**Recommended query parameters** (the UI already filters/paginates client-side;
moving it server-side keeps the payload small as volume grows):

```
GET /personal-loans?page=1&limit=10&status=Pending&search=rahul
    &from=2026-01-01&to=2026-09-29&sort=-createdAt
```

**Recommended list projection.** The list screen needs only
`_id, fullName, mobile, loanAmount, loanTenure, status, createdAt` — returning
full documents for every row is wasteful. Support `?fields=` or return a slim
list document.

**Status transitions (implemented).** `PATCH /{resource}/:id/status` accepts
`Approved` / `Rejected` / `Pending` with an optional `note` (≤ 500 chars).
The transition matrix is enforced server-side:

| Current status | Allowed next |
|---|---|
| `Submitted` | `Pending`, `Approved`, `Rejected` |
| `Pending` | `Approved`, `Rejected` |
| `Approved` / `Rejected` | — (terminal) |

A no-op (same status) or an illegal transition returns `409` with
`{ success: false, message }`. Every decision stamps `approvedBy` (admin id),
`approvedAt` (or `rejectedAt`) and `adminNote` on the document — the detail
screen renders `adminNote` and the decision timestamp in its Timeline, and
locks its action buttons to the same matrix so the UI never produces a 409.

---

## 5. Masters — the configurable dropdown lists

A *master* is a named list that powers dropdowns in the public loan forms.
Document shape:

```ts
{
  _id: string;
  type: string;                              // stable key, e.g. "banks", "statesByCountry"
  label: string;                             // admin-facing name
  values: string[] | Record<string, string[]>; // flat list OR grouped map
  createdAt: string;
  updatedAt: string;
}
```

`kind` is derived: array → `"list"`, object → `"grouped"`.

### Generic CRUD

| Method | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/masters` | — | `{ success, masters: MasterSummary[] }` where summary = `{ _id, type, label, kind, count, createdAt, updatedAt }`. |
| `GET` | `/masters/:id` | — | `{ success, master }` |
| `POST` | `/masters` | `{ type, label, values? }` | `type` must be unique. |
| `PUT` | `/masters/:id` | `{ label }` | Rename the label only. |
| `PUT` | `/masters/:id/values` | `{ values }` | Replace the whole values payload. |
| `DELETE` | `/masters/:id` | — | Deletes master + values. |

### Type-addressed access

Admin URLs use the stable `type` key (e.g. `/masters/type/banks`) so bookmarks
survive a re-seed, but **the frontend resolves them itself** — it calls
`GET /masters`, finds the entry whose `type` matches, then calls
`GET /masters/:id`. **No `/masters/type/:type` route is required.** Adding one
later would only turn 2 requests into 1; it is optional.

### Banks  — including the custom-bank flow

| Method | Path | Body |
|---|---|---|
| `GET` | `/masters/banks` | → `{ success, data: string[] }` (`banks`/`values` also accepted) |
| `POST` | `/masters/banks` | `{ banks: string[] }` to initialise — or `{ value: "Kotak" }` to append **one custom bank** |
| `PUT` | `/masters/banks` | `{ values: string[] }` (admin Bank Details page saves the list) |
| `PUT` | `/masters/banks/:value` | `{ value }` (rename one entry) |
| `DELETE` | `/masters/banks/:value` | — |

**Custom bank add (important).** When a customer/admin picks a bank that is not in
the list yet — e.g. the loan form offers a self-typed "Other bank" — the backend
should append that value to the `banks` master through these routes
(`POST /masters/banks` with `{ value }`, or `PUT /masters/banks` with the merged
list). It then shows up in the admin **Bank Details** list automatically, so the
next applicant can pick it from the dropdown. Keep these routes even though the
admin page mostly uses the generic `/masters/:id/values` pair — they are the
fine-grained add/rename/delete surface for that flow, not dead code.

---

## 6. Legacy location contract (deprecated)

> The grouped-master location model below is no longer used by the admin
> Location Master page. Use the separate ID-based admin and public namespaces
> documented in [LOCATION_API.md](LOCATION_API.md).

The admin UI models this as four masters, which the generic CRUD above already
supports:

| Master `type` | Shape | Example |
|---|---|---|
| `countries` | flat list | `["India", "United Arab Emirates"]` |
| `statesByCountry` | grouped | `{ "India": ["Maharashtra", "Karnataka"] }` |
| `citiesByState` | grouped | `{ "Maharashtra": ["Mumbai", "Pune"] }` |
| `pincodesByCity` | grouped | `{ "Mumbai": ["400001", "400002"] }` |

The page creates any of these that are missing, and performs a **one-time
migration**: if `statesByCountry` is empty but the legacy flat `states` master
has values, they are imported under an `"India"` group.

### Page-wise endpoints (recommended shape)

The admin has exactly **two** master pages, and each can be served by one
page-shaped endpoint instead of the generic list/detail pair. The frontend can
talk to either shape — the generic routes below stay supported.

```jsonc
// 1) Bank Details page — GET /api/admin/masters/banksdetails
{
  "success": true,
  "data": {
    "id": "6880f1c2a4b8e91d2c3f4455",
    "type": "banks",
    "label": "Banks",
    "kind": "list",
    "values": ["HDFC Bank", "SBI", "ICICI Bank", "Axis Bank"],
    "updatedAt": "2026-09-29T10:00:00.000Z"
  }
}

// 2) Location page — GET /api/admin/masters/location
//    `object` data with the cascade nested two levels deep (country → state → city → pincode)
{
  "success": true,
  "data": {
    "countries": {
      "id": "6880f1c2a4b8e91d2c3f4466",
      "type": "countries",
      "label": "Countries",
      "values": ["India"]
    },
    "statesByCountry": {
      "id": "6880f1c2a4b8e91d2c3f4477",
      "type": "statesByCountry",
      "label": "States by Country",
      "values": {
        "India": ["Maharashtra", "Karnataka", "Gujarat"]
      }
    },
    "citiesByState": {
      "id": "6880f1c2a4b8e91d2c3f4488",
      "type": "citiesByState",
      "label": "Cities by State",
      "values": {
        "Maharashtra": ["Mumbai", "Pune"],
        "Karnataka": ["Bengaluru"],
        "Gujarat": ["Ahmedabad"]
      }
    },
    "pincodesByCity": {
      "id": "6880f1c2a4b8e91d2c3f4499",
      "type": "pincodesByCity",
      "label": "Pincodes by City",
      "values": {
        "Mumbai": ["400001", "400002"],
        "Pune": ["411001"],
        "Bengaluru": ["560001"],
        "Ahmedabad": ["380001"]
      }
    }
  }
}
```

Mutations can stay one-item-at-a-time (no full-map rewrite on every pincode):

```jsonc
// Banks
{ "POST":   "/api/admin/masters/banks"           , "body": { "value": "Kotak Bank" } }
{ "PUT":    "/api/admin/masters/banks/:value"    , "body": { "value": "Kotak Mahindra Bank" } }
{ "DELETE": "/api/admin/masters/banks/:value" }

// Location (same pattern at every level)
{ "POST":   "/api/admin/masters/location/countries"                          , "body": { "value": "United Arab Emirates" } }
{ "POST":   "/api/admin/masters/location/countries/:country/states"          , "body": { "value": "Dubai" } }
{ "POST":   "/api/admin/masters/location/states/:state/cities"               , "body": { "value": "Sharjah" } }
{ "POST":   "/api/admin/masters/location/cities/:city/pincodes"              , "body": { "value": "00000" } }
{ "PUT":    "/api/admin/masters/location/states/:state/cities/:city"         , "body": { "value": "Sharjah City" } }
{ "DELETE": "/api/admin/masters/location/countries/:country" }
{ "DELETE": "/api/admin/masters/location/states/:state" }
{ "DELETE": "/api/admin/masters/location/cities/:city" }
{ "DELETE": "/api/admin/masters/location/cities/:city/pincodes/:pincode" }

// What the admin UI calls today (already working, keep for compatibility):
{ "GET":    "/api/admin/masters"               }
{ "POST":   "/api/admin/masters"               , "body": { "type", "label", "values" } }
{ "GET":    "/api/admin/masters/:id"           }
{ "PUT":    "/api/admin/masters/:id"           , "body": { "label": "New Label" } }
{ "PUT":    "/api/admin/masters/:id/values"    , "body": { "values": ["…"] | { "group": ["…"] } }
{ "DELETE": "/api/admin/masters/:id"           }
```

> Renaming a city must move its pincodes to the new key, and deleting a
> country/state should cascade (or return `409` if you prefer an explicit
> `?force=true`). The admin UI already moves pincodes on rename and removes a
> country's whole state group on delete.

### Dedicated per-leaf endpoints (for scale + integrity)

The grouped-master approach rewrites the entire map on every add/delete, which
is fine for hundreds of rows but not for tens of thousands of pincodes. These
endpoints let each mutation touch one leaf:

```http
GET    /locations/tree                                  # whole cascade in one call
GET    /masters/countries
POST   /masters/countries                               { country }
DELETE /masters/countries/:country

GET    /masters/countries/:country/states
POST   /masters/countries/:country/states               { state }
PUT    /masters/countries/:country/states/:state        { state }   # rename
DELETE /masters/countries/:country/states/:state

GET    /masters/states/:state/cities
POST   /masters/states/:state/cities                    { city }
PUT    /masters/states/:state/cities/:city              { city }    # rename
DELETE /masters/states/:state/cities/:city

GET    /masters/states/:state/cities/:city/pincodes
POST   /masters/states/:state/cities/:city/pincodes     { pincode }
DELETE /masters/states/:state/cities/:city/pincodes/:pincode
```

Extra rules worth enforcing server-side:

- Pincode format: digits only (India: exactly 6).
- Renaming a city must move its pincodes to the new key (the UI already does this
  client-side; the backend should be authoritative).
- Deleting a city should cascade to its pincodes — or return `409` if you prefer
  an explicit force flag: `DELETE .../cities/:city?force=true`.
- `GET /locations/tree` response:

```jsonc
{
  "success": true,
  "tree": {
    "India": {
      "Maharashtra": { "Mumbai": ["400001", "400002"], "Pune": ["411001"] }
    }
  }
}
```

---

## 7. What is missing today, at a glance

| # | Gap | Status today |
|---|---|---|
| 1 | `/dashboard/stats` | ✅ Live — the dashboard loads it in one request (`src/api/dashboard.ts`). |
| 2 | Loan endpoint availability | ✅ All 18 resources (incl. `od-cc-limits`, `loan-against-shares`, `film-fundings`) are registered in `RESOURCE_ROUTES`. |
| 3 | Status-update route | ✅ `PATCH /{resource}/:id/status` live with the transition matrix, `note` and decision stamps. |
| 4 | Pagination/filter params on application lists | ⛔ Still open — every `GET /{resource}` returns the full collection (`?status=&search=&page=&limit=` + `total` recommended as volume grows). Customers already support `page`/`limit`/`isActive`. |
| 5 | `/masters/type/:type` | Optional — the frontend resolves types itself (list + detail). |
| 6 | Location API runtime verification | ⚠️ Depends on deployment — smoke-test the routes in [LOCATION_API.md](LOCATION_API.md). |
| 7 | Customer ↔ application link | ✅ `GET /customers/:id/applications` live and grouped per product. |
| 8 | Audit trail of status changes | ⛔ Only `approvedBy` + timestamps are stored; a separate change log (old → new status per admin) is still recommended. |

## Franchise management — `/franchises`

The admin franchise detail page reads `GET /franchises/:id` and
`GET /franchises/:id/loans`. Return the franchise profile in a `franchise`
object (or as `data.franchise`) and include the application rejection
explanation as `rejectionReason` (or `rejectionNote`) when rejected. The
frontend also accepts profile fields nested under `businessDetails`,
`contactDetails`, and `location`; prefer flat fields for a consistent API.

```jsonc
{
  "success": true,
  "franchise": {
    "_id": "…",
    "franchiseId": "…",
    "businessName": "…",
    "contactPerson": "…",
    "email": "…",
    "mobile": "…",
    "address": "…",
    "city": "…",
    "state": "…",
    "country": "…",
    "pincode": "…",
    "panNumber": "…",
    "package": "…",
    "status": "Rejected",
    "rejectionReason": "Please correct the submitted business address."
  }
}
```

Approval uses `PATCH /franchises/:id/approve`; password reset uses
`PATCH /franchises/:id/reset-password`; rejection uses
`PATCH /franchises/:id/reject` with `{ "note": "…" }`. The reject note is
persisted on the document as `businessDetails.adminNote`, so the detail payload
carries the reason there — the admin UI reads it as `rejectionReason`
(`src/api/franchises.ts`) along with `rejectionReason` / `rejectionNote`.
Return generated
credentials as `{ credentials: { loginId, password, note? } }` when they can
be shared. The admin UI is not the franchise sign-in page: after approval,
the partner uses those credentials on the separate franchise portal. If a
rejection reason or credentials are absent from the API response, the frontend
cannot safely infer them and reports that they were not provided.

## Franchise investment plans — `/franchise-plans`

The admin **Franchise Plans** page uses the admin base URL and JWT. The public
franchise page reads live plans from `GET /api/franchise/plans`.

| Method | Admin path | Body / behavior |
|---|---|---|
| `GET` | `/franchise-plans?active=true\|false` | Omit `active` for all plans; return `{ success, count, plans, bestValueCode, bestValueIsPinned }`. |
| `POST` | `/franchise-plans` | Create a plan. |
| `PATCH` | `/franchise-plans/:id` | Update only the supplied fields. |
| `PATCH` | `/franchise-plans/:id/best-value` | `{ isBestValue }`; only one plan may be pinned. |
| `PATCH` | `/franchise-plans/:id/status` | `{ isActive }`; reject deactivation of the last live plan. |
| `DELETE` | `/franchise-plans/:id` | Soft-delete/hide only; never physically remove the plan. |

Plan writes use `code`, `name`, `durationMonths`, `fee` (excluding GST),
`gstPercent`, `renewalFee` (number or `null`), `renewalNote`, `features`
(maximum 20 strings, 200 characters each), `sortOrder`, `isBestValue`, and
`isActive`. The API response must include its server-derived public values:
`validityLabel`, `gstAmount`, `totalWithGst`, `renewalText`, and
`effectiveMonthlyCost` (or `null`), plus `_id`, `createdAt`, `updatedAt`,
`createdBy`, and `updatedBy` when available. The frontend displays those
derived values and does not recalculate them.

```jsonc
{
  "success": true,
  "plan": {
    "_id": "…",
    "code": "3Y",
    "name": "3-Year Plan",
    "durationMonths": 36,
    "validityLabel": "3 Years",
    "fee": 249000,
    "gstPercent": 18,
    "gstAmount": 44820,
    "totalWithGst": 293820,
    "renewalFee": 3900,
    "renewalNote": "As applicable",
    "renewalText": "₹3,900",
    "features": ["Franchise access for 3 years"],
    "sortOrder": 1,
    "isBestValue": true,
    "isActive": true,
    "effectiveMonthlyCost": 6917,
    "createdAt": "2026-10-09T10:00:00.000Z",
    "updatedAt": "2026-10-09T10:00:00.000Z",
    "createdBy": { "name": "Admin" },
    "updatedBy": { "name": "Admin" }
  }
}
```

Editing `fee` changes the currently published price for new applicants only.
Applications already submitted must retain their `franchise.plan` price
snapshot. Return validation as `{ success: false, message, errors: [{ field,
message }] }`; use `409` for a duplicate code and `400` when the request would
leave no active plan. DELETE must hide a plan without erasing records referenced
by applications.
