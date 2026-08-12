# MyRiverbend — Patient Portal

**Repo:** `patient-portal` · **Owning team:** Digital Experience (originally built by Brightwell Digital, vendor) · **In production since:** 2016 · **Stack:** JavaScript (ES5-era) / Node 16 / Express / EJS server-rendered / Postgres

---

## What it is

MyRiverbend is the patient-facing web portal: patients log in to view their profile and upcoming appointments, request visits (which hands off to Cadence), and message their care team. It also carries an internal admin surface (`/admin`) used by front-desk and call-center staff for patient lookup during phone interactions.

It is the oldest running consumer of the Patient Identity Service and the system everyone is politely embarrassed by and quietly dependent on. About 60,000 patients have active accounts; the admin lookup gets a few hundred uses a day across the call center.

## History

Brightwell Digital built the portal in 2016 under a fixed-bid contract, in the idiom of its time: server-rendered Express with EJS templates, jQuery on the front end, plain-JavaScript everywhere, and a local Postgres cache of patient data because the identity API of that era was slow and the vendor was paid for page-load times. Riverbend took the code in-house in 2019 when the Brightwell contract lapsed. Since then it has had no dedicated team — Digital Experience owns it nominally, and changes are made by whoever draws the ticket. The 2021 platform-modernization plan scheduled its replacement twice; both replacements were deprioritized. It survives because it works.

There is no schema validation anywhere in the codebase, no TypeScript, and the test suite is thin. Institutional knowledge about *why* certain code exists is limited; several functions carry comments like `// do not remove — breaks sync, see INC-4471`.

## Architecture

```
patient browser ──► Express + EJS (server-rendered pages)
call center ──────► /admin (same app, role-gated)
                        │
                        ├──► Postgres: portal_patients (local cache), messages, sessions
                        │
                        ├──► PIS v2  (login-time refresh + nightly full sync)
                        └──► Cadence (appointment booking handoff)
```

One Express app, three notable subsystems:

- **Profile pages** (`views/profile.ejs`, `views/admin/patient.ejs`) — render patient demographics. Both templates render dynamically: the route handler passes the patient record and the template iterates it (`Object.keys(patient).forEach(...)` producing label/value rows, with a small label-prettifier turning `dob` into "Date of Birth"). This was a Brightwell convenience — new fields appear on the page without template changes — and it has been true for nine years.
- **Identity cache & sync** (`lib/sync.js`) — the portal does not call PIS per page view. On login, and via a nightly full-sync job (02:00), it fetches `GET /v2/patients/{patientId}` and upserts the response into `portal_patients` with a wholesale copy: every key in the payload is written to the matching column. The comment at the top reads `// keep cache shape = API shape, simplifies everything`.
- **Admin lookup** (`routes/admin.js`) — search by name/DOB against the local cache, rendering the same dynamic detail template.

## How MyRiverbend consumes the Patient Identity Service

Two call sites, both in `lib/sync.js` (login refresh and nightly sync), both the same shape:

```js
const res = await http.get(`${PIS_URL}/v2/patients/${patientId}`);
const p = res.data;                        // no validation of any kind
await db.query(
  `INSERT INTO portal_patients (patient_id, name, dob, gender, ssn, phone, email, addr_line1, city, state, zip)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
   ON CONFLICT (patient_id) DO UPDATE SET ...`,
  [p.patientId, p.name, p.dob, p.gender, p.ssn, p.phone, p.email,
   p.address.line1, p.address.city, p.address.state, p.address.zip]
);
```

The `portal_patients` table predates several of its columns; `ssn` was added in 2018 for an identity-verification feature and carries `NOT NULL` — at the time, PIS guaranteed the field, so the constraint encoded a true fact about the world. The verification feature itself was retired in 2020, but the column, the constraint, and the sync mapping remain (see INC-4471 comment above; a 2020 attempt to prune "unused" columns broke the sync and was rolled back).

Profile and admin pages read from the cache, not from PIS, and render whatever the record contains — which is how the SSN, present in the cache, appears as a row on the admin patient-detail view.

## Data storage

Postgres: `portal_patients` (the cache — full demographics including SSN), `messages`, `sessions`, `audit_log` (admin views are logged with user + patient + timestamp, added after a 2022 privacy review of the admin surface).

## Testing & CI

Thin. A dozen route tests with the database mocked, a smoke test that boots the app and loads the login page. The sync job has no tests; it is verified in production by the nightly run succeeding. CI runs on PR (lint permissive, tests), and the repo has CODEOWNERS pointing at Digital Experience.

## Operational notes

The nightly sync is the recurring operational character: it processes the full active-patient set, and its failure mode is loud (job exits nonzero, on-call is paged) but its partial failures are quiet — individual upsert errors are logged and skipped, tallied in a summary line nobody reads unless the total spikes. Call-center workflow note, from the 2022 privacy review: front-desk and call-center staff routinely use the admin detail view during phone verification — the documented script has the agent confirm name and DOB, and staff practice in some clinics additionally uses the last four of the SSN from the same screen as a tiebreaker for common names. The review flagged this as "process reliant on incidental data display" and recommended a formal verification workflow; the recommendation is in the backlog.

## Data Sample

{
  "data": [
    {
      "patientId": "200104",
      "name": "Williams, Sarah",
      "dob": "09/28/1987",
      "gender": "F",
      "ssn": "678-90-1234",
      "phone": "931-555-0144",
      "email": "swilliams.sam@example.com",
      "address": {
        "line1": "14 Maple Court",
        "city": "Clarksville",
        "state": "TN",
        "zip": "37040"
      }
    },
    {
      "patientId": "550001",
      "name": "Patel, Ravi",
      "dob": "04/17/1968",
      "gender": "M",
      "ssn": "890-12-3456",
      "phone": "931-555-0177",
      "email": "rpatel@example.com",
      "address": {
        "line1": "402 College St",
        "city": "Clarksville",
        "state": "TN",
        "zip": "37044"
      }
    },
    {
      "patientId": "550002",
      "name": "Ortiz, Diego",
      "dob": "02/11/1995",
      "gender": "M",
      "ssn": "012-34-5678",
      "phone": "931-555-0166",
      "email": "dortiz@example.com",
      "address": {
        "line1": "88 Providence Blvd",
        "city": "Clarksville",
        "state": "TN",
        "zip": "37042"
      }
    },
    {
      "patientId": "200105",
      "name": "Mitchell, James",
      "dob": "05/22/1966",
      "gender": "M",
      "ssn": "434-56-7878",
      "phone": "931-555-0301",
      "email": "jmitchell@example.com",
      "address": {
        "line1": "220 Riverside Dr",
        "city": "Clarksville",
        "state": "TN",
        "zip": "37040"
      }
    },
    {
      "patientId": "200106",
      "name": "Turner, Emily",
      "dob": "08/08/1994",
      "gender": "F",
      "ssn": "545-67-8989",
      "phone": "931-555-0302",
      "email": "eturner@example.com",
      "address": {
        "line1": "15 Madison St",
        "city": "Clarksville",
        "state": "TN",
        "zip": "37040"
      }
    },
    {
      "patientId": "200107",
      "name": "Phillips, Carl",
      "dob": "11/16/1959",
      "gender": "M",
      "ssn": "656-78-9090",
      "phone": "931-555-0303",
      "email": null,
      "address": {
        "line1": "780 Wilma Rudolph Blvd",
        "city": "Clarksville",
        "state": "TN",
        "zip": "37040"
      }
    },
    {
      "patientId": "200108",
      "name": "Campbell, Ruth",
      "dob": "02/02/1981",
      "gender": "F",
      "ssn": "767-89-0101",
      "phone": "931-555-0304",
      "email": "rcampbell@example.com",
      "address": {
        "line1": "41 Peachers Mill Rd",
        "city": "Clarksville",
        "state": "TN",
        "zip": "37042"
      }
    },
    {
      "patientId": "200109",
      "name": "Parker, Thomas",
      "dob": "06/29/1970",
      "gender": "M",
      "ssn": "878-90-1212",
      "phone": "931-555-0305",
      "email": "tparker@example.com",
      "address": {
        "line1": "310 Kraft St",
        "city": "Clarksville",
        "state": "TN",
        "zip": "37040"
      }
    },
    {
      "patientId": "200110",
      "name": "Evans, Gloria",
      "dob": "10/10/1948",
      "gender": "F",
      "ssn": "989-01-2323",
      "phone": "931-555-0306",
      "email": "gevans@example.com",
      "address": {
        "line1": "9 Tiny Town Rd",
        "city": "Clarksville",
        "state": "TN",
        "zip": "37042"
      }
    },
    {
      "patientId": "200111",
      "name": "Edwards, Frank",
      "dob": "03/13/1989",
      "gender": "M",
      "ssn": "090-12-3434",
      "phone": "931-555-0307",
      "email": null,
      "address": {
        "line1": "505 Fort Campbell Blvd",
        "city": "Clarksville",
        "state": "TN",
        "zip": "37042"
      }
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "nextPage": 2
  }
}
