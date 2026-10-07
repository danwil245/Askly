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
