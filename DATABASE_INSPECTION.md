# Inspecting the PostgreSQL database

The application stores users and project data in the PostgreSQL `users` table.

## Connect with `psql`

Install the PostgreSQL client if needed:

```bash
sudo apt-get update
sudo apt-get install -y postgresql-client
```

For a local terminal, use the Render **External Database URL**. The Render **Internal Database URL** is for the deployed Render Web Service.

```bash
psql "your_external_database_url"
```

You can also set the URL in the current terminal session first:

```bash
export DATABASE_URL="your_external_database_url"
psql "$DATABASE_URL"
```

Do not print the URL or commit it to Git.

## List tables

Inside `psql`:

```sql
\dt
```

## Inspect the users table

```sql
\d users
```

## View saved accounts

This does not expose password hashes:

```sql
SELECT id, name, email, created_at, updated_at
FROM users
ORDER BY created_at DESC;
```

## View saved project information

```sql
SELECT
  name,
  email,
  project_title,
  project_abstract,
  project_description,
  project_lit_survey,
  project_modules,
  updated_at
FROM users
ORDER BY updated_at DESC;
```

## Count records

```sql
SELECT COUNT(*) AS user_count
FROM users;
```

## Check whether a specific email exists

```sql
SELECT id, name, email, created_at
FROM users
WHERE email = 'user@example.com';
```

## Exit `psql`

```sql
\q
```

Never query or share the `password` column unless you are checking that it contains bcrypt hashes. Never store or log plain-text passwords.
