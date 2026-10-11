# Askly v2: Build Prompt for Claude Code

You are upgrading **Askly**, an existing, deployed MERN monorepo, from a single-purpose anonymous Q&A/polling app into a **multi-mode platform with accounts**. Read this entire document before writing code. Follow the architecture, naming, and contracts exactly. When something is ambiguous, choose the simplest option consistent with this document, record it in `DECISIONS.md`, and keep going. Do not stop to ask questions.

This is an **extension of a working codebase, not a rewrite.** Keep what works, keep the existing conventions, keep the existing tests green (adapting them where the identity model changes).

---

## 0. Starting state (verify this first)

Repo: `danwil245/Askly`, npm workspaces monorepo (`client/` React + Vite + Tailwind, `server/` Express + Socket.io + Mongoose), JavaScript with ES modules. Deployed: client on Vercel (`https://askly-beryl.vercel.app`), server on Render (`https://askly-server.onrender.com`), database on MongoDB Atlas.

What exists today (v1):
- Anonymous audience identified by a `clientId` UUID in localStorage. Presenter identified by a one-time `hostToken` (only its hash is stored).
- Models: `Room`, `Question`, `Poll`, `Vote` (unique index on `(pollId, clientId)`).
- Socket events: `room:join`, `question:ask`, `question:upvote`, `poll:vote`, host-only `question:answer`, `question:hide`, `poll:create`, `poll:close`, `room:close`; server broadcasts `room:state`, `question:new|updated`, `poll:new|updated`, `room:updated`, `analytics:updated`, `presence:updated`.
- Layered anti-spam (token buckets, REST limits, duplicate guard, state guards, connection cap).
- Services hold logic (`server/src/services/`), socket handlers are thin (`server/src/sockets/`), all emits go through `server/src/sockets/broadcast.js`, the client has `useRoom` + `roomReducer`.
- 27 passing tests (vitest + supertest + socket.io-client + mongodb-memory-server).

**Before anything else (Phase 0):**
1. Run `git pull` (the remote has one commit the local copy lacks: `client/vercel.json`). Create a branch `v2-platform`.
2. Read `README.md`, `DECISIONS.md`, `server/src/**`, `client/src/**` and the existing tests so you extend the real code, not an imagined version of it.
3. Run `npm install` and `npm test` and record the baseline in your first progress note.

---

## 1. Product overview (v2)

Askly becomes a platform with **three modes**, all gated behind accounts except one entry point.

**Landing page → three host options → each requires login:**

| # | Mode | Who hosts | Who joins | Core idea |
|---|---|---|---|---|
| 1 | **Speaker / Audience** | account holder | account holders (login required) | Live Q&A + polls + moderation + analytics (today's app). Rooms can be closed, reopened, and have history. |
| 2 | **Quiz** (Kahoot-style) | account holder | **anyone with a code + nickname, no account** | Create quizzes; host live games; flat-point scoring; leaderboard; results saved. |
| 3 | **Mentor / Student** | account holder (mentor) | account holders (login required) | **Chapters → Rooms → Sessions.** Permanent reusable course rooms that keep all content, with named session history. |

**The join rule (critical):**
- The landing-page "join with a code" box works **without login only for quiz rooms.**
- For Q&A and Mentor rooms, entering the code makes the person **log in or sign up first**, then drops them into the room.
- The server decides by room type. The user never picks.

---

## 2. Stack changes

Keep everything from v1. Add:

- **Server:** `bcryptjs` (password hashing), `jsonwebtoken` (JWT), `google-auth-library` (verify Google ID tokens).
- **Client:** `@react-oauth/google` (Google sign-in button). No other UI library.
- Everything else (zod, helmet, cors, express-rate-limit, recharts, qrcode.react, Tailwind, vitest, etc.) stays.

---

## 3. Roles and access matrix

| Capability | Anonymous visitor | Logged-in user | Room owner |
|---|---|---|---|
| View landing page | yes | yes | yes |
| Join a **quiz** with code + nickname | **yes** | yes | yes |
| Join a **Q&A / Mentor** room | no (redirected to login, then in) | yes | yes |
| Ask / upvote / vote in Q&A and Mentor rooms | no | yes | yes |
| Create rooms, chapters, quizzes | no | yes | yes |
| Moderate, create polls, close / reopen / rename, view history and analytics | no | no | **yes (owner only)** |
| Host a quiz game | no | only for own quizzes | yes |

Every owner-only action checks **server-side** that `user.id === room.ownerId` (or the owner of the quiz/chapter/session). Never trust client-sent flags.

---

## 4. Core concept: Rooms, Sessions, and "keep everything"

- A **Room** is a persistent container with a stable join `code`. It has `status`: `open` or `closed`.
- A **Session** is one open-to-close period of a room, with a **name**. Opening a room starts a new Session; closing a room ends the current Session and asks the owner to name it.
- **Reopening keeps everything.** All questions, upvotes, answered/hidden flags, polls, votes and results from earlier sessions **remain in the room** and are visible when it reopens. Each item is tagged with the `sessionId` in which it was created, so history can slice it per session.
- On close: all open polls are closed automatically, `room:updated` is broadcast, a summary snapshot is stored on the Session, and further writes are rejected with `ROOM_CLOSED`.
- On reopen: a new Session is created (default name `Session, <date and time>`), `room:updated` is broadcast, connected clients resync.
- **Session naming:** the close flow shows a dialog asking for a name. The owner may skip, which keeps the default name. Sessions can be renamed later from history.
- This engine is **shared by modes 1 and 3.** Mode 3 adds the Chapter layer on top and is presented as long-term, reusable course rooms. Mode 2 (quiz) uses one Room + one Session per hosted game (see section 9).
- **Rooms are never deleted in v2** (history is preserved). Chapters can be **archived** (hidden from default lists) but not hard-deleted if they contain rooms.

---

## 5. Data models (Mongoose, all with `timestamps: true`)

**User**
- `name` (1 to 60), `email` (lowercased, trimmed, unique index), `passwordHash` (optional, absent for Google-only accounts), `googleId` (sparse unique), `avatarUrl` (optional).

**Chapter** (mode 3 only)
- `ownerId` (ref User, indexed), `name` (1 to 80), `description` (0 to 300), `archived` (Boolean, default false).
- Unique index on `{ ownerId, nameLower }` (store a lowercase copy).

**Room**
- `code` (unique, 6 chars, same safe alphabet and collision retry as v1)
- `ownerId` (ref User, indexed)
- `type`: `qa | mentor | quiz`
- `title` (1 to 80)
- `chapterId` (ref Chapter; required when `type === 'mentor'`, null otherwise)
- `quizId` (ref Quiz; only when `type === 'quiz'`)
- `status`: `open | closed`
- `currentSessionId` (ref Session, set while open)
- `settings`: `{ showAuthorNames: 'host' | 'all' }` (default `'host'`: audience sees "Anonymous", the host sees the asker's name)
- Remove `hostTokenHash`. Compound index `{ ownerId, type, chapterId }`.

**Session**
- `roomId`, `roomCode` (indexed), `ownerId`, `name` (1 to 100), `status`: `active | ended`, `startedAt`, `endedAt`.
- `summary` (written at end): for qa/mentor `{ questions, answered, polls, votes, participants }`; for quiz `{ players, questions, topScore }`.
- Quiz only: `quizSnapshot` (full copy of the quiz at game start so later edits never alter history) and `finalLeaderboard` `[{ nickname, score, correctCount, rank }]`, plus `interrupted` (Boolean).
- Index `{ roomId: 1, startedAt: -1 }`.

**Question** (qa/mentor)
- `roomId`, `roomCode`, `sessionId`, `authorUserId`, `authorName` (denormalized at creation), `text` (1 to 280), `upvotes` [userId strings], `upvoteCount`, `answered`, `hidden`.
- Indexes `{ roomId: 1, createdAt: -1 }`, `{ sessionId: 1 }`.

**Poll** (qa/mentor)
- `roomId`, `roomCode`, `sessionId`, `question` (1 to 140), `options` [`{ id, text (1 to 80), votes }`] (2 to 6), `status`: `open | closed`.

**Vote**
- `pollId`, `roomId`, `sessionId`, `userId`, `optionId`.
- **Unique index `{ pollId: 1, userId: 1 }`.** Duplicate votes stay impossible at the database level (Mongo error 11000 maps to `ALREADY_VOTED`).

**Quiz** (the authored quiz)
- `ownerId`, `title` (1 to 100), `description` (0 to 300), `questions` [`{ id, text (1 to 200), options: [{ id, text (1 to 100) }] (2 to 4), correctOptionId, timeLimitSec (5 to 120, default 20) }`] (1 to 50 questions).

**Player** (quiz games)
- `sessionId`, `roomId`, `clientId`, `nickname` (2 to 20, trimmed), `nicknameLower`, `score`, `correctCount`, `joinedAt`, `kicked` (Boolean).
- Unique index `{ sessionId: 1, nicknameLower: 1 }`.

**PlayerAnswer**
- `sessionId`, `playerId`, `questionId`, `optionId`, `correct`, `answeredAt`.
- **Unique index `{ sessionId: 1, playerId: 1, questionId: 1 }`** (one answer per player per question, enforced by the database).

**Legacy data:** v1 rooms have no `ownerId` and become unreachable. Add `server/scripts/purge-legacy-rooms.js` that deletes rooms, questions, polls and votes lacking `ownerId`/`sessionId`. No migration is needed.

---

## 6. Authentication design

- **Email + password:** `POST /api/auth/signup`, `POST /api/auth/login`. Passwords minimum 8 characters, hashed with bcryptjs (`BCRYPT_ROUNDS`, default 10). Login failures return one generic `INVALID_CREDENTIALS` message (never reveal whether the email exists).
- **Google:** the client gets a Google ID token via `@react-oauth/google`, then `POST /api/auth/google { idToken }`. The server verifies it with `google-auth-library` against `GOOGLE_CLIENT_ID` and requires `email_verified === true`. Find the user by `googleId`, else by email (link the Google account), else create one.
  - **Security rule:** when linking Google to an existing **password** account for the first time, **remove that account's `passwordHash`** so a squatter who pre-registered someone else's email cannot keep access. Document this in `DECISIONS.md`.
  - If `GOOGLE_CLIENT_ID` is not set, the endpoint returns 503 and the client hides the Google button (when `VITE_GOOGLE_CLIENT_ID` is also unset).
- **Tokens:** JWT (HS256) signed with `JWT_SECRET`, payload `{ sub: userId }`, expiry `JWT_EXPIRES_IN` (default `7d`). The server **fails fast** if `JWT_SECRET` is missing or shorter than 32 characters.
- **Storage:** the client keeps the token in `localStorage` and sends `Authorization: Bearer <token>`. This is deliberate: client (Vercel) and server (Render) are on different registrable domains, and cookies would be treated as third-party and blocked by some browsers. Record the XSS trade-off in `DECISIONS.md` (React escapes by default; never use `dangerouslySetInnerHTML`).
- `GET /api/auth/me` returns the current user. Logout is client-side (delete token).
- **Sockets:** the client passes `auth: { token, clientId? }` in the Socket.io handshake. A server middleware verifies the token if present and sets `socket.data.user = { id, name }`. Quiz players connect **without** a token.
- All auth endpoints are rate limited (see section 12). Responses never include `passwordHash`.

---

## 7. REST API

All JSON. Errors use `{ error: { code, message } }`. "Owner" means authenticated and owns the resource.

**Auth**
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup` | none | `{ name, email, password }` returns `{ token, user }` |
| POST | `/api/auth/login` | none | `{ email, password }` returns `{ token, user }` |
| POST | `/api/auth/google` | none | `{ idToken }` returns `{ token, user }` |
| GET | `/api/auth/me` | user | Current user |

**Rooms**
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/rooms/:code` | none | Public meta `{ code, title, type, status }` (used by the landing join box to route by type) |
| POST | `/api/rooms` | user | `{ type: 'qa' \| 'mentor', title, chapterId? }`; creates the room **open** with its first Session; returns room + `currentSession` |
| GET | `/api/rooms/mine` | user | Query `type`, `chapterId`, `status`; returns the caller's rooms with `currentSession` and last-activity info |
| PATCH | `/api/rooms/:code` | owner | `{ title?, chapterId?, settings? }` |
| POST | `/api/rooms/:code/open` | owner | Reopen: starts a new Session, sets `open`, broadcasts |
| POST | `/api/rooms/:code/close` | owner | `{ sessionName? }` ends the Session, closes open polls, writes summary, sets `closed`, broadcasts |
| GET | `/api/rooms/:code/sessions` | owner | Session list (newest first) with summaries |
| GET | `/api/rooms/:code/analytics` | owner | Query `sessionId?`; room-wide (all sessions) when omitted |

**Sessions**
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/sessions/:id` | owner | Full report: session, questions (with author names), polls with results, analytics; for quiz games, the leaderboard and per-question stats |
| PATCH | `/api/sessions/:id` | owner | `{ name }` rename |

**Chapters (mode 3)**
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/chapters` | user | Own chapters (query `includeArchived`) with room counts |
| POST | `/api/chapters` | user | `{ name, description? }` |
| PATCH | `/api/chapters/:id` | owner | `{ name?, description?, archived? }` |

**Quizzes (mode 2)**
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/quizzes` | user | Own quizzes |
| POST | `/api/quizzes` | user | Create |
| GET | `/api/quizzes/:id` | owner | Read (includes correct answers) |
| PUT | `/api/quizzes/:id` | owner | Replace |
| DELETE | `/api/quizzes/:id` | owner | Delete the quiz (past games are unaffected because they hold a snapshot) |
| POST | `/api/quizzes/:id/host` | owner | Creates a `quiz` Room + Session with a join code; returns `{ code }` |
| GET | `/api/quizzes/games` | user | Past games for the caller's quizzes (ended Sessions of quiz rooms) |

**Misc:** `GET /health` unchanged.

The room close and open logic lives in **one service** (`roomLifecycleService`) used by both the REST routes and the socket events, so behavior cannot diverge.

---

## 8. Socket.io contract: Q&A and Mentor rooms (extends v1; do not rename existing events)

Rules from v1 still apply: every client-to-server event uses an ack `{ ok, data? | error }`, every payload is zod validated, the server is the source of truth, each socket joins a Socket.io room named by `code` (host sockets also join `${code}:host`), the client re-emits `room:join` on every (re)connect, all emits go through `broadcast.js`.

**What changes**
- Identity is now `socket.data.user.id` (from the handshake token). `clientId` is no longer an identity for these rooms.
- `room:join` payload is `{ code }`. It requires an authenticated socket for `qa` and `mentor` rooms, otherwise ack `UNAUTHENTICATED`. `isHost = (user.id === room.ownerId)`. There is no `hostToken` anymore.
- Votes and upvotes are keyed by `userId`.
- `question:ask` stores `authorUserId` and `authorName`.
- Question serialization: the **host** sees `authorName` and the `upvotes` array's count; the **audience** sees `authorName` only if `room.settings.showAuthorNames === 'all'`, otherwise `"Anonymous"`. Never send `authorUserId` or the `upvotes` array to non-hosts.

**`room:state` (join ack) payload**
`{ room: { code, title, type, status, chapter?, settings }, currentSessionId, sessions: [{ id, name, startedAt, endedAt }], questions, polls, myVotes: { [pollId]: optionId }, myUpvotes: [questionId], isHost }`
- `questions` and `polls` include **all sessions' items** (each carries `sessionId`) so a reopened room shows everything. Cap at the most recent 500 questions and 100 polls in state, and expose `GET /api/sessions/:id` for the complete history.
- Audience gets non-hidden questions only; the host gets all.

**New / changed events**
| Event | Who | Payload | Behavior |
|---|---|---|---|
| `room:close` | host | `{ sessionName? }` | Calls `roomLifecycleService.close`; broadcasts `room:updated` |
| `room:open` | host | `{}` | Calls `roomLifecycleService.open`; broadcasts `room:updated` |
| `session:renamed` | server | `{ id, name }` | Broadcast to the host room only |

`room:updated` payload becomes `{ status, currentSessionId, sessions }`. When a client receives `room:updated` with `status: 'open'` after being closed, it re-emits `room:join` to resync.

All other v1 events keep their names, payload shapes and behavior (`question:ask`, `question:upvote`, `poll:vote`, `question:answer`, `question:hide`, `poll:create`, `poll:close`, `question:new|updated`, `poll:new|updated`, `analytics:updated`, `presence:updated`).

**Error codes (v1 plus):** `UNAUTHENTICATED`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `QUIZ_NOT_FOUND`, `NICKNAME_TAKEN`, `GAME_STARTED`, `GAME_FULL`, `ALREADY_ANSWERED`, `TIME_UP`, `WRONG_PHASE`, `KICKED`.

---

## 9. Quiz mode: engine and contract

**Lifecycle:** the owner builds a Quiz, clicks Host, and the server creates a `quiz` Room (new code every game) plus a Session. The game is a state machine held **in memory per room code** (`quizEngine`), with outcomes persisted to the database as they happen.

Phases: `lobby → question → reveal → leaderboard → (next question or) finished`.

- **lobby:** players join with code + nickname; the host sees the player list and can kick. The host starts the game.
- **question:** the server broadcasts the question (text and options **without** the correct answer), `timeLimitSec`, `endsAt` (server epoch ms) and `serverNow` so clients correct clock skew. Answers are accepted only while `now < endsAt`. When every connected player has answered **or** the timer expires, move to `reveal`. The host may also skip to reveal early.
- **reveal:** broadcast the correct option and the distribution of answers per option. Each player also gets a personal result.
- **leaderboard:** top 5 plus each player's own rank. The host advances with `quiz:next`.
- **finished:** final leaderboard and podium. Persist `finalLeaderboard`, the quiz summary, and mark the Session `ended` and the Room `closed`.

**Scoring:** a **flat** `QUIZ_POINTS_PER_CORRECT` points (default 100) per correct answer. No speed bonus. Ties share a rank.

**Server authority:** scoring, timing and correctness are server-side only. Clients never receive correct answers before reveal. Late or duplicate answers are rejected (`TIME_UP`, `ALREADY_ANSWERED`). The database unique index on `PlayerAnswer` is the backstop.

**Players (no account):** connect without a token, then `quiz:join { code, nickname, clientId }`. Nickname 2 to 20 characters, unique per game case-insensitively (`NICKNAME_TAKEN`), basic control-character stripping. A player may rejoin with the same `clientId` + nickname to restore their score and position after a refresh or disconnect. Joining after the game has started returns `GAME_STARTED` (unless it's a rejoin). Maximum players per game: `QUIZ_MAX_PLAYERS` (default 200, `GAME_FULL`).

**Client to server**
| Event | Who | Payload | Behavior |
|---|---|---|---|
| `quiz:host:join` | owner | `{ code }` | Auth required; ack the full host snapshot |
| `quiz:join` | player | `{ code, nickname, clientId }` | Ack `{ player, state }` |
| `quiz:answer` | player | `{ questionId, optionId }` | Record answer; ack `{ received: true }` only (no correctness yet) |
| `quiz:start` | owner | `{}` | lobby to first question (needs at least 1 player) |
| `quiz:skip` | owner | `{}` | End the current question early (go to reveal) |
| `quiz:next` | owner | `{}` | From leaderboard, go to the next question or finish |
| `quiz:kick` | owner | `{ playerId }` | Remove a player (they get `KICKED`) |
| `quiz:end` | owner | `{}` | Abort the game (marks the Session `interrupted`) |

**Server to client**
| Event | To | Payload |
|---|---|---|
| `quiz:state` | joiner | Current phase snapshot (for join and rejoin) |
| `quiz:players` | all (names and count for the host) | `{ count, players? }` |
| `quiz:question` | all | `{ index, total, questionId, text, options, timeLimitSec, endsAt, serverNow }` |
| `quiz:answer-count` | host | `{ answered, total }` |
| `quiz:reveal` | all | `{ correctOptionId, distribution }` |
| `quiz:result` | that player | `{ correct, pointsEarned, totalScore, rank }` |
| `quiz:leaderboard` | all | `{ top, total }` (each player also receives their own rank) |
| `quiz:finished` | all | `{ leaderboard }` |

**Persistence and history:** the Session stores `quizSnapshot` and `finalLeaderboard`; `Player` and `PlayerAnswer` rows give per-question stats (percent correct, answer distribution). If the server restarts mid-game, the in-memory game is lost: on boot, mark any `active` quiz Sessions as `ended` with `interrupted: true` and close their rooms. Note this limitation in `README.md`.

---

## 10. User flows

1. **Anonymous quiz join:** landing box, enter code, `GET /api/rooms/:code` returns `type: quiz`, go to `/play/:code`, enter nickname, play.
2. **Anonymous Q&A/Mentor join:** landing box, enter code, `type` is `qa` or `mentor`, redirect to `/login?next=/r/:code`, after auth go to `/r/:code`.
3. **Closed room join:** if the room is closed, show a clear "This room is closed" page (not an error) with the room title. If the owner reopens it, the page updates live.
4. **Host a Q&A room:** `/speaker`, create room, `/host/:code`, share code/QR, run it, Close, name the session dialog, history.
5. **Mentor:** `/mentor`, create chapter (e.g. "SSN"), open the chapter, create course rooms (e.g. "Data Structures"), run, close, name the session, later reopen the same room: all previous questions/polls are still there, and prior sessions are listed in history.
6. **Quiz:** `/quiz`, Create (builder) or Join (code + nickname), host a saved quiz, `/host/quiz/:code` lobby, play through, results saved to history.
7. **Gate:** clicking any option card while logged out goes to `/login?next=<that option's page>`, then back.

---

## 11. Frontend

### 11.1 Routes

| Route | Page | Access |
|---|---|---|
| `/` | Landing | public |
| `/login`, `/signup` | Auth pages (honor `?next=`) | public |
| `/speaker` | Option 1 hub: create room, my Q&A rooms, history | auth |
| `/mentor` | Option 3 hub: chapters list | auth |
| `/mentor/chapters/:id` | Chapter page: course rooms, create room, open/close | auth, owner |
| `/quiz` | Option 2 hub: **Create a quiz** and **Join a quiz** cards, my quizzes, past games | auth |
| `/quiz/new`, `/quiz/:id/edit` | Quiz builder | auth, owner |
| `/play` | Join-a-quiz form (code + nickname) | auth (reached from the hub); anonymous players use the landing box which goes straight to `/play/:code` |
| `/play/:code` | Quiz player | public |
| `/host/:code` | Q&A / Mentor presenter dashboard | auth, owner |
| `/host/quiz/:code` | Quiz host controller | auth, owner |
| `/r/:code` | Q&A / Mentor audience | auth |
| `/history/:roomCode` | Room's session list | auth, owner |
| `/history/session/:sessionId` | Session report | auth, owner |

Add `<RequireAuth>` and owner checks (redirect to `/` with a toast when not the owner). Keep `vercel.json` rewrites so deep links survive refresh.

### 11.2 Landing page (inspired by Slido's layout; **original Askly branding and copy**)

Do **not** copy Slido's logo, wordmark, colors or wording. Use Askly's existing teal + indigo system, Space Grotesk / DM Sans, light/dark mode.

Layout, top to bottom:
1. **Nav bar:** Askly logo (left); right side: `Log in` (text button) and `Sign up` (primary button). Logged-in state: the user's name and avatar menu with `Dashboard` links and `Log out`. No other nav items.
2. **Join pill** (centered, prominent, rounded, dark-on-light or inverse in dark mode): label "Have a code?", an input with a `#` prefix and placeholder "Enter code here", and a circular arrow submit button. Auto-uppercase, 6 characters. On submit: `GET /api/rooms/:code`, then route by type as in section 10. Show a friendly inline error for an unknown code. Add a tiny helper line: "Quiz codes work instantly. Q&A and class room codes need a quick sign-in."
3. **Hero:** large headline (original copy, e.g. "Make every session interactive"), one supporting sentence about live Q&A, polls, quizzes and class rooms, and a primary button "Get started" that smooth-scrolls to the cards.
4. **Three option cards** (large, equal, clear icons, short description, hover lift, fully keyboard accessible): **Speaker & Audience**, **Quiz Arena**, **Mentor Room**. Clicking one goes to its hub if logged in, else to `/login?next=<hub>`.
5. Minimal footer.

Fully responsive. The join pill and cards must be usable one-handed on a phone.

### 11.3 Design system

Reuse the existing tokens, `Button`, `Modal`, `Toaster`, `EmptyState`, `ConnectionBadge`, `ThemeToggle`, `Logo`. New components:

- **Auth:** `AuthForm`, `GoogleSignInButton`, `AuthLayout`, `UserMenu`.
- **Hubs:** `OptionCard`, `RoomCard` (title, type badge, status chip open/closed, last activity, Open/Close/Reopen actions, link to history), `ChapterCard`, `CreateRoomModal`, `CreateChapterModal`.
- **Lifecycle:** `CloseRoomDialog` (asks for the session name, "Skip" keeps the default, confirms that polls close and the room stops accepting new items), `SessionList`, `SessionReport` (questions with asker names, poll bars, analytics charts, or quiz leaderboard and per-question stats), inline session rename.
- **Quiz builder:** `QuizBuilder`, `QuestionEditor` (text, 2 to 4 options, mark correct, time limit), reorder up/down, duplicate, delete, validation with inline errors, an autosave draft indicator.
- **Quiz live:** `QuizLobby` (huge code + QR, player chips, kick), `QuestionScreen` (timer ring + options), `RevealScreen` (animated distribution bars + correct highlight), `Leaderboard`, `Podium`, `NicknameForm`, `PlayerWaiting`.
- **Quiz options styling:** four option tiles, each with a **letter label (A-D) and a distinct shape icon in addition to color**, using a color-blind-safe palette, so meaning never depends on color alone. Minimum 56px tall touch targets.
- **Accessibility:** focus rings, `aria-live` for timer and phase changes without stealing focus, `prefers-reduced-motion` respected, strong contrast in both themes, projector-legible type on host screens.
- **Presenter dashboard additions:** a session banner (current session name, started time), a **Close room** button that opens `CloseRoomDialog`, a **Reopen** button when closed, a "Previous sessions" group in the question list (items grouped under their session name, current session expanded first), and a link to history. The Question list shows the asker name to the host.

### 11.4 State and plumbing

- `AuthContext`: `{ token, user, loading, login, signup, googleLogin, logout }`. On boot call `/api/auth/me` if a token exists. `api/http.js` attaches the bearer token; a 401 clears the token and redirects to `/login?next=<current path>`.
- `socket/socket.js`: pass `auth: { token, clientId }`; reconnect with the new token after login/logout.
- `useRoom` and `roomReducer` extended for the new `room:state` shape, `room:updated`, `session:renamed`.
- New `useQuiz` hook + `quizReducer` for both host and player views; clients correct timers using `serverNow` skew; the countdown is display-only (the server decides when time is up).
- `lib/clientId.js` stays (still used for quiz players' reconnect identity). `lib/hostToken.js` is removed.

---

## 12. Security, anti-spam and limits (updates to v1)

- **Identity:** Q&A and Mentor votes, upvotes and rate limits are keyed by **userId** (and IP as a secondary key). One vote per account, enforced by the unique index.
- **Quiz players:** rate limit by `clientId` and IP; `quiz:answer` limited per player per question by the unique index plus a small token bucket.
- **Campus Wi-Fi reality:** many students share one public IP. **Raise `MAX_SOCKETS_PER_IP_PER_ROOM` default to 300** and make it effective only as a flood guard; rely on per-user and per-player limits. Likewise, the REST room-create limit becomes **per user** (`RL_ROOM_CREATE_PER_HOUR`, default 30), not per IP.
- **Auth endpoints:** `RL_AUTH_PER_15MIN` per IP (default 60) plus a per-email attempt limiter (default 10 failed logins per 15 minutes). Constant-time password comparison via bcrypt. Generic error messages.
- **Validation:** zod on every REST and socket payload. Trim and strip control characters from all user text (questions, nicknames, titles, quiz text).
- **Authorization:** every owner-only REST route and socket event verifies ownership server-side. Add a shared `requireOwner` helper and use it everywhere.
- **Privacy:** never return `passwordHash`, `googleId`, other users' emails, `authorUserId`, or the `upvotes` array to non-owners. Quiz correct answers are never sent to players before `quiz:reveal`.
- **Existing guards stay:** state guards (closed room/poll), duplicate-question guard (now scoped per room), helmet, strict CORS to `CLIENT_ORIGIN`, central error handler, socket handlers wrapped so exceptions become `{ ok: false }` acks.
- Document in `DECISIONS.md` that JWTs in localStorage trade cookie CSRF safety for XSS exposure, and that quiz nicknames are unauthenticated by design.

---

## 13. Repo structure changes

Add or change (keep everything else as is):

```
server/src/
├─ models/            + User.js Chapter.js Session.js Quiz.js Player.js PlayerAnswer.js ; Room.js/Question.js/Poll.js/Vote.js updated
├─ services/          + authService.js userService.js chapterService.js sessionService.js
│                     + roomLifecycleService.js   (open/close/rename, shared by REST + sockets)
│                     + quizService.js quizEngine.js quizScoring.js
│                     ~ roomService.js questionService.js pollService.js moderationService.js analyticsService.js updated
├─ controllers/       + auth.controller.js chapters.controller.js quizzes.controller.js sessions.controller.js ; rooms.controller.js updated
├─ routes/            + auth.routes.js chapters.routes.js quizzes.routes.js sessions.routes.js ; rooms.routes.js updated
├─ middleware/        + auth.js (requireAuth, optionalAuth) requireOwner.js ; antiSpam.js updated (userId keys) ; hostAuth.js removed
├─ sockets/           + quizHandlers.js quizBroadcast.js ; index.js (handshake auth) roomHandlers.js updated
├─ utils/             + jwt.js password.js googleVerify.js sanitize.js
└─ scripts/           + purge-legacy-rooms.js
server/tests/         + auth.test.js ownership.test.js lifecycle.test.js quiz.test.js chapters.test.js ; existing tests adapted

client/src/
├─ context/           + AuthContext.jsx
├─ pages/             + Landing.jsx Login.jsx Signup.jsx SpeakerHub.jsx MentorHub.jsx ChapterPage.jsx QuizHub.jsx
│                     + QuizBuilder.jsx PlayJoin.jsx QuizPlayer.jsx QuizHost.jsx History.jsx SessionReport.jsx
│                     ~ Home.jsx replaced by Landing.jsx ; PresenterDashboard.jsx AudienceRoom.jsx updated
├─ components/        + auth/ hubs/ lifecycle/ quiz/ (see section 11.3) ; shared/ extended
├─ hooks/             + useQuiz.js useAuth.js ; useRoom.js updated
├─ state/             + quizReducer.js ; roomReducer.js updated
└─ lib/               - hostToken.js removed ; + guards.jsx (RequireAuth, RequireOwner)
```

---

## 14. Environment variables

**Server (`server/.env`, update `.env.example`)**

| Var | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | none, **required**, 32+ chars | Signs tokens (server fails fast if missing or short) |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `GOOGLE_CLIENT_ID` | optional | Verifies Google ID tokens (feature off if unset) |
| `BCRYPT_ROUNDS` | `10` | Password hash cost |
| `QUIZ_POINTS_PER_CORRECT` | `100` | Flat points per correct answer |
| `QUIZ_MAX_PLAYERS` | `200` | Players per game |
| `RL_AUTH_PER_15MIN` | `60` | Auth requests per IP |
| `RL_LOGIN_FAILS_PER_15MIN` | `10` | Failed logins per email |
| `RL_ROOM_CREATE_PER_HOUR` | `30` | Room creations per **user** |
| `MAX_SOCKETS_PER_IP_PER_ROOM` | `300` | Flood guard |
| existing v1 vars | unchanged | Mongo URI, CLIENT_ORIGIN, rate limits, etc. |

**Client (`client/.env`, update `.env.example`):** `VITE_API_URL` (unchanged) and `VITE_GOOGLE_CLIENT_ID` (optional; hides the Google button if unset).

**Google sign-in setup (put these exact steps in the README):**
1. Go to console.cloud.google.com, create a project.
2. APIs & Services, OAuth consent screen: choose External, fill app name and your email, save.
3. APIs & Services, Credentials, Create credentials, OAuth client ID, type **Web application**.
4. Authorized JavaScript origins: `http://localhost:5173` and `https://askly-beryl.vercel.app` (plus any custom domain).
5. Copy the **Client ID** (no secret is needed for the ID-token flow) into `GOOGLE_CLIENT_ID` (Render) and `VITE_GOOGLE_CLIENT_ID` (Vercel), then redeploy both.

**Deployment checklist (add to the README):** set `JWT_SECRET` and `GOOGLE_CLIENT_ID` on Render; set `VITE_GOOGLE_CLIENT_ID` on Vercel; run `purge-legacy-rooms.js` once against the production database; redeploy both services; smoke test sign-up, a Q&A room, a mentor room reopen, and a quiz with two browsers.

---

## 15. Build plan (vertical slices; commit after each phase; keep `npm test`, `npm run lint` and `npm run build` green)

Post a short plan, then execute. At the end of each phase run the checks, confirm the acceptance criteria and commit with a clear message.

**Phase 0: Sync and baseline.** `git pull`, branch `v2-platform`, install, run tests, read the code.
*Accept:* baseline recorded; all 27 existing tests pass.

**Phase 1: Accounts.** User model, auth service/routes (signup, login, Google, me), JWT, `requireAuth`/`optionalAuth`, handshake auth middleware, client `AuthContext`, Login/Signup pages with Google button, guards, logout, `api/http` token handling.
*Accept:* sign up, log in, refresh stays logged in, log out; Google works when configured; weak/duplicate-email/bad-credential cases return the right errors; passwordHash never leaks.

**Phase 2: Ownership, Sessions and identity switch (backend core).** Update Room/Question/Poll/Vote models, add Session, `roomLifecycleService`, ownership checks, userId identity for votes/upvotes/rate limits, `room:state` new shape, open/close/reopen over REST and sockets, session naming and rename, history endpoints, author-name visibility, analytics scoped by session. Adapt the existing tests and add lifecycle/ownership tests.
*Accept:* a room created by user A cannot be moderated by user B; closing makes writes fail with `ROOM_CLOSED` and closes open polls; reopening keeps all earlier questions/polls/votes and creates a new Session; duplicate votes by the same user are blocked; unauthenticated sockets get `UNAUTHENTICATED` on Q&A rooms.

**Phase 3: Landing and routing.** Landing page per section 11.2, join pill with type-based routing, option cards with login gating and `?next=` return, route guards, UserMenu.
*Accept:* quiz code skips login; Q&A/mentor code redirects to login then lands in the room; unknown code shows a friendly error; fully responsive; both themes look right.

**Phase 4: Speaker hub and history (Option 1).** `/speaker` hub (create/list/open/close/reopen rooms), updated presenter dashboard and audience room for the account model, `CloseRoomDialog`, session banner, previous-sessions grouping, `/history/:roomCode`, `SessionReport`, session rename.
*Accept:* full Option 1 flow works across two browsers with two accounts; close asks for a name (skip keeps default); history lists sessions and each report matches the data.

**Phase 5: Mentor hub (Option 3).** Chapter CRUD (create, rename, archive), `/mentor` and `ChapterPage`, create course rooms under a chapter, move a room between chapters, open/close/reopen, per-room history.
*Accept:* create "SSN" and "SRM" chapters with several rooms each; reopen a course room next week and see all previous questions and polls; history shows each named session; archived chapters hide from the default list.

**Phase 6: Quiz (Option 2).** Quiz CRUD and builder, `quizService`/`quizEngine`/scoring, host flow, player flow, lobby, timer, reveal, leaderboard, podium, kick, reconnect, persistence of the Session, Players and PlayerAnswers, past games list, quiz session report, interrupted-game cleanup on boot.
*Accept:* with 1 host and 5 simulated players: flat scoring is exact; late and duplicate answers are rejected; the correct answer never reaches players before reveal; a refreshed player resumes with the same score; final leaderboard and per-question stats are saved and viewable in history.

**Phase 7: Hardening and docs.** Rate-limit and IP-cap updates, input sanitization, accessibility pass, empty/loading/error states everywhere, update `README.md` (new architecture diagram, full REST table, both socket contract tables, env vars, Google setup, deployment checklist, limitations) and `DECISIONS.md`.
*Accept:* all tests, lint and build pass; the README matches reality.

---

## 16. Testing requirements

Keep the v1 test style (vitest, supertest, socket.io-client, mongodb-memory-server). Adapt existing tests to accounts, and add:

- **Auth:** signup validation, duplicate email, login success/failure (generic error), token verification, Google verify path (mock `google-auth-library`), Google-link removes `passwordHash`, `/me`, secret never leaked.
- **Ownership:** every owner-only REST route and socket event rejects non-owners (`FORBIDDEN`) and anonymous callers (`UNAUTHENTICATED`).
- **Lifecycle:** create, close with name, writes rejected after close, polls auto-closed, reopen creates a new Session and keeps all old items, rename session, history endpoints, analytics scoped per session and room-wide.
- **Identity:** one vote per user (unique index, `ALREADY_VOTED`), upvote toggle correctness under concurrency across many users, author names hidden from the audience and visible to the host, `showAuthorNames: 'all'` behavior.
- **Join rules:** `GET /api/rooms/:code` returns the right `type`; a Q&A socket without a token is rejected; a quiz player connects without one.
- **Chapters:** CRUD, unique name per owner, archive, mentor room requires a chapter, move room between chapters.
- **Quiz engine:** full game with multiple players; flat scoring; ties share rank; late answer `TIME_UP`; duplicate answer `ALREADY_ANSWERED`; nickname uniqueness; kick; rejoin restores score; `GAME_STARTED` for newcomers; correct answer absent from `quiz:question`; results persisted; interrupted-game cleanup.
- **Limits:** auth rate limit and login-failure limiter trigger; campus-IP scenario (many sockets from one IP under the raised cap) still works.
- Frontend: at minimum, reducer unit tests for `roomReducer` and `quizReducer`, and a smoke test that the landing page routes quiz vs. non-quiz codes correctly (mock fetch).

---

## 17. Working rules

- Extend, don't rewrite. Keep v1 event names and payload shapes unless section 8 says otherwise.
- Business logic in `services/`; thin socket handlers and controllers (validate, call service, broadcast, ack). No business logic in React components (it lives in hooks, reducers and context).
- One shared lifecycle service for open/close so REST and sockets never diverge.
- Keep it simple. No new libraries beyond section 2 without a note in `DECISIONS.md`.
- Never commit secrets or `.env` files. Never log tokens, passwords or password hashes.
- Run what you build. Do not claim anything works without running it or its tests.
- When something is ambiguous, pick the simplest consistent option, log it in `DECISIONS.md`, continue.
- Commit after every phase with a descriptive message.
- At the end give a summary: what's built, how to run it, how to run tests, the required new env vars, the Google setup steps, and known limitations.

**Definition of done:** a visitor can use the landing page; a quiz code joins instantly with a nickname, while a Q&A or mentor code requires login and then enters the room; a logged-in user can run all three modes; Q&A and mentor rooms can be closed with a named session and reopened with everything intact; mentors organize chapters and course rooms; quizzes can be built, hosted live with flat scoring, and reviewed in history; ownership is enforced everywhere; all data is saved and viewable; tests, lint and build pass.

Start now with Phase 0.
