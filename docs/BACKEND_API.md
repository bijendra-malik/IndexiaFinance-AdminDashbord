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

The dashboard reads pre-aggregated loan metrics from this endpoint and makes a
second request to `/franchise-customers/stats` for franchise-customer totals.
This keeps loan statistics to one request instead of calling every product
endpoint separately.

### `GET /dashboard/stats`

```jsonc
{
  "success": true,
  "stats": {
    "totalCustomers": 128,
    "totalApplications": 342,
    "submitted": 40,
    "pending": 120,
    "approved": 150,
    "rejected": 32,
    "requestedAmount": 187500000,
    "approvedAmount": 92500000,
    "approvalRate": 43.9,          // percent, 0–100
    "products": [
      {
        "slug": "personal-loan",
        "label": "Personal Loan",
        "total": 90,
        "submitted": 5,
        "pending": 30,
        "approved": 45,
        "rejected": 10,
        "requestedAmount": 45000000,
        "approvedAmount": 22500000
      }
    ],
    "recent": [ /* up to 10 latest applications, each the full loan document
                    plus { slug, label } */ ],
    "generatedAt": "2026-09-29T10:00:00.000Z"
  }
}
```

The dashboard also reads `{ stats: { total, byFranchise } }` from
`GET /franchise-customers/stats`. If that secondary request fails, the loan
dashboard remains available and the franchise-customer KPI reports the error.

---

## 3. Customers — `/customers`

| Method | Path | Notes |
|---|---|---|
| `GET` | `/customers?search=&isActive=` | `{ success, customers: Customer[] }`. `search` matches name / email / mobile; `isActive` filters active accounts. |
| `GET` | `/customers/:id` | `{ success, customer }` |

`Customer` = `{ _id, name, mobile, email, isVerified, isActive, role, lastLogin, createdAt, updatedAt }`.

Recommended additions so the dashboard can grow:

| Method | Path | Purpose |
|---|---|---|
| `DELETE` | `/customers/:id` | Delete a customer account. **Required now** — the admin Customers page ships a delete action (type-to-confirm) that calls this. Return `404` for an unknown id, `409` if the customer still has open applications. |
| `GET` | `/customers?page=&limit=&isActive=` | Server-side pagination + filters (list is unbounded today). |
| `PATCH` | `/customers/:id/status` | Activate / deactivate a customer. |
| `GET` | `/customers/:id/applications` | All loan applications belonging to one customer. |

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

Every resource needs the same four routes:

```http
GET    /{resource}                # list
GET    /{resource}/:id            # single application (all fields)
PATCH  /{resource}/:id/status     # { status: "Approved" }  ← needed for admin actions
DELETE /{resource}/:id            # required — the application detail page has a delete action
```

`DELETE` returns `{ "success": true }`, `404` for an unknown id. Deleting an
application removes the saved form details permanently (the admin confirms by
typing the last 8 characters of the application id).

List response: `{ "success": true, "loans": [ ...documents ] }`
Detail response: `{ "success": true, "loan": { ...document, user, status } }`

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

**Status transitions.** `PATCH /{resource}/:id/status` should accept
`Approved` / `Rejected` / `Pending`, store `approvedBy` / `approvedAt`, and
reject illegal transitions. Add a note field:
`PATCH /{resource}/:id/status` → `{ status, note? }`.

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

| # | Gap | Impact | Fix |
|---|---|---|---|
| 1 | No `/dashboard/stats` | 15 requests per dashboard load | Add endpoint in §2 |
| 2 | Loan endpoint availability depends on backend deployment | A mapped frontend route can still return `404` | Verify backend `od-cc-limits` and `loan-against-shares` routes |
| 3 | No status-update route | Admin can view but not act on an application | `PATCH /{resource}/:id/status` |
| 4 | No pagination/filter params | Full collections transferred on every list view | §4 query params |
| 5 | No `/masters/type/:type` | Type lookups cost 2 requests (list + detail) instead of 1 | §5, optional |
| 6 | Location API deployment has not been runtime-verified | Location Master requires the new record/status endpoints | Smoke-test the routes in [LOCATION_API.md](LOCATION_API.md) |
| 7 | No customer↔application link | Cannot see one customer's full portfolio | `GET /customers/:id/applications` |
