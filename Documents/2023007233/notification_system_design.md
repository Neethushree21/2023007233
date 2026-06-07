# Notification System Design

---

## Stage 1

### Overview

This document describes the REST API contract for a campus notification platform that delivers real-time updates about Placements, Events, and Results to students.

---

### Core Actions

| Action | Description |
|---|---|
| Fetch all notifications for a student | Paginated list of all notifications |
| Fetch unread notifications | Only unread items |
| Mark a notification as read | Single or bulk |
| Delete a notification | Soft delete |
| Push a new notification | Triggered by admin/HR |
| Subscribe to real-time updates | WebSocket or SSE handshake |

---

### Endpoints

#### 1. Get All Notifications

```
GET /api/v1/notifications
```

**Headers**

```json
{
  "Authorization": "Bearer <token>",
  "X-Student-ID": "1042",
  "Accept": "application/json"
}
```

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| page | integer | No | Page number (default 1) |
| limit | integer | No | Items per page (default 20) |
| type | string | No | Filter by type: Placement, Result, Event |
| isRead | boolean | No | Filter read/unread |

**Response 200**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "d146095a-ed86-4a34-9669-3900814576bc",
        "studentId": "1042",
        "type": "Placement",
        "message": "Google SDE hiring — apply by May 5",
        "isRead": false,
        "createdAt": "2026-04-22T17:51:18Z",
        "updatedAt": "2026-04-22T17:51:18Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 150,
      "totalPages": 8
    }
  }
}
```

---

#### 2. Get Unread Notification Count

```
GET /api/v1/notifications/unread-count
```

**Headers**

```json
{
  "Authorization": "Bearer <token>",
  "X-Student-ID": "1042"
}
```

**Response 200**

```json
{
  "success": true,
  "data": { "unreadCount": 12 }
}
```

---

#### 3. Mark Notification(s) as Read

```
PATCH /api/v1/notifications/read
```

**Headers**

```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

**Request Body**

```json
{
  "notificationIds": [
    "d146095a-ed86-4a34-9669-3900814576bc",
    "b283218f-ea5a-4b7c-93a9-1f2f240d64be"
  ]
}
```

**Response 200**

```json
{
  "success": true,
  "data": { "updatedCount": 2 }
}
```

---

#### 4. Delete a Notification

```
DELETE /api/v1/notifications/:id
```

**Headers**

```json
{
  "Authorization": "Bearer <token>",
  "X-Student-ID": "1042"
}
```

**Response 200**

```json
{
  "success": true,
  "data": { "message": "Notification deleted successfully" }
}
```

---

#### 5. Create Notification (Admin/HR)

```
POST /api/v1/notifications
```

**Headers**

```json
{
  "Authorization": "Bearer <admin-token>",
  "Content-Type": "application/json"
}
```

**Request Body**

```json
{
  "type": "Placement",
  "message": "Amazon SDE 2026 drive — register by April 30",
  "targetStudentIds": ["1042", "1043"],
  "broadcastAll": false
}
```

**Response 201**

```json
{
  "success": true,
  "data": {
    "jobId": "job-8821",
    "message": "Notification dispatch queued",
    "recipientCount": 2
  }
}
```

---

### Real-Time Mechanism

**Choice: Server-Sent Events (SSE)**

SSE is chosen over raw WebSockets for one-directional push (server → client) because it:
- Works over plain HTTP/1.1 — no protocol upgrade overhead
- Auto-reconnects natively in browsers
- Simpler server infrastructure (no socket server needed)

```
GET /api/v1/notifications/stream
```

**Headers**

```json
{
  "Authorization": "Bearer <token>",
  "X-Student-ID": "1042",
  "Accept": "text/event-stream",
  "Cache-Control": "no-cache"
}
```

**Server pushes events in this format:**

```
event: notification
data: {"id":"d146095a","type":"Placement","message":"Google hiring","createdAt":"2026-04-22T17:51:18Z"}

event: ping
data: {"timestamp":"2026-04-22T17:52:00Z"}
```

The client opens this endpoint once on login and keeps the connection alive. Pings every 30 seconds prevent proxy timeouts.

---

## Stage 2

### Recommended Database: PostgreSQL

**Rationale**

| Factor | Reasoning |
|---|---|
| Structured data | Notifications have a fixed, well-defined schema |
| ACID compliance | Read/write consistency matters — a student must not see a notification twice or miss a mark-as-read |
| Rich querying | Complex filters (by type, date range, read status) are trivially expressed in SQL |
| Scalability path | PostgreSQL supports partitioning, read replicas, and connection pooling (PgBouncer) — all relevant as the dataset grows |

A document store (MongoDB) would work too, but offers no meaningful advantage here since the data shape is consistent and relational joins (student ↔ notification) are straightforward.

---

### Schema

```sql
CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

CREATE TABLE students (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120)        NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id           UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   INTEGER             NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type         notification_type   NOT NULL,
  message      TEXT                NOT NULL,
  is_read      BOOLEAN             NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ                  -- soft delete
);
```

---

### Scale Problems and Solutions

| Problem | Cause | Solution |
|---|---|---|
| Slow unread queries | Full table scan as rows grow into millions | Composite index on `(student_id, is_read, created_at DESC)` |
| Write bottleneck during bulk send | 50 k inserts in a tight loop | Async job queue (BullMQ / RabbitMQ) + batch INSERT |
| Hot rows | Popular students' rows locked frequently | Row-level locking is fine in Postgres; add read replicas for reads |
| Table bloat | Deleted/old rows never purged | Partition by `created_at` (monthly); archive or drop old partitions |
| Connection exhaustion | Thousands of SSE connections hammering DB | PgBouncer connection pool; cache unread counts in Redis |

---

### Queries

```sql
-- Fetch paginated notifications for a student
SELECT id, type, message, is_read, created_at
FROM notifications
WHERE student_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- Fetch unread notifications for a student
SELECT id, type, message, created_at
FROM notifications
WHERE student_id = $1
  AND is_read = FALSE
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- Unread count
SELECT COUNT(*) AS unread_count
FROM notifications
WHERE student_id = $1
  AND is_read = FALSE
  AND deleted_at IS NULL;

-- Mark notifications as read
UPDATE notifications
SET is_read = TRUE, updated_at = NOW()
WHERE id = ANY($1::uuid[])
  AND student_id = $2;

-- Soft delete
UPDATE notifications
SET deleted_at = NOW()
WHERE id = $1
  AND student_id = $2;

-- Bulk insert (admin broadcast)
INSERT INTO notifications (student_id, type, message)
SELECT unnest($1::int[]), $2::notification_type, $3;
```

---

## Stage 3

### Query Accuracy

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

The query is **logically correct** but has two issues:

1. **Column name casing** — PostgreSQL lowercases unquoted identifiers. The columns are likely `student_id`, `is_read`, and `created_at` (snake_case) based on standard convention. The query would fail with "column not found" unless those camelCase names were explicitly used at creation time.

2. **No index** — Without an index, the database performs a sequential scan across all 5 million rows, filtering for `student_id = 1042` and `is_read = false`. With 50,000 students this is roughly 100 rows per student on average, but the scan touches every row before filtering.

---

### Why It Is Slow

- **Sequential scan (Seq Scan)**: Postgres reads every row in the `notifications` table.
- At 5 million rows this means significant I/O even if only 100 rows match.
- The `ORDER BY created_at DESC` requires sorting those matches (minor, but adds cost without an index).

---

### Fix

```sql
-- Create a partial, composite index covering the exact query pattern
CREATE INDEX idx_notifications_student_unread
ON notifications (student_id, created_at DESC)
WHERE is_read = FALSE AND deleted_at IS NULL;
```

**Why this index?**

- `student_id` is the equality predicate — it comes first.
- `created_at DESC` satisfies the ORDER BY without an extra sort step.
- The `WHERE` clause makes it a **partial index** — it only indexes unread, non-deleted rows, keeping the index small.

**Computation cost after index:**

| Step | Before | After |
|---|---|---|
| Rows examined | ~5,000,000 | ~100 (index seek) |
| Sort | In-memory sort of ~100 rows | Eliminated (index order) |
| Plan type | Seq Scan | Index Scan |
| Estimated cost | O(N) | O(log N + k) where k = matching rows |

---

### "Index Every Column" Advice

**This is bad advice.** Each index:

- Adds overhead to every `INSERT`, `UPDATE`, and `DELETE` (the index must be maintained).
- Consumes disk space.
- Can confuse the query planner into choosing a suboptimal plan when many indexes exist.

Indexes should be added deliberately, targeting the columns that appear in `WHERE`, `ORDER BY`, and `JOIN` clauses of slow queries.

---

### Query: Placement Notifications in Last 7 Days

```sql
SELECT DISTINCT s.id AS student_id, s.name, s.email
FROM students s
JOIN notifications n ON n.student_id = s.id
WHERE n.type = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days'
  AND n.deleted_at IS NULL;
```

---

## Stage 4

### Problem

Fetching all notifications from the database on every page load for 50,000 concurrent students creates:
- Thousands of identical or near-identical DB queries per second
- High read latency under peak load (placement season)
- DB CPU/IO saturation

---

### Strategies

#### Strategy 1 — Redis Cache for Unread Count and Recent Notifications

Cache the unread count and the first page of notifications per student in Redis with a short TTL (e.g., 30–60 seconds).

```
Key: notifications:student:{id}:unread_count   TTL: 30s
Key: notifications:student:{id}:page:1         TTL: 30s
```

On a `PATCH /read` or new notification push, invalidate or update the relevant keys.

**Tradeoffs**

| Pro | Con |
|---|---|
| Eliminates DB hits for repeated loads | Slight staleness (up to TTL) |
| Near-instant response for popular students | Cache invalidation complexity |
| Redis handles 100k+ ops/sec easily | Extra infrastructure to manage |

---

#### Strategy 2 — Database Read Replicas

Route all `SELECT` queries to one or more read replicas; keep writes on the primary.

**Tradeoffs**

| Pro | Con |
|---|---|
| Scales reads horizontally | Replication lag (typically < 1s) |
| No application-level cache logic | More infra cost |
| Consistent data (no TTL staleness) | Does not eliminate the query itself |

---

#### Strategy 3 — Cursor-Based Pagination

Replace `OFFSET`-based pagination with cursor-based (`WHERE created_at < $cursor ORDER BY created_at DESC LIMIT 20`). Avoids deep-offset performance degradation.

**Tradeoffs**

| Pro | Con |
|---|---|
| O(log N) per page regardless of depth | Cannot jump to arbitrary pages |
| Works well with index | Front-end must track cursor |

---

#### Strategy 4 — Push Unread Count via SSE / WebSocket

Instead of fetching the count on every page load, maintain the count client-side and only push deltas over the open SSE stream when a new notification arrives.

**Tradeoffs**

| Pro | Con |
|---|---|
| Zero DB reads for count updates | Requires SSE/WS infrastructure |
| Real-time accuracy | Client state can desync (handled by reconnect re-fetch) |

---

### Recommended Combination

For most campus-scale deployments: **Redis cache (Strategy 1) + cursor pagination (Strategy 3)**. Add read replicas (Strategy 2) only if the cache hit rate drops below ~80%.

---

## Stage 5

### Shortcomings of the Proposed Implementation

```python
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)    # Email API call
        save_to_db(student_id, message)    # DB insert
        push_to_app(student_id, message)   # real-time push
```

1. **Synchronous serial loop** — processes 50,000 students one at a time. Even at 50 ms per student, that is 2,500 seconds (~42 minutes) for the full batch.
2. **No atomicity** — if `send_email` succeeds but `save_to_db` fails, the student gets an email but no in-app notification, and the system has no record.
3. **No retry logic** — a transient email API failure (as happened for the 200 students) is silently lost.
4. **No observability** — the loop has no checkpointing, so on restart the entire batch restarts from the beginning.
5. **Coupled operations** — email send and DB persist are not independent; a slow email provider blocks DB writes for subsequent students.

---

### Handling the 200 Failed Emails

Because there is no retry mechanism, those 200 students simply did not receive their email. The system has no record of which students failed.

**Immediate remediation:**
- Identify the 200 students from the email provider's bounce/failure report.
- Re-enqueue those 200 IDs for email retry with exponential backoff.

---

### Should DB Save and Email Send Happen Together?

**No.** They are independent side effects with different failure modes:

- The DB record is the source of truth for the in-app notification; it must persist regardless of the email outcome.
- The email is a best-effort delivery channel.

Coupling them means an email API outage blocks the creation of in-app notifications — which are delivered via a completely different path.

---

### Redesigned Implementation

```python
# STEP 1 — HR triggers broadcast
function notify_all(student_ids: array, message: string):
    job_id = generate_uuid()
    
    # Persist a broadcast job record for observability and resumability
    save_broadcast_job(job_id, student_ids, message, status="PENDING")
    
    # Enqueue a single fan-out task — return immediately to caller
    enqueue_job("fanout_notifications", {
        job_id: job_id,
        student_ids: student_ids,
        message: message
    })
    
    log.info("Broadcast job enqueued", { job_id, recipient_count: len(student_ids) })
    return { job_id, status: "queued" }


# STEP 2 — Worker picks up the fan-out job (runs asynchronously)
function handle_fanout(job):
    chunks = split_into_chunks(job.student_ids, size=500)
    
    for chunk in chunks:
        enqueue_job("process_notification_chunk", {
            job_id: job.job_id,
            student_ids: chunk,
            message: job.message
        })


# STEP 3 — Chunk worker processes one batch of 500 students
function handle_chunk(job):
    notifications = []
    
    for student_id in job.student_ids:
        notifications.append({
            student_id: student_id,
            message: job.message,
            type: "Placement",
            is_read: false,
            created_at: now()
        })
    
    # Bulk-insert all 500 rows in a single DB transaction
    bulk_insert_notifications(notifications)              # O(1) round trip
    log.info("DB insert complete", { chunk_size: len(notifications) })
    
    # Push in-app notifications via SSE/WebSocket broker
    for n in notifications:
        push_to_app(n.student_id, n.message)             # non-blocking publish
    
    # Enqueue email sends as separate, independently retriable tasks
    for student_id in job.student_ids:
        enqueue_job("send_email", {
            student_id: student_id,
            message: job.message,
            job_id: job.job_id,
            attempt: 1
        })


# STEP 4 — Email worker with retry
function handle_send_email(job):
    try:
        send_email(job.student_id, job.message)
        mark_email_sent(job.job_id, job.student_id)
        log.info("Email sent", { student_id: job.student_id })
    except EmailAPIError as e:
        log.warn("Email failed", { student_id: job.student_id, attempt: job.attempt, error: e })
        if job.attempt < MAX_RETRIES:                   # e.g. MAX_RETRIES = 5
            delay = exponential_backoff(job.attempt)
            enqueue_job_with_delay("send_email", {
                ...job,
                attempt: job.attempt + 1
            }, delay)
        else:
            mark_email_failed(job.job_id, job.student_id)
            log.error("Email permanently failed", { student_id: job.student_id })
```

**Key improvements**

| Concern | Old | New |
|---|---|---|
| Speed | Serial, ~42 min | Parallel chunks, ~10–30 s |
| Email failure | Silent loss | Retry with exponential backoff, dead-letter queue |
| DB + email coupling | Coupled | Decoupled — DB write always succeeds first |
| Observability | None | Broadcast job record tracks per-student status |
| Resumability | Restart from scratch | Job queue retries only failed chunks |

---

## Stage 6

### Approach

**Goal:** given a live stream of incoming notifications, always maintain the top-N by a composite priority score, retrievable in O(N log N) time.

**Priority Score Formula**

```
score = typeWeight × e^(−λ × ageInMinutes)
```

where:
- `typeWeight`: Placement = 3, Result = 2, Event = 1
- `λ = ln(2) / halfLifeMinutes` — the score decays to half after `halfLifeMinutes` (set to 60 in the implementation)

This rewards both notification type importance and recency in a single scalar value.

**Data Structure: Fixed-Size Min-Heap**

A min-heap of capacity N maintains exactly the top-N at all times:
- **Insert**: O(log N) — push, then pop the minimum if size exceeds N
- **Read top-N**: O(N log N) — sort a copy of the heap array

When a new notification arrives:
1. Compute its score.
2. If the heap has fewer than N items, push unconditionally.
3. If the heap is full, compare the new score against the current minimum:
   - New score > minimum → evict the minimum, push the new item.
   - New score ≤ minimum → discard (it would not make the top-N anyway).

This means maintaining the top-N as new notifications stream in costs only **O(log N) per event**, with no need to re-sort the entire collection.

**Implementation**: see `campus-notifications/stage6/priorityInbox.js`
