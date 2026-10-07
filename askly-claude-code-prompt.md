# Askly: Build Prompt for Claude Code

You are building **Askly**, a real-time live polling and Q&A app for events and sessions, from scratch, as a MERN monorepo. Read this whole document before writing any code. Follow the architecture, structure, and contracts exactly. If something is ambiguous, pick the simplest option consistent with this document, note the decision in `DECISIONS.md`, and keep moving.

---

## 1. Product

- A **presenter** creates a room and gets a short **join code** plus a secret **host token**.
- The **audience** joins with the code. **No login, no accounts.**
- Audience can **ask questions**, **upvote questions**, and **vote on polls** live.
- The presenter can **create/close polls**, **mark questions answered**, **hide questions**, **close the room**, and view **analytics**.
- **Socket.io** syncs everything in real time across all devices.
- **MongoDB** persists rooms, questions, polls, and votes. Refreshing or reconnecting must restore full state.

## 2. Stack

- **Frontend:** React (Vite), React Router, Tailwind CSS, socket.io-client, recharts, qrcode.react. JavaScript, not TypeScript.
- **Backend:** Node 20+, Express, Socket.io, Mongoose, zod (validation), express-rate-limit, helmet, cors, dotenv. ES modules.
- **Testing:** vitest (or jest), supertest, socket.io-client, mongodb-memory-server.
- **Tooling:** npm workspaces, ESLint + Prettier.

## 3. Ownership split (keep these as separate modules with clear boundaries)

The codebase is organized as three areas. Do not blur them.

- **Area A: Frontend.** Presenter dashboard and audience view (`client/`).
- **Area B: Core backend.** Express + Socket.io, room logic, host auth, real-time broadcast (`server/`: config, models, routes, services/room, sockets core).
- **Area C: Moderation, analytics, anti-spam.** Upvote logic, mark-answered/hide, analytics aggregation, vote-spam prevention (`server/src/services/moderation*`, `analytics*`, `middleware/antiSpam*`, and their socket handlers).

## 4. Repo structure

```
askly/
├─ package.json                 # npm workspaces: client, server
├─ README.md
├─ DECISIONS.md                 # log any judgment calls here
├─ .gitignore
├─ client/
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ tailwind.config.js
│  ├─ .env.example              # VITE_API_URL
│  └─ src/
│     ├─ main.jsx
│     ├─ App.jsx                # routes
│     ├─ api/http.js            # fetch wrapper for REST
│     ├─ socket/socket.js       # single socket.io client instance + helpers
│     ├─ lib/clientId.js        # anonymous clientId in localStorage
│     ├─ lib/hostToken.js       # store/read host token per room code
│     ├─ state/roomReducer.js   # reducer applying server events to state
│     ├─ hooks/useRoom.js       # connects, joins, dispatches server events
│     ├─ pages/
│     │  ├─ Home.jsx            # create room / enter join code
│     │  ├─ PresenterDashboard.jsx   # /host/:code
│     │  └─ AudienceRoom.jsx          # /r/:code
│     └─ components/
│        ├─ shared/             # Button, Modal, Toast, ConnectionBadge, EmptyState
│        ├─ presenter/          # JoinCodeCard (big code + QR), QuestionModerationList,
│        │                      #   PollBuilder, PollResultsCard, AnalyticsPanel
│        └─ audience/           # QuestionForm, QuestionList, QuestionItem, PollVoteCard
├─ server/
│  ├─ package.json
│  ├─ .env.example              # PORT, MONGODB_URI, CLIENT_ORIGIN
│  └─ src/
│     ├─ index.js               # boot: connect DB, start http + socket server
│     ├─ app.js                 # express app (helmet, cors, json, routes, error handler)
│     ├─ config/{env.js,db.js}
│     ├─ models/{Room.js,Question.js,Poll.js,Vote.js}
│     ├─ routes/{rooms.routes.js}
│     ├─ controllers/rooms.controller.js
│     ├─ services/
│     │  ├─ roomService.js
│     │  ├─ questionService.js
│     │  ├─ pollService.js
│     │  ├─ moderationService.js      # Area C
│     │  └─ analyticsService.js       # Area C
│     ├─ sockets/
│     │  ├─ index.js                  # io setup, auth, connection lifecycle
│     │  ├─ roomHandlers.js
│     │  ├─ questionHandlers.js
│     │  ├─ pollHandlers.js
│     │  └─ moderationHandlers.js     # Area C (host-only events)
│     ├─ middleware/
│     │  ├─ errorHandler.js
│     │  ├─ validate.js               # zod helper
│     │  ├─ hostAuth.js               # REST host token check
│     │  └─ antiSpam.js               # Area C: rate limiters (REST + socket)
│     └─ utils/{joinCode.js,hash.js,ack.js}
└─ server/tests/                # unit + integration tests
```

## 5. Data models (Mongoose)

All models use `timestamps: true`.

**Room**

- `code` String, unique, indexed (6 chars, uppercase, alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` with no ambiguous characters; retry on collision)
- `title` String (1 to 80 chars)
- `hostTokenHash` String (sha256 of the host token; **never store or return the raw token after creation**)
- `status` enum `open | closed`, default `open`

**Question**

- `roomCode` String, indexed
- `text` String (1 to 280, trimmed)
- `authorId` String (the anonymous clientId)
- `upvotes` [String] (array of clientIds)
- `upvoteCount` Number, default 0 (kept in sync atomically)
- `answered` Boolean, default false
- `hidden` Boolean, default false
- Index: `{ roomCode: 1, createdAt: -1 }`

**Poll**

- `roomCode` String, indexed
- `question` String (1 to 140)
- `options` [`{ id: String, text: String (1 to 80), votes: Number default 0 }`], 2 to 6 options, `id` generated server-side
- `status` enum `open | closed`, default `open`

**Vote**

- `pollId` ObjectId, `roomCode` String, `clientId` String, `optionId` String
- **Unique compound index `{ pollId: 1, clientId: 1 }`.** This is the core of vote-spam prevention. Duplicate votes must be impossible at the DB level.

## 6. Identity and auth

- **Audience identity:** the client generates a `clientId` (UUID v4) once and persists it in localStorage. It is sent in the socket handshake `auth` and in REST headers where needed. It is not a security boundary, only a dedupe key.
- **Presenter auth:** `POST /api/rooms` returns `{ code, title, hostToken }` **once**. Client stores `hostToken` in localStorage keyed by room code. The server stores only its hash.
- **Host privileges on sockets:** when a socket emits `room:join` with a `hostToken`, the server hashes it, compares to `room.hostTokenHash`, and sets `socket.data.isHost = true` on success. **Every host-only handler must check `socket.data.isHost` and reject otherwise.** Never trust a client-sent "isHost" flag.
- Host-only REST endpoints use `hostAuth` middleware reading `Authorization: Bearer <hostToken>`.

## 7. REST API (minimal; real-time goes over sockets)

| Method | Path                         | Auth                | Purpose                                                            |
| ------ | ---------------------------- | ------------------- | ------------------------------------------------------------------ |
| POST   | `/api/rooms`                 | none (rate limited) | Create room, returns `{ code, title, hostToken }`                  |
| GET    | `/api/rooms/:code`           | none                | Room meta (`title`, `status`) so the join page can validate a code |
| GET    | `/api/rooms/:code/analytics` | host                | Full analytics snapshot                                            |
| GET    | `/health`                    | none                | Health check                                                       |

## 8. Socket.io contract (this is the source of truth; implement exactly)

**Rules**

- Every client-to-server event uses an **ack callback** returning `{ ok: true, data? }` or `{ ok: false, error: { code, message } }`. Validate every payload with zod.
- **The server is the source of truth.** Clients never compute counts. They render what the server broadcasts.
- Each socket joins a Socket.io room named by the room `code`.
- On every (re)connect, the client re-emits `room:join` to resync full state.

**Client to server**

| Event             | Who           | Payload                           | Behavior                                                                                                                   |
| ----------------- | ------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `room:join`       | all           | `{ code, clientId, hostToken? }`  | Validates room, joins socket room, sets `isHost` if token valid, acks with `room:state`                                    |
| `question:ask`    | audience/host | `{ text }`                        | Validate, anti-spam checks, create, broadcast `question:new`                                                               |
| `question:upvote` | audience/host | `{ questionId }`                  | **Toggle** upvote atomically for this clientId, broadcast `question:updated`                                               |
| `poll:vote`       | audience/host | `{ pollId, optionId }`            | Insert Vote (unique index), atomically increment option count, broadcast `poll:updated`. Duplicate returns `ALREADY_VOTED` |
| `question:answer` | **host**      | `{ questionId, answered }`        | Set answered flag, broadcast `question:updated`                                                                            |
| `question:hide`   | **host**      | `{ questionId }`                  | Set hidden, broadcast `question:updated`                                                                                   |
| `poll:create`     | **host**      | `{ question, options: string[] }` | Create poll, broadcast `poll:new`                                                                                          |
| `poll:close`      | **host**      | `{ pollId }`                      | Close poll, broadcast `poll:updated`                                                                                       |
| `room:close`      | **host**      | `{}`                              | Set status closed, broadcast `room:updated`; further writes rejected with `ROOM_CLOSED`                                    |

**Server to client (broadcast to socket room)**

| Event                       | Payload                                                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `room:state` (via join ack) | `{ room: {code,title,status}, questions, polls, myVotes: { [pollId]: optionId }, myUpvotes: [questionId], isHost }`. Audience gets non-hidden questions only; host gets all |
| `question:new`              | question object (omit `upvotes` array and `authorId` for non-hosts; send `upvoteCount`)                                                                                     |
| `question:updated`          | updated question object (a `hidden: true` update means audience clients remove it)                                                                                          |
| `poll:new`                  | poll object                                                                                                                                                                 |
| `poll:updated`              | poll object with current option counts and status                                                                                                                           |
| `room:updated`              | `{ status }`                                                                                                                                                                |
| `analytics:updated`         | analytics snapshot, sent **only to host sockets** (`room:{code}:host` socket room), throttled to at most once per 2 seconds                                                 |
| `presence:updated`          | `{ count }` (live connected audience count)                                                                                                                                 |

**Error codes:** `VALIDATION_ERROR`, `ROOM_NOT_FOUND`, `ROOM_CLOSED`, `FORBIDDEN`, `RATE_LIMITED`, `ALREADY_VOTED`, `POLL_CLOSED`, `DUPLICATE_QUESTION`, `NOT_FOUND`.

## 9. Moderation (Area C)

- **Upvote:** atomic toggle with `findOneAndUpdate`. Upvote: `{ _id, upvotes: { $ne: clientId } }` then `$addToSet` + `$inc: { upvoteCount: 1 }`. Remove: `{ _id, upvotes: clientId }` then `$pull` + `$inc: { upvoteCount: -1 }`. No read-modify-write races.
- **Mark answered / hide:** host-only, as in the contract above.
- Sorting is done client-side: unanswered by `upvoteCount` desc then newest, answered pushed to the bottom (collapsible). Presenter sees hidden questions in a "Hidden" section with an unhide option (`question:hide` with `{ questionId, hidden: boolean }`; accept both true and false).

## 10. Vote-spam and abuse prevention (Area C)

Layered, in this order:

1. **DB unique index** on `(pollId, clientId)` is the hard guarantee. Catch Mongo duplicate key error `11000` and return `ALREADY_VOTED`.
2. **Socket rate limiting** with an in-memory token bucket keyed by `clientId` and by socket IP: e.g. max 5 questions/minute, 30 upvotes/minute, 20 votes/minute. Return `RATE_LIMITED`.
3. **REST rate limiting** with `express-rate-limit` (e.g. room creation: 10/hour/IP).
4. **Question hygiene:** trim, length 1 to 280, reject exact duplicates from the same room within 30 seconds (`DUPLICATE_QUESTION`), strip control characters.
5. **State guards:** reject writes if the room is closed or the poll is closed.
6. **Connection cap:** max N (e.g. 5) concurrent sockets per IP per room.
7. Document in `DECISIONS.md` that clientId is spoofable and that this design deters casual spam, not determined attackers.
   Make all limits configurable in `config/env.js` with sensible defaults.

## 11. Analytics (Area C)

`analyticsService.getSnapshot(code)` returns:

- `totals`: `{ questions, answered, hidden, upvotes, polls, votes, uniqueParticipants }` (distinct clientIds across questions, upvotes, and votes)
- `answerRate`: answered / visible questions
- `topQuestions`: top 5 by `upvoteCount`
- `questionsOverTime`: counts bucketed per minute (aggregation pipeline)
- `polls`: for each poll, `{ question, options:[{text,votes,percent}], totalVotes, participationRate }`
  Use MongoDB aggregation pipelines, not loading everything into memory. Expose via `GET /api/rooms/:code/analytics` and push `analytics:updated` to the host after relevant changes (throttled).

## 12. Frontend requirements (Area A)

**Routes:** `/` (Home), `/host/:code` (PresenterDashboard), `/r/:code` (AudienceRoom).

**Home:** two cards. "Create a room" (title input, then redirect to `/host/:code` after storing host token). "Join a room" (6-char code input, validated via `GET /api/rooms/:code`, then `/r/:code`). Auto-uppercase the code input.

**Presenter dashboard (`/host/:code`):**

- Header with room title, live audience count, connection badge, "Close room" button (with confirm).
- `JoinCodeCard`: giant join code, QR code of the audience URL, copy-link button. Must be readable on a projector (large, high contrast).
- Tabs or sections: **Questions** (moderation list with Answer / Hide buttons, upvote counts, sorted as in section 9), **Polls** (builder with 2 to 6 options, live results as bar charts, close button), **Analytics** (recharts: questions over time line, poll bars, totals tiles, top questions).
- If no valid host token is stored for the code, redirect to the audience view.

**Audience view (`/r/:code`):**

- **Mobile-first**, thumb-friendly. Sticky question input with character counter (280).
- Question list with upvote button (toggle, shows own state), answered badge, sorted live.
- Active polls shown prominently as cards with large tap targets. After voting, show live results and highlight own choice. Closed polls show final results.
- Friendly states: connecting, reconnecting, room closed, room not found, rate-limited (toast), already voted.

**State management:** a single `useRoom(code)` hook owns the socket lifecycle and a `roomReducer` that applies `room:state`, `question:new/updated`, `poll:new/updated`, `room:updated`, `presence:updated`, `analytics:updated`. No Redux. Optimistic UI only for the user's own upvote/vote toggles, reconciled by the server broadcast. Re-emit `room:join` on every `connect` event.

**Design:** clean, modern, accessible (labels, focus states, sufficient contrast, `prefers-reduced-motion` respected). Light and dark via Tailwind. Do not use localStorage for anything except `clientId` and host tokens.

## 13. Cross-cutting requirements

- **Security:** helmet, strict CORS to `CLIENT_ORIGIN`, zod validation on every REST and socket payload, no raw host token persisted server-side, never send `authorId` or `upvotes` arrays to non-hosts, escape/render text safely (React default; never `dangerouslySetInnerHTML`).
- **Config:** `.env.example` files for both packages; fail fast on missing `MONGODB_URI`.
- **Errors:** central Express error handler; socket handlers wrapped in a helper (`utils/ack.js`) that catches exceptions and acks `{ ok:false }` so a bad event never crashes the process.
- **Logging:** minimal structured logs for connections, room creation, and errors.
- **Scalability note:** single-process is fine, but keep the broadcast layer behind small functions so a Redis adapter can be added later. Mention this in `DECISIONS.md`.

## 14. Build plan (work in vertical slices; commit after each phase)

Before starting, post a brief plan, then execute phase by phase. After each phase: run the app/tests, verify the acceptance criteria, and commit.

1. **Scaffold:** workspaces, server boots, Mongo connects, Socket.io attached, client Vite app renders, `/health` works, lint/format configured.
   _Accept:_ `npm run dev` starts both; client can open a socket and the server logs the connection.
2. **Rooms:** Room model, join code util, `POST /api/rooms`, `GET /api/rooms/:code`, host token hashing, `room:join` with ack + `room:state`, Home page create/join flow, presenter and audience pages shells.
   _Accept:_ create a room, see the code, join from a second browser, both receive `room:state`.
3. **Live Q&A:** `question:ask`, `question:upvote` (atomic toggle), broadcasts, audience question UI and presenter list.
   _Accept:_ ask from phone-sized window, appears instantly on the presenter and other audience tabs; upvotes sync and toggle correctly.
4. **Polls:** `poll:create`, `poll:vote`, `poll:close`, unique-index duplicate handling, live results UI.
   _Accept:_ a second vote from the same clientId is rejected; counts match across all clients; closed poll rejects votes.
5. **Moderation:** `question:answer`, `question:hide`, `room:close`, hidden section, closed-room guards.
   _Accept:_ hidden questions disappear for audience live but remain for host; non-host sockets get `FORBIDDEN`.
6. **Analytics:** aggregation pipelines, REST endpoint, throttled `analytics:updated`, AnalyticsPanel charts.
   _Accept:_ dashboard numbers match the data and update live.
7. **Anti-spam hardening:** token buckets, REST limits, duplicate-question guard, connection cap, configurable limits.
   _Accept:_ scripted burst gets `RATE_LIMITED`; behavior covered by tests.
8. **Polish and docs:** presence count, reconnection resilience, empty/error states, accessibility pass, README with setup, env vars, architecture diagram (ASCII or Mermaid), and the full socket contract table.

## 15. Testing requirements

- **Unit:** join code generation (charset, uniqueness retry), host token hashing, token bucket, analytics aggregation.
- **Integration (supertest + socket.io-client + mongodb-memory-server):**
  - create room → join as audience and host → host flag only set with a valid token
  - ask question → both clients receive `question:new`
  - upvote toggles and count stays correct under concurrent upvotes from many clientIds
  - duplicate poll vote returns `ALREADY_VOTED` and does not change counts
  - non-host calling a host-only event gets `FORBIDDEN`
  - closed room and closed poll reject writes
  - rate limit triggers `RATE_LIMITED`
- Add `npm test` at the root running all server tests.

## 16. Working rules for you (Claude Code)

- Follow the structure in section 4 and the contract in section 8 **exactly**. Do not rename events or fields.
- Keep it simple. No over-engineering, no extra libraries beyond those listed unless justified in `DECISIONS.md`.
- Write small, readable functions. Keep business logic in `services/`, keep socket handlers thin (validate → call service → broadcast → ack).
- Never put business logic in React components; keep it in the hook/reducer.
- Run the code you write. Don't claim something works without running it or its tests.
- If a requirement conflicts or is unclear, choose the simplest consistent option, log it in `DECISIONS.md`, and continue.
- At the end, give a summary: what's built, how to run it, how to run tests, and known limitations.

**Definition of done:** a presenter can create a room, project the code/QR, run a poll and a Q&A with 20+ simulated audience clients; all views stay in sync in real time, state survives refresh/reconnect, moderation and analytics work, spam/duplicate votes are blocked, and tests pass.

Start now with Phase 1.
