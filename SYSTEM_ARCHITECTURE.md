# Askly — Full System Architecture

> **One-Line Pitch for Judges:**  
> *"Askly is a high-concurrency, real-time engagement platform built as an event-driven MERN monorepo that pairs dual-protocol networking (REST + WebSockets) with in-memory state machines and an append-only MongoDB persistence model."*

---

## 1. High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER (React 18 + Vite)                       │
│                                                                                        │
│   ┌───────────────────────────┐  ┌───────────────────────────┐  ┌────────────────────┐ │
│   │     Host / Presenter      │  │     Audience Member       │  │    Quiz Player     │ │
│   │    /host/:code (SPA)      │  │        /r/:code           │  │     /play/:code    │ │
│   │  • Live Question Sorting  │  │  • Real-time Upvotes      │  │  • Colorblind-Safe │ │
│   │  • Poll Creation & Recharts│ │  • Live Poll Voting       │  │    Choice Cards    │ │
│   │  • Session State Controls │  │  • Auth via JWT in Local  │  │  • Anonymous Nick  │ │
│   └─────────────┬─────────────┘  └─────────────┬─────────────┘  └──────────┬─────────┘ │
└─────────────────┼──────────────────────────────┼───────────────────────────┼───────────┘
                  │                              │                           │
                  │ REST (/api)                  │ Bi-directional Sockets    │ Sockets
                  │ Authorization: Bearer <JWT>  │ (ws:// with <30ms latency)│ (q:<code>)
                  ▼                              ▼                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  SERVER & REAL-TIME LAYER                              │
│                                (Node.js 20+ / Express / Socket.io)                     │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              Security & Traffic Shield                           │  │
│  │   • Helmet HTTP Headers        • Express Rate Limit (Auth Brute-force guard)     │  │
│  │   • Token Bucket Socket Guard  • Campus Wi-Fi IP Ceiling (300 sockets / IP)      │  │
│  └──────────────────────────────────────────┬───────────────────────────────────────┘  │
│                                             │                                          │
│         ┌───────────────────────────────────┴───────────────────────────────────┐      │
│         ▼                                                                       ▼      │
│  ┌───────────────────────────────┐                       ┌───────────────────────────┐ │
│  │       REST API Handlers       │                       │    WebSocket Gateways     │ │
│  │ • /api/auth (JWT + Google)    │                       │ • Handshake Auth & Dedupe │ │
│  │ • /api/rooms & /sessions      │                       │ • question:* broadcast    │ │
│  │ • /api/chapters & /quizzes    │                       │ • poll:* vote tallying    │ │
│  │ • Single Lifecycle Service    │                       │ • Decoupled Broadcast Mod │ │
│  └──────────────┬────────────────┘                       └─────────────┬─────────────┘ │
│                 │                                                      │               │
│                 │   ┌──────────────────────────────────────────────┐   │               │
│                 └──▶│          In-Memory Game State Machine        │◀──┘               │
│                     │  (Lobby ➔ Question ➔ Reveal ➔ Leaderboard)   │                   │
│                     │  • Server-Authoritative Timing (endsAt+now)  │                   │
│                     └──────────────────────┬───────────────────────┘                   │
└────────────────────────────────────────────┼───────────────────────────────────────────┘
                                             │ Mongoose ORM
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE & PERSISTENCE LAYER                              │
│                                      (MongoDB Atlas)                                   │
│                                                                                        │
│   ┌───────────────────────────┐  ┌───────────────────────────┐  ┌────────────────────┐ │
│   │          Users            │  │          Rooms            │  │      Sessions      │ │
│   │ • Bcrypt Password Hash    │  │ • 6-char Permanent PIN    │  │ • Keep-All History │ │
│   │ • Sparse Google OAuth ID  │  │ • Type: qa / mentor / quiz│  │ • Embedded Summary │ │
│   │ • .toPublic() Data Filter │  │ • { ownerId, type } Index │  │ • Frozen Snapshots │ │
│   └───────────────────────────┘  └───────────────────────────┘  └────────────────────┘ │
│   ┌───────────────────────────┐  ┌───────────────────────────┐  ┌────────────────────┐ │
│   │        Questions          │  │       Polls & Votes       │  │      Chapters      │ │
│   │ • Session/Room Pointers   │  │ • Compound Unique Index:  │  │ • Course Hierarchy │ │
│   │ • Upvote ID Array         │  │   (pollId, userId)        │  │ • Unique NameLower │ │
│   │ • Moderation Flags        │  │   One-Vote DB Guarantee   │  │ • Multi-Room Hub   │ │
│   └───────────────────────────┘  └───────────────────────────┘  └────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 4 Core Architectural Pillars (What to Explain)

### 🏛️ Pillar 1: Dual-Protocol Network Topology (REST + WebSockets)
* **REST for Heavy State & Initialization:**
  * Authentication, session creation, past analytics, and initial room metadata travel over standard HTTP with JSON payloads.
  * Fast Cold-Start: The landing page checks `GET /api/rooms/:code` to intelligently route users before opening any socket connection.
* **Socket.io for Sub-30ms Event Streaming:**
  * Once inside a room, all audience interactions (upvotes, poll responses, live questions) switch to WebSockets.
  * Room Isolation: Sockets are partitioned into dynamic rooms (`r:<code>`, `host:<code>`, `q:<code>:<clientId>`) to keep broadcast traffic localized.

---

### 🛡️ Pillar 2: Two-Tier Identity & Security Guard
* **Tier 1 — Authenticated Organizers & Mentors:**
  * Verified via JWT (stateless, stored in `localStorage` to eliminate cross-domain third-party cookie restrictions on Vercel/Render).
  * Socket handshake extracts `socket.handshake.auth.token` and attaches the validated `User` to `socket.data.user`.
* **Tier 2 — Anonymous High-Speed Quiz Players:**
  * Players join with only a room code and nickname (zero onboarding friction).
  * Unique `clientId` UUID stored in browser `localStorage` acts as a session restoration anchor if the user refreshes their mobile browser.
* **Campus Wi-Fi Defense:**
  * Traditional IP rate limiters block whole classrooms sharing a single NAT router. Askly utilizes **per-socket Token-Bucket rate limiters** (5 questions/min, 30 upvotes/min) and raises the IP ceiling to **300 sockets per IP**.

---

### ⚡ Pillar 3: Authoritative In-Memory State Machine
* **Anti-Cheat Timing Engine:**
  * Client countdown clocks are strictly aesthetic.
  * The server broadcasts `{ endsAt, serverNow }` timestamps to counteract device clock skew, and rejects late submissions with an authoritative `TIME_UP` error.
* **Zero-Leakage Question Obfuscation:**
  * Correct answer keys are held strictly in server memory during the active question phase and only transmitted to the client once the round moves to the `REVEAL` state.

---

### 💾 Pillar 4: The "Keep-Everything" Append-Only Data Model
* **Permanent Containers (`Room.js`) vs. Temporal Instances (`Session.js`):**
  * Rooms hold permanent 6-character PINs that never change across semesters.
  * Reopening a room spawns a new incremental `Session` while archiving previous questions and polls.
* **Polymorphic Embedded Analytics:**
  * Closing a room runs a parallel MongoDB aggregation pipeline (`$match`, `$group`, `$project`) to freeze an immutable `summary` document directly inside the `Session`, completely eliminating the need for relational SQL join tables.

---

## 3. Request-Response & Event Flow Examples

### Flow A: An Audience Member Upvotes a Question
```
1. User taps "▲ Upvote" in AudienceRoom.jsx
2. Socket emits: "question:upvote" { questionId }
3. Socket Gateway: Checks Token Bucket (max 30 upvotes/min)
4. QA Service: Atomic MongoDB update ($addToSet: { upvotes: userId })
5. Broadcast Module: Emits "question:updated" to room "r:<code>"
6. Client Reducer: Re-ranks question list in < 30ms across all attendee screens
```

### Flow B: A Host Launches & Concludes a Live Poll
```
1. Host clicks "Launch Poll" in PresenterDashboard.jsx
2. Server writes Poll { status: 'open' } & broadcasts "poll:created"
3. Audience submits vote ➔ Validated by Compound Index (pollId, userId)
4. Host clicks "End Session"
5. roomLifecycleService:
   ├── Auto-closes active polls
   ├── Runs buildQaSummary() aggregation across questions, polls, and voters
   └── Writes immutable summary onto Session { status: 'ended' }
```

---

## 4. Evaluator Speaking Script (1 Minute Walkthrough)

> *"Our architecture is designed around real-time concurrency and zero data loss.*
>
> *On the frontend, we use React 18 with Vite for instantaneous client routing and live Recharts visualizations.*
>
> *At the networking layer, we decouple REST from WebSockets: REST handles stateless authentication and room provisioning, while Socket.io streams live upvotes and poll tallies with sub-30ms latency.*
>
> *To guarantee fair live competitions, our Quiz Engine runs an authoritative in-memory state machine that synchronizes timestamps to eliminate device clock tampering.*
>
> *Finally, our MongoDB persistence tier separates permanent Room containers from temporal Sessions. This allows educators and speakers to close and reopen rooms over entire semesters while preserving full historical engagement analytics."*
