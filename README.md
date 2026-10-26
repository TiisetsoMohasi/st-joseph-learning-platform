# St. Joseph High School Learning Platform

A responsive React portal backed by an Express API and SQLite database for managing school learning resources, discussions, participants, and access policy.

## Sample cohort

The default database is initialized with a 48-account study cohort:

- 40 students
- 6 teachers
- 2 administrators

These role limits are enforced when administrators register users. Existing custom users are retained during the migration from the previous 30-teacher seed; the platform fills student sample slots up to 40.

## Development

Install dependencies and start the frontend and API in separate terminals:

```sh
npm install
npm run dev
```

```sh
npm run server
```

The Vite frontend runs on `http://localhost:8443` and proxies `/api` requests to the Express API on port `3000`.

For a production build served directly by Express, run `npm start`; this builds the React app and serves it on port `3000`.

## Sample sign-in accounts

These seeded accounts are for local demonstration:

| Role | Username | Password |
| --- | --- | --- |
| Administrator | `admin1` | `password` |
| Teacher | `teacher1@stjoseph.co.ls` | `teacher1@112` |
| Student | `student1@stjoseph.com` | `student1@112` |

Other seeded teacher and student accounts use the same numbered username and password pattern.
