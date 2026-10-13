# Askly — Software Development Life Cycle (SDLC) Guide

> **Presentation Hook for Judges:**  
> *"Askly followed an Agile, iterative SDLC model with continuous automated testing. We structured our development across six distinct phases—from requirement analysis and security threat modeling to continuous integration, load testing for campus Wi-Fi networks, and zero-downtime cloud deployment."*

---

## 1. Visual SDLC Lifecycle Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ASKLY SDLC WORKFLOW                                    │
│                                                                                        │
│   ┌────────────────────┐          ┌────────────────────┐          ┌──────────────────┐ │
│   │ 1. Requirements &  │ ───────▶ │ 2. Architecture &  │ ───────▶ │ 3. Iterative     │ │
│   │    Feasibility     │          │    System Design   │          │    Build Sprints │ │
│   │ • 3-Mode Vision    │          │ • Dual Protocols   │          │ • Sprint 1: Auth │ │
│   │ • Sub-30ms Latency │          │ • Schema Model     │          │ • Sprint 2: Q&A  │ │
│   │ • Zero App Install │          │ • Threat Modeling  │          │ • Sprint 3: Quiz │ │
│   └────────────────────┘          └────────────────────┘          └────────┬─────────┘ │
│                                                                            │           │
│   ┌────────────────────┐          ┌────────────────────┐                   │           │
│   │ 6. Maintenance &   │ ◀─────── │ 5. Deployment &    │ ◀─────────────────┘           │
│   │    Monitoring      │          │    DevOps Pipeline │          ┌──────────────────┐ │
│   │ • Health Checks    │          │ • Vercel (Client)  │ ◀─────── │ 4. Verification  │ │
│   │ • Memory Leak Guns │          │ • Render (Server)  │          │    & Testing     │ │
│   │ • Legacy Purging   │          │ • Atlas (Database) │          │ • 54 Vitest Suite│ │
│   └────────────────────┘          └────────────────────┘          │ • In-Memory DB   │ │
│                                                                   │ • Wi-Fi Sim      │ │
│                                                                   └──────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase-by-Phase Breakdown

### 📋 Phase 1: Requirement Analysis & Specification
* **Problem Identification:** Traditional classroom response tools (like Kahoot or Slido) either force attendees to download apps, mandate accounts for casual quizzes, or wipe session history between classes.
* **Core Requirements Defined:**
  1. **Three Operating Modes:** Speaker Q&A, Kahoot-style Quiz Arena, and Persistent Mentor Classrooms.
  2. **Latency Ceiling:** Live interactions (upvotes, poll votes) must broadcast in `< 30ms`.
  3. **Zero-Friction Access:** Quiz participants must join with just a 6-character room PIN and nickname without registration.
  4. **Strict Concurrency Limits:** Guarantee one vote per user at the database level.

---

### 📐 Phase 2: System Architecture & Threat Modeling
* **Architectural Decisions Logged (`DECISIONS.md`):**
  * **MERN Monorepo via npm Workspaces:** Orchestrated via `concurrently` so frontend and backend evolve together with shared linting and formatting.
  * **Dual Networking Model:** REST for initialization and heavy queries; Socket.io for low-overhead bi-directional streaming.
  * **"Keep-Everything" Data Architecture:** Split permanent Room entities from temporal Sessions to preserve historical data across semesters.
* **Security & Threat Analysis:**
  * Mitigated brute-force attacks via per-email login throttling and token-bucket socket limiters.
  * Neutralized account squatting during Google OAuth account linking.
  * Applied constant-time dummy bcrypt checks against timing-based user enumeration.

---

### 💻 Phase 3: Iterative Implementation (Build Sprints)
Development was divided into three modular full-stack sprints:

* **Sprint 1: Core Foundation & Identity (Person 1):**
  * Implemented JWT creation and Google OAuth 2.0 integration.
  * Created `Room.js`, `Session.js`, `User.js`, and `Chapter.js` Mongoose schemas.
  * Built client route protection (`<RequireAuth>`) and the unified `roomLifecycleService.js`.
* **Sprint 2: Live Q&A, Polling & Analytics (Person 2):**
  * Engineered Socket.io event gateways (`question:*`, `poll:*`).
  * Enforced database-level single voting with compound unique indexes `(pollId, userId)`.
  * Integrated real-time Recharts data visualization and the post-talk `SessionReport.jsx`.
* **Sprint 3: Gamified Quiz Engine & Anti-Spam (Person 3):**
  * Built the in-memory authoritative game state machine (`quizEngine.js`).
  * Engineered server-authoritative anti-cheat clocks (`{ endsAt, serverNow }`).
  * Built token-bucket rate limiters and configured campus Wi-Fi flood guards (300 sockets/IP).

---

### 🧪 Phase 4: Verification & Quality Assurance (Testing)
* **Automated Unit & Integration Testing:**
  * **Test Runner:** **Vitest** chosen over Jest for native ES Modules (`"type": "module"`) support.
  * **Supertest + Socket.io-Client:** Simulated multiple concurrent HTTP and WebSocket clients in memory.
  * **Isolated In-Memory Database:** Utilized `mongodb-memory-server` for our 54 automated tests, allowing the suite to execute in clean isolation without hitting production data.
* **Specialized Validation:**
  * **Campus Wi-Fi Load Simulation:** Validated 300+ socket handshakes originating from a single IP without triggering false-positive rate limit bans.
  * **Clock-Drift Testing:** Tested client devices with altered system clocks to confirm the server rejected late submissions with `TIME_UP`.

---

### 🚀 Phase 5: Deployment & DevOps Pipeline
* **Separation of Concerns:**
  * **Frontend (Client):** Deployed to **Vercel** as a high-performance Edge Static Single Page Application.
  * **Backend (Server):** Deployed to **Render** running Node.js 20+ with automated SSL termination and continuous git-triggered builds.
  * **Database (Persistence):** **MongoDB Atlas** running replica sets with automated indexing.
* **Cross-Origin Configuration:**
  * Strict CORS and Socket.io `origin` bindings linking the Vercel domain to the Render server.
  * Stateless JWT authentication passed via `Authorization: Bearer` to prevent third-party cross-domain cookie blocking.

---

### 🔄 Phase 6: Maintenance, Housekeeping & Evolution
* **Automated Data Maintenance:**
  * Scripted migration and cleanup tools (`purge-legacy-rooms.js`) to prune outdated pre-account test data.
* **Zero-Downtime Reconnect Recovery:**
  * Per-player socket rooms (`q:<code>:<clientId>`) allow players to seamlessly reconnect after mobile browser refreshes or network drops without losing leaderboard positions.
* **Observability:**
  * REST health check endpoint (`GET /api/health`) reporting system status, uptime, and Google OAuth readiness.

---

## 3. SDLC Matrix (At a Glance)

| Phase | Activities | Tools & Technologies Used | Output / Artifact |
|---|---|---|---|
| **1. Requirements** | User stories, use-case modeling, latency targets | Markdown specifications | Functional requirements list |
| **2. Design** | Schema modeling, network topology, threat analysis | Draw.io, ASCII diagrams | `DECISIONS.md`, `SYSTEM_ARCHITECTURE.md` |
| **3. Development** | Full-stack sprint implementation | React, Vite, Express, Socket.io, Mongoose | Monorepo codebase (`client/`, `server/`) |
| **4. Testing** | Unit tests, socket integration, in-memory DB tests | Vitest, Supertest, mongodb-memory-server | 54 Passing test suite |
| **5. Deployment** | CI/CD git integration, cloud hosting, CORS binding | Vercel, Render, MongoDB Atlas | Live production URLs |
| **6. Maintenance** | Migration scripts, health monitoring, error logging | Winston/Custom Logger, Node scripts | System health reports |

---

## 4. Evaluator Speaking Script (1 Minute Walkthrough)

> *"For Askly, we followed a structured Agile SDLC model.*
>
> *We started by identifying the major bottlenecks of current audience tools—namely app install friction, account requirements for students, and session data loss.*
>
> *During our Design and Threat Modeling phase, we decided on a dual-protocol topology (REST for static initialization, Socket.io for live events) and documented all architectural trade-offs in our decisions log.*
>
> *Development was split into three full-stack sprints across our team. For quality assurance, we utilized Vitest along with an in-memory MongoDB server to run our 54 automated integration tests.*
>
> *Finally, we established a modern CI/CD pipeline deploying our frontend to Vercel and our backend to Render, backed by production replica sets on MongoDB Atlas."*
