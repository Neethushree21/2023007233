# Stage 1

## Core Actions

1. Create Notification
2. Get Notifications
3. Get Unread Notifications
4. Mark Notification as Read
5. Delete Notification

## REST APIs

### Create Notification

POST /notifications

Request:

{
  "type": "Placement",
  "message": "Amazon Hiring"
}

Response:

{
  "id": "uuid",
  "status": "created"
}

### Get Notifications

GET /notifications

### Get Unread Notifications

GET /notifications/unread

### Mark as Read

PATCH /notifications/{id}/read

### Delete Notification

DELETE /notifications/{id}

## Real Time Notification Mechanism

Use WebSockets to push notifications instantly to connected users.

Benefits:
- Low latency
- Bi-directional communication
- Real-time delivery
# Stage 2

## Database Choice

PostgreSQL

Reasons:
- ACID compliance
- Reliable transactions
- Strong indexing support
- Scales well with partitioning

## Tables

Users

(id, name, email)

Notifications

(id, type, message, created_at)

UserNotifications

(user_id, notification_id, is_read, read_at)

## Indexes

CREATE INDEX idx_user_read
ON UserNotifications(user_id,is_read);

CREATE INDEX idx_created
ON Notifications(created_at);
# Stage 3

Current Query

SELECT *
FROM notifications
WHERE studentID = 1042
AND isRead = false
ORDER BY createdAt DESC;

Problems

- SELECT *
- Missing composite index
- Possible full table scan

Solution

CREATE INDEX idx_notifications
ON notifications(studentID,isRead,createdAt DESC);

Avoid indexing every column because:

- Increased storage
- Slower inserts
- Slower updates
# Stage 4

## Problem

Notifications are fetched on every page load causing excessive database reads.

## Solutions

### Redis Cache

Store:
- Unread notification count
- Recent notifications

Benefits:
- Reduces database load
- Faster response times

Tradeoff:
- Cache invalidation complexity

### Pagination

GET /notifications?page=1&limit=20

Benefits:
- Smaller result sets
- Faster queries

Tradeoff:
- Additional client-side handling

### Read Replicas

Use database replicas for read-heavy operations.

Benefits:
- Distributes load

Tradeoff:
- Replication lag

### Infinite Scrolling

Load notifications on demand instead of loading everything.

Benefits:
- Reduced network traffic
- Better user experience
# Stage 5

## Problems in Current Implementation

1. Sequential processing
2. Slow for 50,000 students
3. Failure in email service stops workflow
4. No retry mechanism
5. No scalability

## Improved Architecture

HR Request
    |
    v
Message Queue
    |
    +---- Email Worker
    |
    +---- Push Notification Worker
    |
    +---- Database Worker

Technologies:
- Kafka / RabbitMQ

## Reliability Improvements

### Retry Mechanism

Failed jobs are retried automatically.

### Dead Letter Queue

Failed messages after multiple retries are moved to DLQ.

### Idempotency

Duplicate notifications are prevented.

## Why DB and Email Should Not Be in One Transaction

Email APIs are external services.

Keeping DB transactions open while waiting for email responses:
- Increases latency
- Reduces throughput
- Causes lock contention

Instead:
- Save notification first
- Publish event to queue
- Workers process delivery asynchronously
Stage 6

Priority Inbox Design

To implement a Priority Inbox, notifications are ranked using a combination of notification type and recency.

Priority order:

1. Placement
2. Result
3. Event

Weights assigned:

- Placement = 3
- Result = 2
- Event = 1

Priority Score:

priorityScore = typeWeight + recency

Notifications are sorted in descending order of priority score and the top N notifications are displayed to the user.

Efficient Maintenance

As new notifications arrive continuously, re-sorting the entire notification list is inefficient.

A Min Heap of size N is maintained:

- Insert new notification.
- If heap size exceeds N, remove lowest-priority notification.
- Heap root always contains the lowest item among the current top N notifications.
- Complexity:
  - Insert: O(log N)
  - Remove: O(log N)
  - Retrieve Top N: O(N)

This allows efficient maintenance of Priority Inbox even with a large notification volume.

Advantages

- Fast retrieval of top notifications.
- Scales to millions of notifications.
- Supports configurable N values (Top 10, Top 15, Top 20).
- Combines business importance and recency.