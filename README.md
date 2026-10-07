# SkyPlan

An interactive travel planner for airline staff and frequent flyers: explore
routes on a 3D globe or flat map, compare commercial fares with staff travel
fares (ID50, ID90, ZED), and check standby odds before you list.

## Getting started

```bash
npm install          # also copies MapLibre's worker into public/vendor
cp .env.example .env.local   # optional: add API keys
npm run dev
```

Open http://localhost:3000.

| Script              | What it does                    |
| ------------------- | ------------------------------- |
| `npm run dev`       | Dev server                      |
| `npm run build`     | Production build                |
| `npm test`          | Unit tests (Vitest)             |
| `npm run lint`      | ESLint                          |
| `npm run typecheck` | TypeScript                      |

## Data sources

Without API keys the app runs entirely on a built-in sample network (37
airports, 18 airlines) and a deterministic fare model, and says so wherever
those numbers appear.

| Data                         | With a key                       | Without                     |
| ---------------------------- | -------------------------------- | --------------------------- |
| Flight prices, price level   | SerpApi Google Flights engine    | Sample fare model           |
| Operating carriers per route | Aviationstack routes             | Sample network              |
| Load factors, standby odds   | Always modelled estimates        | Same                        |
| Cabin layouts                | Typical configuration per type   | Same                        |
| Basemap                      | Bundled Natural Earth countries (no tile server) |             |

## Staff travel engine

`src/lib/staff-travel/engine.ts`

- **ID90 / ID50**: 90% / 50% off the published base fare. Government taxes are
  never discounted; carrier surcharges are kept unless the rules waive them.
  ID90 is standby, ID50 confirmed.
- **ZED**: fixed fare per distance zone at Low / Medium / High service levels,
  chosen by cabin. The zone table is representative; replace it with your
  airline's agreement figures.
- **Standby priority** ranks own-airline staff by relationship ahead of
  interline (partner, then non-partner) travel.
- **Standby odds** turn estimated open seats, no-shows and the queue ahead of
  you into a probability, capped at 3–97% because the inputs are estimates.

All values live in `StaffTravelRules` so each employer's rules can be swapped in.

## API

| Route                             | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `GET /api/flights/search`         | Offers for `from`, `to`, `date`, `cabin`, filters |
| `GET /api/flights/destinations`   | Every nonstop / one-stop destination with fares   |
| `GET /api/flights/route-info`     | Carriers, aircraft, cabin seats, loads, standby   |
| `POST /api/staff-rates/calculate` | Commercial vs ID50 / ID90 / ZED breakdown         |

## Database

`supabase/migrations/` defines profiles, staff travel profiles, trips, flight
bookings, price alerts and saved routes, all owner-scoped with row level
security. Apply with `supabase db push` once a project is linked.

## Project layout

```
src/app            routes and API handlers
src/components     map/, flights/, layout/, ui/ (shadcn-style primitives)
src/lib            api/ (server data access), data/, pricing/, staff-travel/
supabase           database migrations
```
