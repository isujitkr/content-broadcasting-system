# 📡 Content Broadcasting System

A backend-only content broadcasting system for educational environments. Teachers upload subject-based content (images), the Principal approves it, and students receive the currently active content via a public live broadcast API with Redis-backed caching.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MySQL (mysql2) |
| Auth | JWT + bcrypt |
| File Upload | Multer (disk storage) → Cloudinary CDN |
| Caching | Redis (ioredis-compatible, `redis` v4) |
| Validation | express-validator |
| Rate Limiting | express-rate-limit |

---

## ⚡ Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/isujitkr/content-broadcasting-system.git
cd content-broadcasting-system
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Fill in MySQL, Cloudinary, and Redis credentials
```

### 3. Run Migrations & Seed
```bash
npm run db:migrate   # Creates all tables
npm run db:seed      # Seeds default subjects and demo users
```

### 4. Start Server
```bash
npm run dev    
```

> Redis is **optional** — if it is not running, the app falls back gracefully to hitting MySQL on every request. No crash, no code change needed.

---

## 🔑 Default Credentials (after seed)

| Role | Email | Password |
|---|---|---|
| Principal | principal@school.com | Principal@123 |
| Teacher 1 | teacher1@school.com | Teacher@123 |
| Teacher 2 | teacher2@school.com | Teacher@123 |
| Teacher 3 | teacher3@school.com | Teacher@123 |

---

## 📌 API Reference

All private endpoints require authentication via HTTP-only cookies.

After login, the server sets a secure cookie containing the JWT.
This cookie is automatically sent with subsequent requests.

> ⚠️ Make sure to enable `withCredentials: true` on the client side when making requests.

---

### Auth

### 🍪 Cookie Configuration

| Cookie | Description |
|--------|------------|
| token | HTTP-only JWT cookie used for authentication |

- `httpOnly: true`
- `secure: true`
- `sameSite: "strict"`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | ❌ | — | Register a new user |
| POST | `/api/auth/login` | ❌ | — | Login and receive JWT |
| GET | `/api/auth/me` | ✅ | Any | Get current user profile |

#### POST /api/auth/register
```json
{
  "name": "John Doe",
  "email": "john@school.com",
  "password": "Password@123",
  "role": "teacher"
}
```
> `role` must be `"teacher"` or `"principal"`.

#### POST /api/auth/login
```json
{
  "email": "teacher1@school.com",
  "password": "Teacher@123"
}
```

#### Response (login / register)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Teacher One",
      "email": "teacher1@school.com",
      "role": "teacher"
    }
  }
}
```

---

### Content — Teacher Actions

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/content/upload` | ✅ | Teacher | Upload new content |
| GET | `/api/content/my` | ✅ | Teacher | View own uploaded content |
| GET | `/api/content/subjects` | ✅ | Staff | List all available subjects |
| DELETE | `/api/content/:id` | ✅ | Teacher | Delete own content |

#### POST /api/content/upload
`Content-Type: multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | File | ✅ | JPG, PNG, or GIF only. Max 10 MB. |
| `title` | String | ✅ | 3–255 characters |
| `subject` | String | ✅ | e.g. `maths`, `science`, `english` |
| `description` | String | ❌ | Up to 2000 characters |
| `start_time` | ISO 8601 datetime | ❌ | When broadcasting should begin |
| `end_time` | ISO 8601 datetime | ❌ | When broadcasting should end |
| `rotation_duration` | Integer (minutes) | ❌ | How long this item shows per rotation slot. Default: 5 |

> ⚠️ **Important:** Without both `start_time` and `end_time`, content will **never** appear in live broadcasts even after approval.

**Upload flow (two-step):**
1. Multer receives the file and saves it temporarily to the server's local disk (`/uploads` folder).
2. The controller then calls `cloudinary.uploader.upload()` to push the file from disk to Cloudinary.
3. The local temp file is deleted from disk after a successful Cloudinary upload.
4. The Cloudinary CDN URL and `public_id` are stored in the database.

#### GET /api/content/my — Query Params
| Param | Values | Description |
|---|---|---|
| `status` | `pending` \| `approved` \| `rejected` | Filter by status |
| `subject` | e.g. `maths` | Filter by subject |
| `page` | integer ≥ 1 | Page number (default: 1) |
| `limit` | 1–100 | Results per page (default: 10) |

---

### Content — Principal Actions

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/content/all` | ✅ | Principal | All content with filters |
| GET | `/api/content/pending` | ✅ | Principal | Pending content only |
| GET | `/api/content/:id` | ✅ | Principal/Teacher | Get single content item |
| PATCH | `/api/content/:id/approve` | ✅ | Principal | Approve content |
| PATCH | `/api/content/:id/reject` | ✅ | Principal | Reject content with reason |
| DELETE | `/api/content/:id` | ✅ | Principal | Delete any content |
| GET | `/api/content/broadcast/overview` | ✅ | Principal | See all live broadcasts |

#### PATCH /api/content/:id/reject
```json
{
  "rejection_reason": "Image is blurry and not relevant to the subject matter."
}
```

#### GET /api/content/all — Query Params
| Param | Values | Description |
|---|---|---|
| `status` | `uploaded` \| `pending` \| `approved` \| `rejected` | Filter by status |
| `subject` | e.g. `science` | Filter by subject |
| `teacher_id` | UUID | Filter by a specific teacher |
| `page` | integer ≥ 1 | Page number |
| `limit` | 1–100 | Results per page |

---

### 🔴 Public Broadcast API (Students — No Auth)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/content/live/:teacherIdentifier` | ❌ | Currently active content for a teacher |

This is the endpoint students poll. It returns the content item that is currently "on air" for each subject, based on time-window gating and round-robin rotation.

**Responses are served from Redis cache** until the active rotation slot changes, keeping DB load minimal even under heavy student traffic.

#### Teacher Identifier — accepted formats

| Format | Example | Resolves to |
|---|---|---|
| UUID | `550e8400-e29b-41d4-...` | Teacher with that exact user ID |

#### Example Requests
```
GET /api/content/live/550e8400-e29b-41d4-a716-446655440000
GET /api/content/live/teacher1@school.com?subject=science
```

#### Response — Content is Live
```json
{
  "success": true,
  "available": true,
  "message": "Content is live",
  "teacher": {
    "id": "uuid",
    "name": "Teacher One"
  },
  "data": {
    "maths": {
      "id": "uuid",
      "title": "Chapter 3 Practice Questions",
      "description": "Algebra worksheet for class 8",
      "subject": "maths",
      "file_url": "https://res.cloudinary.com/<cloud>/image/upload/v1234/content-broadcasting/content_xyz.png",
      "file_type": "image/png",
      "teacher": { "id": "uuid", "name": "Teacher One" },
      "schedule": {
        "start_time": "2024-01-01T09:00:00.000Z",
        "end_time": "2024-01-01T17:00:00.000Z",
        "slot_duration_seconds": 300,
        "time_remaining_seconds": 183
      }
    },
    "science": {
      "id": "uuid",
      "title": "Photosynthesis Diagram",
      "subject": "science",
      "file_url": "https://res.cloudinary.com/...",
      "file_type": "image/jpeg",
      "teacher": { "id": "uuid", "name": "Teacher One" },
      "schedule": {
        "start_time": "2024-01-01T08:00:00.000Z",
        "end_time": "2024-01-01T18:00:00.000Z",
        "slot_duration_seconds": 600,
        "time_remaining_seconds": 412
      }
    }
  },
  "fetched_at": "2024-01-01T10:03:17.000Z",
  "timestamp": "2024-01-01T10:03:17.000Z"
}
```

#### Response — No Content Available
```json
{
  "success": true,
  "available": false,
  "message": "No content available",
  "data": null,
  "timestamp": "2024-01-01T10:03:17.000Z"
}
```

This response is returned in all edge cases:
- No approved content exists for the teacher
- Approved content exists but current time is outside `start_time`/`end_time`
- Teacher identifier does not match any user
- Invalid or unknown subject filter

---

### Users

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/users/teachers` | ✅ | Principal | List all teachers |
| GET | `/api/users/:id` | ✅ | Staff | Get user by ID |

> Teachers can only fetch their own profile via `/users/:id`. Principals can fetch any user.

---

## 🔄 Content Lifecycle

```
Teacher uploads file
        ↓
  [File saved to local disk by Multer]
        ↓
  [File uploaded to Cloudinary from disk]
        ↓
  [Local temp file deleted]
        ↓
   status = "pending"  ←──── stored in DB with Cloudinary URL
        ↓
   Principal reviews
       / \
      ↓   ↓
[approved] [rejected + rejection_reason]
      ↓
  Within start_time / end_time?
      ↓ YES
  🔴 LIVE — subject rotation active
  (Redis cached until slot boundary)
```

---

## ⏱ Scheduling & Rotation Logic

Each subject maintains an **independent rotation cycle per teacher**.  
The rotation is **anchored to the content's start time**, ensuring the cycle begins exactly when the scheduled content becomes active.

### Algorithm

```
start_time_ms = timestamp of the first scheduled content
elapsed_ms = max(0, current_time - start_time_ms) % total_cycle_ms
```

The system walks through content items in `rotation_order` (ascending), accumulating durations until the elapsed time is consumed. The content item that crosses the elapsed threshold is considered **currently active**.

### Why start-time anchored?

- Rotation begins **only when content becomes active**
- Aligns with real-world scheduling (e.g., class starts at 10:00 AM)
- No background jobs or cron required
- Stateless computation based on current time

### Example — Maths (3 items, 5 min each → 15-min cycle)

| Time | Active Content |
|------|--------------|
| 10:00 – 10:04 | Content A |
| 10:05 – 10:09 | Content B |
| 10:10 – 10:14 | Content C |
| 10:15 → loops | Content A again |

---

## ⚡ Redis Caching — Live Broadcast

The `/api/content/live/:teacher` endpoint is the highest-traffic route (all students polling it). Redis caches its result to avoid hitting MySQL on every request.

### Cache Keys

| Pattern | When used |
|---|---|
| `live:teacher:<teacherId>` | Request with no subject filter |
| `live:teacher:<teacherId>:sub:<subject>` | Request with `?subject=maths` |

### TTL Strategy — Smart Slot-Boundary Expiry

The cache TTL is set to `time_remaining_seconds` of the soonest-expiring slot, so the cache **automatically expires at the exact moment the active content would change**. There is no fixed polling interval.

```
TTL = min(time_remaining_seconds across all subjects)
    → floor at 5 seconds
    → cap at 300 seconds (safety net)
```

Empty responses (no content available) are cached for **10 seconds** to prevent DB stampede.

### Countdown Accuracy from Cache

Cached responses still show an accurate `time_remaining_seconds`. When a cached response is served, the system subtracts the elapsed seconds since it was cached:

```
time_remaining = cached_time_remaining - (now - cached_at_ms) / 1000
```

### Cache Invalidation

The cache is invalidated immediately (all keys for that teacher) whenever:

| Event | Trigger |
|---|---|
| Principal approves content | `invalidateTeacherCache(teacherId)` |
| Principal rejects content | `invalidateTeacherCache(teacherId)` |
| Content is deleted | `invalidateTeacherCache(teacherId)` |

### Graceful Degradation

If Redis is unavailable (not running, network error, etc.), the app **does not crash**. Every cache operation (`cacheGet`, `cacheSet`, `cacheDel`) silently catches errors and returns `null`. The request falls through to MySQL as if caching never existed.

---

## ⚙️ Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=content_broadcasting

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
PUBLIC_RATE_LIMIT_MAX=200
```

---

## 🗂 Database Schema

### users
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | UUID |
| name | VARCHAR(100) | |
| email | VARCHAR(150) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt, cost 12 |
| role | ENUM('principal','teacher') | |
| is_active | BOOLEAN | default TRUE |
| last_login_at | TIMESTAMP | nullable |
| created_at / updated_at | TIMESTAMP | auto-managed |

### content
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | UUID |
| title | VARCHAR(255) | required |
| description | TEXT | optional |
| subject | VARCHAR(100) | normalized to lowercase |
| file_url | VARCHAR(500) | Cloudinary CDN URL |
| cloudinary_public_id | VARCHAR(300) | used for deletion |
| file_type | VARCHAR(50) | image/jpeg, image/png, image/gif |
| file_size | INT | bytes |
| file_original_name | VARCHAR(255) | original filename |
| uploaded_by | VARCHAR(36) FK → users | |
| status | ENUM | uploaded → pending → approved/rejected |
| rejection_reason | TEXT | set on rejection |
| approved_by | VARCHAR(36) FK → users | nullable |
| approved_at | TIMESTAMP | nullable |
| rejected_by | VARCHAR(36) FK → users | nullable |
| rejected_at | TIMESTAMP | nullable |
| start_time | TIMESTAMP | teacher-defined broadcast window start |
| end_time | TIMESTAMP | teacher-defined broadcast window end |
| is_deleted | BOOLEAN | soft delete flag |
| created_at / updated_at | TIMESTAMP | auto-managed |

> `file_path` is **not stored** in the database. The local disk file is a temporary staging area only — it is deleted after Cloudinary upload succeeds.

### content_slots
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | UUID |
| subject | VARCHAR(100) UNIQUE | e.g. "maths" |
| display_name | VARCHAR(150) | e.g. "Mathematics" |
| description | TEXT | optional |
| is_active | BOOLEAN | |
| created_at / updated_at | TIMESTAMP | |

### content_schedule
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | UUID |
| content_id | VARCHAR(36) FK → content | |
| slot_id | VARCHAR(36) FK → content_slots | |
| rotation_order | INT | position in the rotation queue |
| duration | INT | minutes this item shows per slot |
| is_active | BOOLEAN | deactivated on reject/delete |
| created_at / updated_at | TIMESTAMP | |

UNIQUE KEY on `(content_id, slot_id)` — one schedule entry per content per subject.

---

## 🛡 Security Features

- **JWT authentication** on all private routes (Bearer token, verified on every request)
- **bcrypt** password hashing with cost factor 12
- **RBAC** — principal and teacher permissions strictly separated at middleware level
- **Input validation** via express-validator (type, length, format, cross-field rules)
- **Rate limiting** — auth routes: 10 req/15min | general: 100 req/15min | public broadcast: 200 req/15min
- **Soft deletes** — records are never hard-deleted; `is_deleted` flag preserves data integrity
- **No sensitive data exposed** — `password_hash` is never included in any API response
- **Cloudinary public_id isolation** — deletion uses stored `public_id`, never user-supplied input

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| express | HTTP framework |
| mysql2 | MySQL driver with promise support |
| redis | Redis client (v4) for caching |
| jsonwebtoken | JWT signing and verification |
| bcryptjs | Password hashing |
| multer | Multipart file handling, disk storage |
| cloudinary | Cloudinary SDK for upload and delete |\
| express-validator | Request validation |
| express-rate-limit | Rate limiting middleware |
| cors | Cross-origin request handling |
| uuid | UUID generation for primary keys |
| dotenv | Environment variable loading |
