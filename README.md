# EVE Healthcare Diagnostics Booking

A small MERN app for discovering diagnostic centres, booking a test, and completing a simulated payment. Payments are deliberately simulated; the application never charges a card or connects to a payment gateway.

## Features

- Email/password signup and login, bcrypt password hashing, JWT sessions.
- Authenticated centre search through the configured RapidAPI Local Business Data provider. Search results are shown from the provider response. Each result with a provider business ID is upserted into `Centre` by that external ID, and the MongoDB `_id` is returned for the card, centre detail, and booking flow; a five-minute in-process query cache avoids repeated provider requests.
- Firecrawl is called only after a user opens an individual centre with missing tests or stale hours. It can provide opening/closing hours and centre-published test names/prices, which are cached for 24 hours and used by booking validation.
- Booking amounts are calculated on the server from the cached centre test price and requested persons.
- Simulated `SUCCESS` and `FAILED` payments, booking state transitions, idempotency keys, and a signed-JWT payment webhook.
- Ownership checks, pagination, validation, request rate limits on authentication, Helmet, CORS, and structured server error logs.
- Responsive React dashboard with search, signup/login, booking, simulated checkout, profile/logout, and My Tests.

## Architecture

```text
client (React + Vite)
  └── /api requests with JWT ──> server (Express)
                                  ├── MongoDB / Mongoose
                                  ├── RapidAPI Local Business Data (search)
                                  └── Firecrawl (selected centre details only)
```

Provider keys stay in the server environment and are never sent to the browser. External providers are accessed only by their service modules. No provider data is scraped in bulk. Search uses RapidAPI's `/search` endpoint with `query`, `region=in`, `language=en`, and `limit=20`; the base URL and host remain configurable.

## Folder structure

```text
client/
  src/App.jsx             React dashboard and booking flows
  src/api.js              Axios client and JWT header
  src/styles.css          Responsive UI
  vite.config.js
server/
  config/                 Environment configuration
  controllers/            Request handlers and validation
  middleware/             JWT authentication and error handling
  models/                 User, Centre, Booking, Payment schemas
  routes/                 Express API routes
  services/               RapidAPI, Firecrawl, centre mapping, booking rules
  tests/                  Backend and client regression tests
  server.js               Express application and startup
  .env.example            Environment template
  .env                    Local secrets; ignored by Git
README.md
```

## Requirements and setup

- Node.js 20 or newer and npm.
- A MongoDB database.
- A RapidAPI subscription/key for Local Business Data and a Firecrawl API key for selected-centre enrichment.

1. Copy `server/.env.example` to `server/.env` and fill the values below. The local `.env` is ignored by Git.
2. From the repository root, install dependencies: `npm install`.
3. Start both apps: `npm run dev`.
4. Open <http://localhost:5173>. The API listens at <http://localhost:5000>.

### Environment variables

| Name | Purpose |
| --- | --- |
| `MONGODB_URI` | Mongoose connection string |
| `JWT_SECRET` | Signs user access tokens and signed webhook tokens |
| `RAPIDAPI_KEY` | RapidAPI subscription key, server-side only |
| `RAPIDAPI_HOST` | RapidAPI host header for the selected local business API |
| `RAPIDAPI_BASE_URL` | API origin, for example `https://local-business-data.p.rapidapi.com` |
| `FIRECRAWL_API_KEY` | Server-side selective centre-site extraction key |
| `PORT` | Express port; defaults to `5000` |
| `CLIENT_URL` | Allowed browser origin; defaults to `http://localhost:5173` |

The values supplied for local development are stored only in the ignored `server/.env`. Do not copy them into client code, documentation, logs, or Git.

## API endpoints

All responses are JSON. Errors have the shape `{ "error": { "code": "...", "message": "..." } }`. Authenticated routes require `Authorization: Bearer <JWT>`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | No | Create an account (`name`, `email`, `password`) |
| `POST` | `/api/auth/login` | No | Sign in (`email`, `password`) |
| `GET` | `/api/auth/me` | Yes | Current profile |
| `GET` | `/api/centres/search?q=Chennai` | Yes | Search RapidAPI and cache centre listings |
| `GET` | `/api/centres/:id` | Yes | Centre details; selectively enrich missing data |
| `POST` | `/api/bookings` | Yes | Reserve a test appointment |
| `GET` | `/api/bookings/my?page=1&limit=20` | Yes | Current user's paginated bookings |
| `GET` | `/api/bookings/:id` | Yes | Read an owned booking |
| `PATCH` | `/api/bookings/:id/cancel` | Yes | Cancel an owned pending booking |
| `POST` | `/api/payments` | Yes | Simulate payment (`SUCCESS` or `FAILED`) |
| `GET` | `/api/payments/:id` | Yes | Read an owned payment |
| `POST` | `/api/payments/webhook` | Signed JWT | Apply an idempotent payment event |
| `GET` | `/api/health` | No | Process and database readiness |

### Example requests

Signup:

```http
POST /api/auth/signup
Content-Type: application/json

{"name":"Asha Rao","email":"asha@example.com","password":"example-password"}
```

Search and create a booking using a returned `centreId` and `testId`:

```http
GET /api/centres/search?q=Chennai
Authorization: Bearer <JWT>
```

```http
POST /api/bookings
Authorization: Bearer <JWT>
Content-Type: application/json

{"centreId":"<centreId>","testId":"complete-blood-count","appointmentDate":"2027-01-18","appointmentTime":"10:30","persons":2}
```

The server obtains the price from the centre catalogue and computes `price × persons`; client-supplied amount, status, and user ID are ignored.

```http
POST /api/payments
Authorization: Bearer <JWT>
Content-Type: application/json

{"bookingId":"<bookingId>","result":"SUCCESS","idempotencyKey":"client-generated-unique-value"}
```

Webhook events use a short-lived JWT signed with `JWT_SECRET`, with audience `eve-payment-webhook`. Generate one locally from `server/` without printing the secret:

```sh
node -e "require('dotenv').config(); console.log(require('jsonwebtoken').sign({}, process.env.JWT_SECRET, {audience:'eve-payment-webhook', expiresIn:'5m'}))"
```

Then send `Authorization: Bearer <signed-token>` and `{ "eventId": "provider-event-123", "bookingId": "<bookingId>", "status": "SUCCESS" }`. The unique `eventId` index and pending-only state transition make retries safe. The simulation endpoint uses a client-generated `idempotencyKey` with a unique index.

## Data model

- **User** — name, normalized unique email, bcrypt password hash.
- **Centre** — provider ID, name, address, city, contact/site, optional GeoJSON point, operational hours/source, and embedded tests with price/source. Provider payload is excluded from normal reads.
- **Booking** — user and centre references plus immutable centre/test/price snapshots, date/time, persons, computed amount, and `PENDING | CONFIRMED | FAILED | CANCELLED` state.
- **Payment** — booking/user references, server-calculated amount, `SUCCESS | FAILED`, event ID or idempotency key, and source.

Indexes cover unique user email, provider ID, geo/text centre lookup, booking owner/date, and unique sparse webhook and simulation idempotency keys. Keeping test offers embedded in the centre makes a provider result and its offer prices a single catalogue document; booking snapshots preserve the amount and names used at booking time.

## Booking and payment assumptions

- Booking times use the centre's local 24-hour `HH:mm` clock. Appointments must be today or later, within opening hours, and for 1–10 people.
- A listing is bookable only when its returned or selectively extracted catalogue includes a test and numeric price. If providers do not publish this information, the UI asks the patient to contact the centre instead of inventing a price.
- A booking starts `PENDING`. A successful simulated payment or signed webhook changes it to `CONFIRMED`; a failed payment changes it to `FAILED`. Only pending bookings can be paid or cancelled.
- Webhook signing uses the already configured JWT secret and a dedicated audience, avoiding a separate credential. In a production service this would normally use an independently rotated webhook signing key.
- Provider query cache is process-local for five minutes; scraped details are cached in MongoDB for 24 hours. MongoDB is the source for persisted centre and booking data.
- External business listings are discovery data, not a guarantee of affiliation, appointment availability, or price. Confirm details with the centre where its site does not provide them.

## Tests

From the root, run `npm test`. The automated suite is database-independent and covers protected routes, search validation, provider result normalization and upsert-by-provider-ID behavior, missing/malformed centre IDs, selected-test and Mongo `_id` payload mapping, amount calculation, appointment time/date/person limits, legal payment state transitions, and webhook authentication. During implementation, the live RapidAPI result → Mongo centre → modal payload → `PENDING` booking → successful simulated payment flow was also smoke-tested against the configured MongoDB; temporary rows were removed or restored afterward.

## Improvements with more time

- Use MongoDB transactions or an outbox for payment plus booking writes if deployed on a replica set, and add webhook replay/retention monitoring.
- Replace the in-process search cache with a shared cache when scaling horizontally.
- Add administrator-managed test catalogues and price verification workflows where centres do not publish prices.
- Add OpenAPI documentation, audit trails, provider circuit breakers, and appointment availability confirmation.
- Use separate production signing keys, secret rotation, refresh-token revocation, and stronger account protections.
