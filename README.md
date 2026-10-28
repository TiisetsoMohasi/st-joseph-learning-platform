# St. Joseph High School Learning Platform

A responsive React portal backed by an Express API and SQLite database for managing school learning resources, discussions, participants, and access policy.

## Sample cohort

The default database is initialized with a 48-account study cohort:

- 40 students
- 6 teachers
- 2 administrators

These role limits are enforced when administrators register users. Existing custom users are retained during the migration from the previous 30-teacher seed; the platform fills student sample slots up to 40.

## Development

Install dependencies and start the frontend and API together:

```sh
npm install
npm run dev
```

Open `http://localhost:8443` in your browser. The development command starts Vite on port `8443` and Express on port `3000`; Vite proxies `/api` requests to Express. Set `API_PORT` to use a different API port for both services.

For a production build served directly by Express, run `npm start`; it builds the React app and serves it on port `3000`.

## Sample sign-in accounts

These seeded accounts are for local demonstration:

| Role | Username | Password |
| --- | --- | --- |
| Administrator | `admin1` | `password` |
| Teacher | `teacher1@stjoseph.co.ls` | `teacher1@112` |
| Student | `student1@stjoseph.com` | `student1@112` |

Other seeded teacher and student accounts use the same numbered username and password pattern.
