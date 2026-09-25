# HTC Mini Project

A Node.js and Express project portal with PostgreSQL storage and Hugging Face-powered assistance.

## Requirements

- Node.js 20 or newer
- A PostgreSQL database
- A Hugging Face API key

## Environment variables

Create a local `.env` file. Never commit it.

```env
DATABASE_URL=postgresql://user:password@host/database
HF_API_KEY=your_huggingface_token
HF_MODEL=meta-llama/Llama-3.1-8B-Instruct
NODE_ENV=development
```

For local development, use PostgreSQL's external connection URL or a local PostgreSQL database. For Render, use the database's internal connection URL in the web service environment variables.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

At startup, the server connects to PostgreSQL and creates the `users` table if it does not exist.

## Deploy on Render

Create a Render PostgreSQL database and a Render Web Service connected to this repository.

- Build command: `npm install`
- Start command: `npm start`

Add these variables to the Web Service under **Environment**:

```env
DATABASE_URL=your_render_internal_database_url
HF_API_KEY=your_huggingface_token
HF_MODEL=meta-llama/Llama-3.1-8B-Instruct
NODE_ENV=production
```

After saving the variables, deploy the latest commit. The application data is stored in PostgreSQL and survives web-service redeployments.

## Inspect the database

See [DATABASE_INSPECTION.md](DATABASE_INSPECTION.md) for `psql` commands to list tables, inspect the schema, and view saved users and projects.
