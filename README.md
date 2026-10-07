# Askly

**Real-time live polling and Q&A for events and sessions.**

A presenter spins up a room, shares a short join code (and QR), and the audience joins
anonymously — no logins, no accounts — to ask questions, upvote, and vote on polls. Everything
syncs live across every device over Socket.io and persists in MongoDB, so a refresh or a dropped
connection restores the full state.

```
┌──────────────┐        REST (create/join/analytics)        ┌───────────────────────────┐
│   Presenter  │ ─────────────────────────────────────────▶ │          Server           │
│  /host/:code │ ◀══════════════ Socket.io ════════════════▶ │  Express + Socket.io      │
└──────────────┘        (room:state, *:new/updated,          │                           │
                         presence, analytics)                │  ┌─────────────────────┐  │
┌──────────────┐                                             │  │ services/ (logic)   │  │
│   Audience   │ ─────────────── REST (join validate) ─────▶ │  │ sockets/  (thin)    │  │
│    /r/:code  │ ◀══════════════ Socket.io ════════════════▶ │  │ middleware/antiSpam │  │
└──────────────┘                                             │  └──────────┬──────────┘  │
                                                             └─────────────┼─────────────┘
                                                                           ▼
                                                                   ┌───────────────┐
                                                                   │    MongoDB    │
                                                                   │ Room/Question │
                                                                   │  Poll/Vote    │
                                                                   └───────────────┘
```

Built as a **MERN monorepo** with npm workspaces. JavaScript, ES modules.

- **Frontend** (`client/`): React + Vite, React Router, Tailwind CSS, socket.io-client, recharts,
  qrcode.react.
- **Backend** (`server/`): Node 20+, Express, Socket.io, Mongoose, zod, helmet, cors,
  express-rate-limit.
- **Tests**: vitest + supertest + socket.io-client + mongodb-memory-server.

---

## Quick start

### Prerequisites

- **Node 20+**
- A **MongoDB** instance for running the app (local `mongod`, Docker, or MongoDB Atlas).
  _Tests don't need this_ — they spin up an in-memory MongoDB automatically.

### 1. Install

```bash
npm install          # installs both workspaces from the repo root
```

### 2. Configure env

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env     # optional; blank VITE_API_URL uses the dev proxy
```

Set `MONGODB_URI` in `server/.env` (e.g. `mongodb://127.0.0.1:27017/askly` or your Atlas URI).

### 3. Run (both apps together)

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:4000 (`/health` for a health check)

The Vite dev server proxies `/api` and `/socket.io` to the server, so the browser sees a single
origin in development.

### Build for production

```bash
npm run build            # builds the client into client/dist
npm start                # starts the server (serve client/dist behind your own static host/CDN)
```

---

## Scripts (run from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Runs server + client together (via `concurrently`) |
| `npm run dev:server` / `npm run dev:client` | Run one side only |
| `npm run build` | Build the client |
| `npm start` | Start the server |
| `npm test` | Run all server tests (vitest, in-memory Mongo) |
| `npm run lint` | ESLint across the monorepo |
| `npm run format` | Prettier write |

---

## Environment variables

### Server (`server/.env`)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP/Socket.io port |
| `MONGODB_URI` | — | **Required.** Mongo connection string (server fails fast if missing) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS / Socket.io origin |
| `RL_QUESTIONS_PER_MIN` | `5` | Socket token bucket: questions / client / min |
| `RL_UPVOTES_PER_MIN` | `30` | Socket token bucket: upvotes / client / min |
| `RL_VOTES_PER_MIN` | `20` | Socket token bucket: votes / client / min |
| `RL_ROOM_CREATE_PER_HOUR` | `10` | REST limit: room creations / IP / hour |
| `DUPLICATE_QUESTION_WINDOW_MS` | `30000` | Reject identical question text within this window |
| `MAX_SOCKETS_PER_IP_PER_ROOM` | `5` | Connection cap per IP per room |
| `ANALYTICS_THROTTLE_MS` | `2000` | Minimum interval between `analytics:updated` pushes |

### Client (`client/.env`)

| Var | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | _(blank)_ | Server origin for REST + Socket.io. Blank = use the dev proxy (same origin). Set to your deployed server URL in production. |

---

## REST API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/rooms` | none (rate limited) | Create a room → `{ code, title, hostToken }` **(token returned once)** |
| `GET` | `/api/rooms/:code` | none | Room meta (`title`, `status`) for join validation |
| `GET` | `/api/rooms/:code/analytics` | host (Bearer token) | Full analytics snapshot |
| `GET` | `/health` | none | Health check |

Errors are `{ error: { code, message } }` with codes from the shared set below.

---

## Socket.io contract

Every client→server event takes an **ack callback** returning `{ ok: true, data? }` or
`{ ok: false, error: { code, message } }`. **The server is the source of truth** — clients render
what the server broadcasts and never compute counts. Each socket joins a Socket.io room named by
the room `code`; host sockets additionally join `${code}:host`. On every (re)connect the client
re-emits `room:join` to resync full state.

### Client → server

| Event | Who | Payload | Behavior |
|---|---|---|---|
| `room:join` | all | `{ code, clientId, hostToken? }` | Validate room, join socket room, set `isHost` if token valid, ack with `room:state` |
| `question:ask` | audience/host | `{ text }` | Validate + anti-spam, create, broadcast `question:new` |
| `question:upvote` | audience/host | `{ questionId }` | Atomic **toggle** for this clientId, broadcast `question:updated` |
| `poll:vote` | audience/host | `{ pollId, optionId }` | Insert Vote (unique index), atomically increment count, broadcast `poll:updated`; duplicate → `ALREADY_VOTED` |
| `question:answer` | **host** | `{ questionId, answered }` | Set answered flag, broadcast `question:updated` |
| `question:hide` | **host** | `{ questionId, hidden }` | Set hidden (accepts true/false), broadcast `question:updated` |
| `poll:create` | **host** | `{ question, options: string[] }` | Create poll (2–6 options), broadcast `poll:new` |
| `poll:close` | **host** | `{ pollId }` | Close poll, broadcast `poll:updated` |
| `room:close` | **host** | `{}` | Close room, broadcast `room:updated`; further writes → `ROOM_CLOSED` |

### Server → client

| Event | Payload |
|---|---|
| `room:state` (join ack) | `{ room, questions, polls, myVotes, myUpvotes, isHost }`. Audience gets non-hidden questions only; host gets all |
| `question:new` | question object (no `upvotes`/`authorId` for non-hosts; `upvoteCount` included) |
| `question:updated` | updated question (a `hidden:true` update makes audience clients remove it) |
| `poll:new` | poll object |
| `poll:updated` | poll with current option counts and status |
| `room:updated` | `{ status }` |
| `analytics:updated` | analytics snapshot — **host sockets only**, throttled to ≤ once / 2s |
| `presence:updated` | `{ count }` live connected audience count |

### Error codes

`VALIDATION_ERROR`, `ROOM_NOT_FOUND`, `ROOM_CLOSED`, `FORBIDDEN`, `RATE_LIMITED`, `ALREADY_VOTED`,
`POLL_CLOSED`, `DUPLICATE_QUESTION`, `NOT_FOUND`.

---

## Anti-spam & abuse prevention (layered)

1. **DB unique index** on `(pollId, clientId)` — the hard guarantee; Mongo `11000` → `ALREADY_VOTED`.
2. **Socket token buckets** keyed by both `clientId` and IP (questions/upvotes/votes per minute).
3. **REST rate limiting** on room creation (per IP).
4. **Question hygiene** — trim, length 1–280, control-character stripping, duplicate-within-window guard.
5. **State guards** — writes rejected when the room or poll is closed.
6. **Connection cap** — max N concurrent sockets per IP per room.

All limits are configurable in `server/src/config/env.js` (env-overridable, see table above).

> **Note:** `clientId` is spoofable and is only a dedupe key, not a security boundary. This design
> deters casual spam and accidental double-submits, not a determined attacker. See `DECISIONS.md`.

---

## Testing

```bash
npm test
```

Covers (vitest + supertest + socket.io-client + mongodb-memory-server):

- **Unit** — join-code generation (charset, collision retry), host-token hashing, token bucket,
  analytics aggregation.
- **Integration** — create room → join as audience/host (host flag only with a valid token);
  ask → broadcast; concurrent upvote toggling stays correct across 20 clients; duplicate poll vote
  → `ALREADY_VOTED` with unchanged counts; non-host host-only event → `FORBIDDEN`; closed room /
  closed poll reject writes; rate-limit burst → `RATE_LIMITED`; presence + connection cap.

27 tests, all green.

---

## Project structure

```
askly/
├─ package.json            # npm workspaces (client, server) + root scripts
├─ DECISIONS.md            # judgment calls / trade-offs
├─ client/                 # React + Vite SPA (Area A)
│  └─ src/
│     ├─ pages/            # Home, PresenterDashboard, AudienceRoom
│     ├─ components/       # shared / presenter / audience
│     ├─ hooks/            # useRoom (socket lifecycle), useTheme, useToast
│     ├─ state/            # roomReducer (applies server events)
│     ├─ socket/ api/ lib/ # socket client, REST wrapper, clientId/hostToken/theme
└─ server/                 # Express + Socket.io (Areas B & C)
   ├─ src/
   │  ├─ models/           # Room, Question, Poll, Vote
   │  ├─ services/         # room, question, poll, moderation, analytics (business logic)
   │  ├─ sockets/          # thin handlers + broadcast layer + presence
   │  ├─ middleware/       # validate, hostAuth, antiSpam (token bucket), errorHandler
   │  ├─ routes/ controllers/ config/ utils/
   └─ tests/               # unit + integration
```

---

## Design notes

UI direction came from a teal + indigo system with status colors, Space Grotesk / DM Sans
typography, and full light/dark mode (class-based, token-driven CSS variables). Accessibility is
first-class: 44px+ touch targets, visible focus rings, `prefers-reduced-motion` respected,
`aria-live` toasts that don't steal focus, keyboard-navigable dialogs, and charts paired with
value labels. The audience view is mobile-first with a sticky composer; the presenter dashboard is
projector-friendly with a giant code + QR.

## Scaling note

Single-process is fine for a session. All server→client emits funnel through small helpers in
`server/src/sockets/broadcast.js`, so a Redis adapter (`@socket.io/redis-adapter`) can be added
later for horizontal scaling without touching handlers or services.

## Known limitations

- `clientId` identity is spoofable (by design — see above).
- Rate-limit token buckets and the analytics throttle are in-memory (per process); multi-instance
  deployments would move these to Redis along with the Socket.io adapter.
- `client/dist` is a static build; wire it to your own static host/CDN (or add an Express static
  handler) for production.
