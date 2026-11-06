# BidVault

### Discover rare finds. Follow the action. Place your bid.

A live auction marketplace that brings item discovery, competitive bidding, and seller operations into one application. Buyers explore listings, follow auctions, and track their wins. Sellers manage inventory, schedule auctions, and monitor sales from a dedicated workspace.

Built with **Next.js 16 · React 19 · Express · PostgreSQL · Redis · Socket.IO**.

[Getting started](#getting-started) · [Architecture](#architecture) · [Explore the application](#explore-the-application)

## One marketplace, two workspaces

| For buyers | For sellers |
| --- | --- |
| Discover listings through category, condition, price, and text filters | Create listings with descriptions, categories, condition, and starting prices |
| Follow live prices through auction-specific Socket.IO rooms | Schedule auctions and manage listing inventory |
| Place quick or custom bids with immediate UI feedback | Review revenue, sales, and category performance |
| Save auctions to a watchlist and review bid history | Track orders and record shipment tracking numbers |
| Track won auctions, payment state, and shipping progress | Present a public storefront with active auctions |

The interface includes a dark theme, responsive listing grids, auction countdowns, loading states, and dedicated account areas. Backend services also provide category-affinity ranking and a trending feed; the current home and feed pages need a route correction to display those feeds.

## Architecture

```mermaid
flowchart LR
    Buyer[Buyer browser] --> Web[Next.js application]
    Seller[Seller browser] --> Web
    Web -->|REST requests| API[Express API]
    Web <-->|Auction rooms| WS[Socket.IO]
    API --> DB[(PostgreSQL)]
    API --> Redis[(Redis)]
    API -->|Bid broadcasts| WS
    Jobs[In-process cron jobs] --> DB
    Jobs -->|Auction ended events| WS
    API -.->|Optional payment integration| Stripe[Stripe / Connect]
    Stripe -.->|Signed webhooks| API
```

**PostgreSQL holds marketplace state.** Users, role-specific profiles, category interests, items, auctions, bids, orders, watchlists, and notifications are stored in relational tables. Listing search uses a generated PostgreSQL `tsvector` with a GIN index.

**Bids are serialized with database locks.** The bid service locks the auction row, checks auction status, seller ownership, the minimum increment, and the existing highest bidder, then updates the auction and inserts the bid inside a transaction. Accepted bids are broadcast to the auction room after commit. Retry handling and deadline enforcement have known gaps.

**Redis supports sessions and discovery.** It stores refresh-token records, caches the category tree, and keeps recent bid timestamps for velocity calculations. The running Socket.IO implementation currently uses in-memory rooms; the separate Redis-adapter implementation is not wired into the application entry point.

**Background jobs advance the auction lifecycle.** Scheduled auctions are checked every 10 seconds, live auctions close on a 5-second schedule, watcher reminders run every minute, and category affinity decays daily. These jobs execute inside the API process.

### Auction lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: Create item
    Draft --> Scheduled: Schedule auction
    Scheduled --> Live: Start job
    Live --> Ended: Close job
    Ended --> Sold: Winning bid creates an order
    Ended --> Unsold: No bids
```

`Draft`, `Sold`, and `Unsold` describe item outcomes; the auction table itself uses `scheduled`, `live`, and `ended`. Payment and shipping have separate order states.

## Getting started

### Prerequisites

- Node.js and npm. Local build and review checks were run with Node **22.23.2** and npm **10.9.8**.
- Docker with Compose for PostgreSQL 16 and Redis 7.
- Free local ports: `3000`, `5000`, `5433`, and `6380`.

### 1. Clone and install

```bash
git clone https://github.com/kashishdesai01/Live-Auction-and-Marketplace-Platform.git
cd Live-Auction-and-Marketplace-Platform
npm ci
```

### 2. Configure the API

```bash
cp server/.env.example server/.env
```

Set these values in `server/.env`:

```dotenv
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://auction:auction_dev@localhost:5433/auction_db
REDIS_URL=redis://localhost:6380
JWT_SECRET=replace_with_a_random_local_secret
JWT_REFRESH_SECRET=replace_with_a_different_random_local_secret
JWT_ACCESS_EXPIRES=15m
CORS_ORIGIN=http://localhost:3000
UPLOAD_PROVIDER=local
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Use independent random values for the two JWT secrets; `openssl rand -hex 32` generates a suitable local value. Keep payment keys empty for the basic demo.

### 3. Configure the web application

Create `client/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_WS_URL=http://localhost:5000
```

Set both URLs explicitly: the source defaults currently use port `5000` for HTTP and `5001` for sockets. Leave `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` unset for the basic demo.

### 4. Start infrastructure and prepare a fresh database

```bash
docker compose up -d --wait
npm run migrate
npm run seed
npm run seed:demo
```

**Use a disposable development database.** `seed:demo` truncates marketplace data before inserting synthetic users, listings, bids, orders, and notifications. The category seed also deletes existing categories and is intended here for a fresh database.

The demo generator creates 98 users, 86 items, and 56 auctions across live, scheduled, and ended states. Prices, bid counts, and other generated details vary between runs. Seeded imagery uses an external image service.

### 5. Run the application

```bash
npm run dev
```

- Web application: [localhost:3000](http://localhost:3000)
- API liveness endpoint: [localhost:5000/health](http://localhost:5000/health)

## Explore the application

1. Open **Browse** to inspect seeded inventory and search for a listing.
2. Sign in as the demo buyer and open a live auction.
3. Open the same auction in a second browser session to observe accepted bid broadcasts.
4. Add an auction to the watchlist and review **My Bids** and **My Wins**.
5. Sign in as the demo seller to inspect inventory, scheduled auctions, orders, and analytics.

Use seeded image URLs for a consistent demo: the new-listing form currently saves browser preview URLs rather than uploading files. Profile saving and the home/feed sections also have known integration issues.

## API at a glance

| Area | Representative endpoints |
| --- | --- |
| Authentication | `POST /api/auth/register/buyer`, `POST /api/auth/register/seller`, `POST /api/auth/login`, `POST /api/auth/refresh` |
| Discovery | `GET /api/categories`, `GET /api/browse`, `GET /api/buyer/feed` |
| Auctions | `GET /api/auctions/:id`, `POST /api/auctions/:id/bid` |
| Buyer workspace | `GET /api/buyer/watchlist`, `GET /api/buyer/bids`, `GET /api/buyer/wins`, `GET /api/buyer/notifications` |
| Seller workspace | `GET /api/seller/items`, `POST /api/seller/auctions`, `GET /api/seller/dashboard`, `GET /api/seller/analytics` |
| Fulfillment | `GET /api/seller/orders`, `PATCH /api/seller/orders/:id/ship` |
| Storefronts | `GET /api/sellers`, `GET /api/sellers/:id` |

Protected API requests use a bearer access token. Refresh tokens are stored in an HTTP-only cookie, with refresh-token records held in Redis. Routes enforce buyer or seller role membership; switching the active role is a separate account operation.

### Live event contract

| Direction | Event | Payload |
| --- | --- | --- |
| Client → server | `join_auction` | Auction ID string |
| Client → server | `leave_auction` | Auction ID string |
| Server → client | `bid_placed` | `auctionId`, `newPrice`, `bid` |
| Server → client | `auction_ended` | `winner_id`, `final_price`, `item_title` |

Bids are submitted through HTTP. Socket.IO distributes accepted bid updates to connected viewers.

## Payment integration

The repository includes buyer card setup through Stripe SetupIntents, seller onboarding through Stripe Connect, off-session PaymentIntent creation at auction close, manual order payment routes, and signature-verified payment webhooks. Destination charges calculate a 5% application fee when a seller destination account is included.

The manual payment route exposes `demo`, `sandbox`, and `vaulted` modes. **Demo mode simulates payment by changing the database state; it does not charge a card.** Payment mode is currently client-selectable, so this application must not be exposed as a real-money marketplace without additional server controls.

Stripe sandbox behavior, seller payouts, and hosted onboarding have not been verified in this review. The Connect callback also contains a hardcoded API port and frontend paths that need alignment before an integration walkthrough.

## Repository structure

```text
client/
  src/app/             Next.js pages for discovery, buyers, and sellers
  src/components/      Auction, account, notification, and UI components
  src/contexts/        Authentication state
  src/stores/          Live auction state and Socket.IO client
  src/lib/             API client and shared utilities
server/
  src/routes/          REST endpoints and Stripe webhook
  src/services/        Auction, identity, discovery, and analytics logic
  src/db/              SQL migrations and synthetic seed generators
  src/jobs/            Auction lifecycle and notification schedules
  src/sockets.js       Active Socket.IO server
  src/sockets/         Alternate socket implementation
  tests/               Concurrency, k6, and socket test scripts
docker-compose.yml     Local PostgreSQL and Redis
```

## Development checks

```bash
npm run lint --workspace=client
npx tsc --noEmit --project client/tsconfig.json
npm run build --workspace=client
```
