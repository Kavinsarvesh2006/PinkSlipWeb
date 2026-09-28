# PinkSlipWeb

React + TypeScript college academic portal, sharing its Supabase backend with PinkSlipReport Flutter. All operational data comes from college staff and the database; no mock accounts, fixed student roster, seeded sections, fabricated attendance or client-side fallback credentials remain.

## Run

```powershell
npm ci
Copy-Item .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the shared backend.
npm run dev
npm run typecheck
npm run build
```

The production website is generated in `dist/`. Never place a service-role key in Vite configuration.

## Features

Role-scoped administration; departments; configurable course lengths and classes; advisors and student accounts; CSV student import/export; daily whole-class attendance; approved leave locks; private letters and parent-call recordings; HOD leave decisions; student history; alerts; notices; editable timetables; calendar; annual progression; audit trail; responsive navigation and paginated tables.

Source lives in `src/portal/`. The `supabase` directory is identical to the Flutter counterpart. Apply migrations from only one project. Read `DEPLOYMENT.md` before connecting this rebuild to any existing installation: the retired React prototype used an incompatible schema.

```powershell
npm install --prefix supabase/tests
node supabase/tests/security.mjs .
```

The SQL suite uses synthetic identities in an isolated test database only. No test fixtures are imported by the application.

## Explicit boundaries

Daily attendance only; timetables do not record subject-period attendance. HOD approval is the implemented leave decision stage. No simulated AI, biometrics, automatic call recording, transcription, SMS or push. Public Google calendars can be imported after server secrets are configured. No real hosted accounts or data were modified during reconstruction. Live deployment and institution acceptance tests remain necessary before sale.
