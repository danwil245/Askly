# Decisions Log

Judgment calls made while building Askly, per the build prompt's instruction to pick the
simplest consistent option and record it here.

## Architecture

- **Monorepo via npm workspaces** (`client`, `server`) with a root `package.json` orchestrating
  both through `concurrently`. Root `npm run dev` starts both; `npm test` runs server tests.
- **Broadcast layer behind small functions** (`server/src/sockets/broadcast.js`). All server→client
  emits go through named helpers so a Redis adapter (`@socket.io/redis-adapter`) can be dropped in
  later without touching handlers or services. Single-process is fine for now.
- **clientId is spoofable.** It lives in `localStorage` as a UUID v4 and is only a dedupe key, not a
  security boundary. The anti-spam design (rate limits, unique vote index, duplicate guard,
  connection cap) deters casual spam and accidental double-submits, **not** a determined attacker who
  rotates clientIds / IPs. Documented per section 10.7 of the prompt.

## Testing

- **vitest** (not jest) for unit + integration, with **supertest**, **socket.io-client**, and
  **mongodb-memory-server**. vitest has first-class ESM support which matches the server's
  `"type": "module"`, avoiding jest's experimental-ESM friction.
- `mongodb-memory-server` downloads a MongoDB binary on first run, so tests don't require a local
  Mongo install (the dev/runtime server still needs `MONGODB_URI`).

## Design / UI

- **Design direction** chosen via the `ui-ux-pro-max` skill: teal primary + indigo accent with
  green/amber/red status colors, Space Grotesk (headings) + DM Sans (body), full light & dark mode.
  Data-dense but scannable, subtle live-pulse indicators, no heavy shadows / 3D (per the skill's
  anti-patterns for real-time monitoring UIs).
- **recharts** for analytics (line = questions over time, bar = poll results) with value labels and
  accessible color usage.

## Conventions

- Socket event names and field names follow section 8 of the prompt **exactly** and must not be
  renamed.
- Business logic lives in `services/`; socket handlers are thin (validate → service → broadcast →
  ack). React components hold no business logic — that lives in `useRoom` + `roomReducer`.

<!-- Append new decisions below as they are made. -->

## v2 — Platform with accounts

### Phase 1: Accounts

- **JWT in localStorage (not cookies).** Client (Vercel) and server (Render) are on different
  registrable domains, so cookies would be third-party and blocked by some browsers. We store the
  JWT in `localStorage` and send `Authorization: Bearer <token>`. Trade-off: this avoids CSRF but is
  exposed to XSS — mitigated by React escaping all output by default and never using
  `dangerouslySetInnerHTML`. Documented per spec section 6/12.
- **Google link removes the password.** When a Google sign-in matches an existing *password*
  account by email, we set `passwordHash = undefined` while linking `googleId`. This prevents an
  email squatter who pre-registered someone else's address from retaining password access once the
  real owner proves control of the email via Google. (spec section 6)
- **Generic login errors.** Login failures always return the same `INVALID_CREDENTIALS` message and
  run a dummy bcrypt compare when the user is missing, so neither the response nor timing reveals
  whether an email is registered.
- **Google verification isolated** in `utils/googleVerify.js` so tests mock it without network or
  credentials. The endpoint returns `503` when `GOOGLE_CLIENT_ID` is unset, and the client hides the
  button unless both `VITE_GOOGLE_CLIENT_ID` and the server's `/health.googleEnabled` are true.
- **Socket identity:** the handshake now verifies the JWT (`socket.data.user`) while still carrying
  `clientId` (needed by future quiz players who connect without a token).

### Phase 2: Ownership, Sessions, identity

- **One lifecycle service** (`roomLifecycleService`) owns open/close/reopen and is called by both
  the REST routes and the socket handlers, so behavior can't diverge (spec section 7/15). REST
  controllers broadcast `room:updated` through a shared `io` reference stored on the broadcast
  module (`setIo`/`getIo`) during `attachSockets`, so lifecycle changes made over REST still reach
  connected sockets. When no sockets are attached (unit tests) the broadcast is a no-op.
- **Keep-everything model:** questions/polls/votes are tagged with `sessionId` but queried by
  `roomId`, so a reopened room shows all prior content. `room:state` returns items across all
  sessions (capped at 500 questions / 100 polls); full history is available via
  `GET /api/sessions/:id`.
- **Author-name visibility** is computed at serialization time from `room.settings.showAuthorNames`.
  The acting socket's view of the setting is used for a broadcast (captured from the freshly-loaded
  room on each write), so it's current without extra queries. Non-hosts never receive
  `authorUserId` or the `upvotes` array.
- **Identity is `userId`** for qa/mentor votes, upvotes, and rate limits; the unique
  `(pollId, userId)` Vote index is the hard one-vote-per-account guarantee.
- **Legacy v1 data** (no `ownerId`/`sessionId`) is unreachable in v2; `purge-legacy-rooms.js`
  deletes it. No migration — v1 was anonymous and pre-accounts.
- The v1 `hostToken`/`hostAuth` mechanism is removed; host status is derived purely from ownership
  (`user.id === room.ownerId`), checked server-side everywhere via the shared `assertOwned`.
