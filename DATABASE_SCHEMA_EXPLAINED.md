# Database Schema Design — Presentation Guide

## 1. Why MongoDB for Askly? (Why Not SQL?)
> **The 30-Second Pitch for Evaluators:**
> 1. **High-Speed Real-Time Writes:** During live talks and quizzes, hundreds of audience members submit votes, upvotes, and questions simultaneously. MongoDB handles high-throughput document inserts without relational table-locking overhead.
> 2. **Native JSON Snapshots:** Each session stores dynamic end-of-talk analytics, poll results, and frozen quiz leaderboards as polymorphic JSON documents (`summary`, `quizSnapshot`), which would require 4–5 bloated join tables in SQL.
> 3. **Seamless Full-Stack MERN Alignment:** Our entire WebSocket and REST pipeline streams JSON from React to Node.js directly into MongoDB with zero data-mapping friction.

---

## 2. Core Models Breakdown (Crisp & Simple)

### 👤 Model 1: `User.js` (Identity & Dual-Auth)
Stores user credentials for speakers, educators, and organizers.

* **Key Fields:**
  * `email` — Unique, lowercased, and indexed. Used for login.
  * `passwordHash` — Encrypted using bcrypt (10 rounds). Omitted for Google OAuth users.
  * `googleId` — Google OAuth identifier. Has a **sparse unique index** so multiple null values (password users) don't conflict.
  * `name` & `avatarUrl` — Public presenter profile information.
* **Security Highlight to Mention:**
  * Has a `.toPublic()` method that automatically strips `passwordHash` and `googleId` so sensitive secrets are never sent to the client.

---

### 🚪 Model 2: `Room.js` (The Permanent Room Container)
Represents the permanent virtual room that hosts create and share.

* **Key Fields:**
  * `code` — Unique 6-character room PIN (e.g., `ASK-404`) used by attendees to join instantly.
  * `ownerId` — References the `User` who created the room.
  * `type` — Enum (`'qa'`, `'mentor'`, `'quiz'`). Tells the system which features to enable.
  * `status` — `'open'` or `'closed'`.
  * `currentSessionId` — References the currently active `Session` document.
  * `chapterId` — (Optional) Links a mentor room to a specific academic course/subject.
  * `settings.showAuthorNames` — Toggles question anonymity (`'host'` sees names, `'all'` attendees see names).
* **Presentation One-Liner:**
  > *"The Room is the permanent entity that never changes its code, while sessions represent individual meetings inside it."*

---

### ⏱️ Model 3: `Session.js` (Talk Instances & History)
Represents a single live talk, lecture, or quiz game within a Room.

* **Key Fields:**
  * `roomId` & `roomCode` — Links back to the parent Room.
  * `name` — Auto-generated or custom title (e.g., *"Lecture 14: Socket Optimization"*).
  * `status` — `'active'` while live, `'ended'` when the host closes the room.
  * `startedAt` & `endedAt` — Precise timestamps tracking session duration.
  * `summary` — An embedded analytics object written upon session closure (total questions asked, answered count, total votes, and unique participants).
  * `quizSnapshot` & `finalLeaderboard` — Freezes quiz questions and final podium ranks so future quiz edits never corrupt past match records.
* **Presentation One-Liner:**
  > *"Every time a host opens a room, a new Session is created. This enables our 'Keep-Everything' model: closing and reopening a room creates fresh sessions without deleting historical data."*

---

### 📚 Model 4: `Chapter.js` (Course & Subject Grouping)
Used by educators in Mentor Mode to organize multiple rooms into organized course curriculums.

* **Key Fields:**
  * `ownerId` — References the mentor/instructor.
  * `name` — Display name of the chapter (e.g., *"CS 301: Distributed Systems"*).
  * `nameLower` — Lowercase duplicate used for a **compound unique index** `(ownerId, nameLower)`. Prevents accidental duplicate chapter names per instructor.
  * `description` — Brief course overview or syllabus notes.
  * `archived` — Boolean flag allowing instructors to hide past semester courses without deleting records.
* **Presentation One-Liner:**
  > *"Chapters provide academic structure: one Chapter contains multiple Rooms (e.g., Labs, Lectures), and each Room retains full historical Sessions."*

---

## 3. How the 4 Models Connect (The Hierarchy)

```
[User] (Speaker / Instructor)
  │
  ├── owns ──▶ [Chapter] (e.g., "CS 301")
  │                 │
  │                 └── contains ──▶ [Room] (Permanent code: "ASK-892")
  │                                     │
  │                                     ├── Session 1 (Oct 10 - Closed, summary saved)
  │                                     ├── Session 2 (Oct 12 - Closed, summary saved)
  │                                     └── Session 3 (Today  - Active currentSessionId)
```

---

## 4. Evaluator Q&A Cheatsheet (Quick Answers)

* **Q: Why use compound indexes like `{ ownerId: 1, type: 1, chapterId: 1 }` on Room?**
  * *A:* "When an instructor opens their dashboard, the query filters by owner, type, and chapter simultaneously. The compound index satisfies this query in memory with zero table scanning."
* **Q: Why do you have both a `Room` and a `Session`? Why not just one model?**
  * *A:* "If room and session were the same table, closing a room would either overwrite previous talk analytics or require attendees to enter a brand-new room code every week. Separating them keeps the room code permanent while archiving every talk cleanly."
* **Q: What is a sparse unique index on `googleId`?**
  * *A:* "Normal unique indexes allow only one null value. A sparse index only indexes documents where `googleId` actually exists, allowing hundreds of regular password users without triggering duplicate key errors."
