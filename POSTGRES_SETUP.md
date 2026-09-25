# PostgreSQL setup for Render

This project now uses PostgreSQL instead of SQLite. The server creates the `users` table automatically the first time it connects.

## 1. Create the database on Render

1. Open the Render dashboard and choose **New > PostgreSQL**.
2. Choose a database name, region, and plan.
3. After the database is created, open its **Info** page.
4. Copy the **Internal Database URL**. Use the internal URL when the web service and database are both on Render.

## 2. Configure the web service

Open the web service connected to this repository and set:

- Build command: `npm install`
- Start command: `npm start`

In **Environment > Environment Variables**, add:

```env
DATABASE_URL=postgresql://user:password@host/database
GEMINI_API_KEY=your_gemini_api_key
NODE_ENV=production
```

Use the actual PostgreSQL URL from Render. Do not commit it to GitHub.

## 3. Deploy

Save the environment variables and trigger a deploy. On startup, the server will:

1. Connect using `DATABASE_URL`.
2. Create the `users` table if it does not exist.
3. Start the Express web server.

The application data is stored in PostgreSQL and will survive web-service redeployments.

## Local development

Create a local `.env` file:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/htc_miniproject
GEMINI_API_KEY=your_gemini_api_key
```

Then run:

```bash
npm install
npm start
```

You can also use a hosted development database URL instead of installing PostgreSQL locally.

## Existing SQLite data

The new PostgreSQL database starts empty. Existing records in `database.sqlite` are not copied automatically. If the SQLite database already contains important users or projects, export and transform those records before switching production traffic to PostgreSQL.

## Troubleshooting

- `DATABASE_URL is required`: add `DATABASE_URL` to the Render web service environment variables.
- `PostgreSQL initialization failed`: verify the URL, database status, and network access.
- Do not use the Render web service filesystem for database storage; PostgreSQL is now the separate persistent database.
