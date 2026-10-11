# Askly v2

**Real-time live polling, Q&A, quizzes, and reusable class rooms — with accounts.**

Askly is a multi-mode platform. A logged-in user can host a Q&A room for a talk, run a live
Kahoot-style quiz that anyone joins with a nickname, or build a library of reusable mentor rooms
organized into chapters (e.g. by course). Everything syncs live over Socket.io and persists in
MongoDB; closing and reopening a room keeps all its history intact.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Askly v2 Platform                               │
│                                                                              │
│  ┌──────────────┐     REST + Socket.io      ┌──────────────────────────────┐ │
│  │  Host        │ ◀══════════════════════▶  │ Express + Socket.io + Mongo  │ │
│  │  /host/:code │                           │                              │ │
│  └──────────────┘                           │  services/   (business logic)│ │
│  ┌──────────────┐                           │  sockets/    (thin handlers) │ │
│  │  Audience    │ ◀══════════════════════▶  │  middleware/ (auth/anti-spam)│ │
│  │  /r/:code    │                           └──────────────────────────────┘ │
│  └──────────────┘                                                            │
│  ┌──────────────┐                                                            │
│  │  Quiz Player │ ◀══════════════════════▶  Anonymous (nickname only)       │
│  │  /play/:code │                                                            │
│  └──────────────┘                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

Built as a **MERN monorepo** with npm workspaces. JavaScript, ES modules.

- **Frontend** (`client/`): React + Vite, React Router v6, Tailwind CSS, socket.io-client, recharts, qrcode.react, @react-oauth/google.
- **Backend** (`server/`): Node 20+, Express, Socket.io, Mongoose, zod, helmet, cors, express-rate-limit, bcryptjs, jsonwebtoken, google-auth-library.
- **Tests**: vitest + supertest + socket.io-client + mongodb-memory-server (54 tests).

---

## The three modes

| Mode | Who hosts | Who joins | Key features |
|---|---|---|---|
| **Speaker & Audience** | Account holder | Account holders | Live Q&A + polls + moderation + per-session analytics. Rooms can be closed, reopened with all history. |
| **Quiz Arena** | Account holder | **Anyone with a code + nickname (no account)** | Build quizzes; host live games; flat-point scoring; leaderboard; results saved. |
| **Mentor Room** | Account holder (mentor) | Account holders | Chapters → Rooms → Sessions. Permanent reusable course rooms with full session history. |

**Join rule:** entering a code on the landing page routes instantly to a quiz (no login) or redirects to sign in first (Q&A / Mentor), then drops the user into the room. The server decides by room type; the user never picks.

---

## Quick start

### Prerequisites

- **Node 20+**
- A **MongoDB** instance (local, Docker, or MongoDB Atlas). Tests don't need this — they use an in-memory MongoDB.

### 1. Install

```bash
npm install          # installs both workspaces from the repo root
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env     # optional; blank VITE_API_URL uses the dev proxy
```

Set `MONGODB_URI` and `JWT_SECRET` in `server/.env`:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/askly
JWT_SECRET=<at-least-32-random-characters>
```

Generate a strong secret: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

### 3. Run (both apps together)

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:4000 (`GET /health` for a quick check)

The Vite dev server proxies `/api` and `/socket.io` to the server so the browser sees a single origin in development.

### Build for production

```bash
npm run build        # builds the client into client/dist
npm start            # starts the server
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
| `PORT` | `4000` | HTTP / Socket.io port |
| `MONGODB_URI` | — | **Required.** Mongo connection string (server fails fast if missing in production) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS / Socket.io origin |
| `JWT_SECRET` | — | **Required, 32+ chars.** Signs JWTs (server fails fast if missing/short) |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `GOOGLE_CLIENT_ID` | optional | Google OAuth client ID — feature disabled if unset |
| `BCRYPT_ROUNDS` | `10` | bcrypt password hashing cost |
| `QUIZ_POINTS_PER_CORRECT` | `100` | Flat points per correct quiz answer |
| `QUIZ_MAX_PLAYERS` | `200` | Maximum players per quiz game |
| `RL_AUTH_PER_15MIN` | `60` | Auth requests per IP per 15 minutes |
| `RL_LOGIN_FAILS_PER_15MIN` | `10` | Failed login attempts per email per 15 minutes |
| `RL_ROOM_CREATE_PER_HOUR` | `30` | Room creations per **user** per hour |
| `RL_QUESTIONS_PER_MIN` | `5` | Socket token bucket: questions / user / min |
| `RL_UPVOTES_PER_MIN` | `30` | Socket token bucket: upvotes / user / min |
| `RL_VOTES_PER_MIN` | `20` | Socket token bucket: votes / user / min |
| `RL_QUIZ_ANSWERS_PER_MIN` | `120` | Socket token bucket: quiz answers / player / min |
| `DUPLICATE_QUESTION_WINDOW_MS` | `30000` | Reject identical question text within this window |
| `MAX_SOCKETS_PER_IP_PER_ROOM` | `300` | Flood guard (raised for campus Wi-Fi) |
| `ANALYTICS_THROTTLE_MS` | `2000` | Minimum interval between `analytics:updated` pushes |

### Client (`client/.env`)

| Var | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | _(blank)_ | Server origin for REST + Socket.io. Blank = use the dev proxy. In production set to your server URL. |
| `VITE_GOOGLE_CLIENT_ID` | optional | Shows the Google sign-in button. Must match `GOOGLE_CLIENT_ID` on the server. |

---

## Google Sign-In setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project.
2. **APIs & Services → OAuth consent screen**: choose External, fill in app name and your email, save.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**.
4. **Authorized JavaScript origins**: add `http://localhost:5173` and `https://askly-beryl.vercel.app` (plus any custom domain).
5. Copy the **Client ID** (no secret needed) into:
   - `GOOGLE_CLIENT_ID` on Render (server)
   - `VITE_GOOGLE_CLIENT_ID` on Vercel (client)
   Then redeploy both.

---

## Deployment checklist (Vercel + Render + MongoDB Atlas)

1. Set `JWT_SECRET` (32+ chars) on Render.
2. Set `GOOGLE_CLIENT_ID` on Render (optional but recommended).
3. Set `VITE_GOOGLE_CLIENT_ID` on Vercel.
4. Ensure `CLIENT_ORIGIN` on Render matches your Vercel URL.
5. Run `node server/scripts/purge-legacy-rooms.js` once against the production database to remove unreachable v1 data.
6. Redeploy both services.
7. Smoke test: sign up, create a Q&A room, create a mentor chapter/room, build a quiz and host a game with two browsers.

---

## REST API

All responses are JSON. Errors use `{ error: { code, message } }`.

### Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/signup` | none | `{ name, email, password }` → `{ token, user }` |
| `POST` | `/api/auth/login` | none | `{ email, password }` → `{ token, user }` |
| `POST` | `/api/auth/google` | none | `{ idToken }` → `{ token, user }` |
| `GET` | `/api/auth/me` | user | Current user |

### Rooms

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/rooms/:code` | none | Public meta `{ code, title, type, status }` (used by the join box to route by type) |
| `POST` | `/api/rooms` | user | `{ type: 'qa' \| 'mentor', title, chapterId? }` → room + `currentSession` |
| `GET` | `/api/rooms/mine` | user | Caller's rooms (query: `type`, `chapterId`, `status`) |
| `PATCH` | `/api/rooms/:code` | owner | `{ title?, chapterId?, settings? }` |
| `POST` | `/api/rooms/:code/open` | owner | Reopen: start a new Session, broadcast `room:updated` |
| `POST` | `/api/rooms/:code/close` | owner | `{ sessionName? }` — end session, close polls, write summary |
| `GET` | `/api/rooms/:code/sessions` | owner | Session list (newest first) with summaries |
| `GET` | `/api/rooms/:code/analytics` | owner | Query `sessionId?`; room-wide when omitted |

### Sessions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/sessions/:id` | owner | Full report: session, questions, polls, analytics / quiz leaderboard |
| `PATCH` | `/api/sessions/:id` | owner | `{ name }` rename |

### Chapters (Mentor mode)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/chapters` | user | Own chapters (query: `includeArchived`) |
| `POST` | `/api/chapters` | user | `{ name, description? }` |
| `PATCH` | `/api/chapters/:id` | owner | `{ name?, description?, archived? }` |

### Quizzes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/quizzes` | user | Own quizzes |
| `POST` | `/api/quizzes` | user | Create quiz |
| `GET` | `/api/quizzes/:id` | owner | Read (includes correct answers) |
| `PUT` | `/api/quizzes/:id` | owner | Replace |
| `DELETE` | `/api/quizzes/:id` | owner | Delete (past games keep their snapshots) |
| `POST` | `/api/quizzes/:id/host` | owner | Create a `quiz` Room + Session → `{ code }` |
| `GET` | `/api/quizzes/games` | user | Past games for the caller's quizzes |

### Health

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | none | `{ status, uptime, googleEnabled }` |

---

## Socket.io contract — Q&A and Mentor rooms

Every client→server event takes an ack callback returning `{ ok: true, data? }` or `{ ok: false, error: { code, message } }`. The server is the source of truth. On every (re)connect the client re-emits `room:join` to resync full state.

### Client → server

| Event | Who | Payload | Behavior |
|---|---|---|---|
| `room:join` | all | `{ code }` | Join socket room; `UNAUTHENTICATED` for qa/mentor without a token |
| `question:ask` | audience/host | `{ text }` | Validate + anti-spam, create, broadcast `question:new` |
| `question:upvote` | audience/host | `{ questionId }` | Toggle for this userId, broadcast `question:updated` |
| `poll:vote` | audience/host | `{ pollId, optionId }` | One vote per user (unique index), broadcast `poll:updated`; duplicate → `ALREADY_VOTED` |
| `question:answer` | **host** | `{ questionId, answered }` | Set answered flag, broadcast `question:updated` |
| `question:hide` | **host** | `{ questionId, hidden }` | Set hidden flag, broadcast `question:updated` |
| `poll:create` | **host** | `{ question, options }` | Create poll (2–6 options), broadcast `poll:new` |
| `poll:close` | **host** | `{ pollId }` | Close poll, broadcast `poll:updated` |
| `room:close` | **host** | `{ sessionName? }` | End session, close polls, broadcast `room:updated` |
| `room:open` | **host** | `{}` | Start new session, broadcast `room:updated` |

### Server → client

| Event | Payload |
|---|---|
| `room:state` (join ack) | `{ room, currentSessionId, sessions, questions, polls, myVotes, myUpvotes, isHost }` |
| `question:new` | Question (authorName hidden from audience if `showAuthorNames: 'host'`) |
| `question:updated` | Updated question (hidden=true removes it from audience view) |
| `poll:new` | Poll object |
| `poll:updated` | Poll with current option counts and status |
| `room:updated` | `{ status, currentSessionId, sessions }` |
| `session:renamed` | `{ id, name }` (host only) |
| `analytics:updated` | Analytics snapshot (host only, throttled to ≤ once / 2s) |
| `presence:updated` | `{ count }` live connected count |

---

## Socket.io contract — Quiz

### Client → server

| Event | Who | Payload | Behavior |
|---|---|---|---|
| `quiz:host:join` | owner | `{ code }` | Auth required; ack host snapshot |
| `quiz:join` | player | `{ code, nickname, clientId }` | Ack `{ player, state }`; rejoins with same clientId + nickname |
| `quiz:answer` | player | `{ questionId, optionId }` | Record answer; ack `{ received: true }` — no correctness until reveal |
| `quiz:start` | owner | `{}` | lobby → first question (min 1 player) |
| `quiz:skip` | owner | `{}` | End current question early → reveal |
| `quiz:next` | owner | `{}` | From leaderboard → next question or finish |
| `quiz:kick` | owner | `{ playerId }` | Remove player (they receive `KICKED`) |
| `quiz:end` | owner | `{}` | Abort game (Session marked `interrupted`) |

### Server → client

| Event | To | Payload |
|---|---|---|
| `quiz:state` | joiner | Current phase snapshot |
| `quiz:players` | all | `{ count, players? }` |
| `quiz:question` | all | `{ index, total, questionId, text, options, timeLimitSec, endsAt, serverNow }` |
| `quiz:answer-count` | host | `{ answered, total }` |
| `quiz:reveal` | all | `{ correctOptionId, distribution }` |
| `quiz:result` | that player | `{ correct, pointsEarned, totalScore, rank }` |
| `quiz:leaderboard` | all | `{ top, total }` |
| `quiz:finished` | all | `{ leaderboard }` |

---

## Error codes

`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `ROOM_NOT_FOUND`, `ROOM_CLOSED`,
`RATE_LIMITED`, `ALREADY_VOTED`, `POLL_CLOSED`, `DUPLICATE_QUESTION`, `NOT_FOUND`,
`EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `QUIZ_NOT_FOUND`, `NICKNAME_TAKEN`, `GAME_STARTED`,
`GAME_FULL`, `ALREADY_ANSWERED`, `TIME_UP`, `WRONG_PHASE`, `KICKED`.

---

## Authentication

- **JWT in localStorage** (not cookies). Client (Vercel) and server (Render) are on different domains; cookies would be third-party and blocked. See `DECISIONS.md` for the XSS trade-off.
- **Google sign-in** verifies the ID token server-side via `google-auth-library`. When a Google sign-in matches an existing password account by email, the `passwordHash` is removed (see `DECISIONS.md` for why).
- **Logout** is client-side (delete the token). `GET /api/auth/me` on boot restores the session.
- **Sockets** pass `auth: { token, clientId? }` in the handshake. Quiz players connect **without** a token.

---

## Anti-spam & abuse prevention

1. **DB unique index** on `(pollId, userId)` (Votes) and `(sessionId, playerId, questionId)` (PlayerAnswers) — hard guarantees.
2. **Socket token buckets** keyed by userId and IP.
3. **REST rate limiting** per user (room creation) and per IP (auth endpoints).
4. **Question hygiene** — trim, length 1–280, control-character stripping, duplicate-within-window guard.
5. **State guards** — writes rejected when room or poll is closed.
6. **Connection cap** — `MAX_SOCKETS_PER_IP_PER_ROOM` (default 300, a flood guard only for campus Wi-Fi).
7. **Auth limiters** — per-IP request limit and per-email failed-login limit.

---

## Testing

```bash
npm test
```

54 tests across (vitest + supertest + socket.io-client + mongodb-memory-server):

- **Unit** — join-code generation, token bucket, analytics aggregation, quiz scoring, reducers.
- **Auth** — signup/login/google, JWT verify, duplicate email, generic errors, `/me`.
- **Ownership** — owner-only REST routes and socket events reject non-owners and unauthenticated callers.
- **Lifecycle** — create, close with name, writes rejected after close, polls auto-closed, reopen keeps history, session rename.
- **Q&A sockets** — auth for qa rooms, userId-keyed upvote toggle, one-vote-per-user.
- **Quiz** — CRUD, hosting, scoring, player flow.
- **Chapters** — CRUD, unique name per owner, archive.
- **Analytics** — per-session and room-wide aggregation.
- **Client reducers** — `roomReducer` and `quizReducer` unit tests.

---

## Project structure

```
askly/
├─ package.json            # npm workspaces (client, server) + root scripts
├─ DECISIONS.md            # judgment calls / trade-offs
├─ client/                 # React + Vite SPA
│  └─ src/
│     ├─ pages/            # Landing, Login, Signup, SpeakerHub, MentorHub,
│     │                    # ChapterPage, History, SessionReport, QuizHub,
│     │                    # QuizBuilder, PlayJoin, QuizHost, QuizPlayer,
│     │                    # AudienceRoom, PresenterDashboard
│     ├─ components/       # auth/ hubs/ lifecycle/ quiz/ presenter/ audience/ shared/
│     ├─ hooks/            # useRoom, useQuiz, useAuth, useTheme, useToast
│     ├─ state/            # roomReducer, quizReducer
│     ├─ context/          # AuthContext
│     └─ socket/ api/ lib/ # socket client, REST wrapper, clientId, guards, routing
└─ server/                 # Express + Socket.io
   ├─ src/
   │  ├─ models/           # User, Chapter, Room, Session, Question, Poll,
   │  │                    # Vote, Quiz, Player, PlayerAnswer
   │  ├─ services/         # auth, user, chapter, session, room (lifecycle),
   │  │                    # question, poll, moderation, analytics,
   │  │                    # quizService, quizEngine, quizScoring
   │  ├─ sockets/          # thin handlers + broadcast layer + quiz broadcast + presence
   │  ├─ middleware/       # auth (requireAuth/optionalAuth), requireOwner,
   │  │                    # antiSpam (token bucket), validate, errorHandler
   │  ├─ routes/ controllers/ config/ utils/
   │  └─ scripts/          # purge-legacy-rooms.js
   └─ tests/               # 54 tests across 8 files
```

---

## Design notes

UI uses teal + indigo with status colors, Space Grotesk / DM Sans typography, and full
light/dark mode (class-based, token-driven CSS variables). Accessibility first: 44px+ touch
targets, visible focus rings, `prefers-reduced-motion` respected, `aria-live` toasts, keyboard-
navigable dialogs. Quiz answer tiles use a color-blind-safe palette with letter labels (A–D) and
distinct shape icons so meaning never depends on color alone.

---

## Known limitations

- **Quiz restart:** if the server restarts mid-game, the in-memory game state is lost. On boot, any still-active quiz session is marked `ended + interrupted` and its room closed. Players see the interrupted notice in session history.
- **Rate-limit buckets and the analytics throttle are in-memory (per process)**. Multi-instance deployments should move these to Redis alongside the Socket.io adapter.
- **clientId for quiz players is spoofable** — it is only a reconnect key, not a security boundary. Quiz session identity is nickname-based per-game, rate-limited by clientId + IP.
- **JWT in localStorage** trades cookie CSRF safety for XSS exposure. React escapes all output by default; `dangerouslySetInnerHTML` is never used. See `DECISIONS.md`.
