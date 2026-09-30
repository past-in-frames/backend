# Past In Frames — API

Express + Prisma API that serves the published stories and backs the admin editor.

## Database

There is one database: production MySQL, running as a Coolify container on
`178.156.245.168`. It is **not** published on the public internet, so local
development reaches it through an SSH tunnel.

```bash
npm run db:tunnel          # opens it in the background
npm run db:tunnel:status   # "up (pid …)" or "down"
npm run db:tunnel:stop
npm run db:check           # confirms the connection and prints story counts
```

The tunnel looks up the MySQL container's current bridge IP over SSH and
forwards it to `127.0.0.1:13306`, which is what `DATABASE_URL` points at. The
container gets a new IP whenever Coolify restarts it, hence the lookup — if the
database becomes unreachable after a redeploy, run `db:tunnel:stop` then
`db:tunnel` again.

Overrides, if the server or key ever changes: `DB_TUNNEL_SSH_HOST`,
`DB_TUNNEL_SSH_KEY`, `DB_TUNNEL_PORT`.

In Coolify the API runs on the same Docker network, so `DATABASE_URL` there
should address the MySQL container directly on port 3306.

Schema changes are applied with `npm run db:migrate` (`prisma migrate deploy`).
Since there is no staging copy, review the generated SQL before running it.

## Running locally

```bash
cp .env.example .env   # fill in DATABASE_URL and the AWS values
npm install
npm run dev            # http://localhost:3023
```

## Endpoints

Public responses are cacheable and only ever include stories with
`status = published`.

| Method | Path                       | Notes                                   |
| ------ | -------------------------- | --------------------------------------- |
| GET    | `/api/health`              | Reports `503` when the database is down |
| GET    | `/api/stories`             | Optional `?category=` filter            |
| GET    | `/api/stories/categories`  | Published categories with counts        |
| GET    | `/api/stories/:slug`       | Full story with media and sources       |
| POST   | `/api/admin/login`         | Rate limited, returns a session token   |
| POST   | `/api/admin/logout`        | Revokes the current session             |
| GET    | `/api/admin/stories`       | Drafts included                         |
| POST   | `/api/admin/stories`       | Create                                  |
| PUT    | `/api/admin/stories/:slug` | Replace                                 |
| DELETE | `/api/admin/stories/:slug` | Delete                                  |
| POST   | `/api/admin/uploads`       | Multipart image upload to S3            |

Admin routes expect `Authorization: Bearer <token>`; sessions last 12 hours and
only their SHA-256 hash is stored.

## Admin password

One shared password, stored as a scrypt hash. To change it:

```bash
ADMIN_PASSWORD='…' npm run admin:password
```

This signs out every existing session. Never commit the password or its hash.
