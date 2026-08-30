# Database Migrations

This directory contains database migrations - JavaScript files (.cjs) that modify the database schema.

## What are Migrations?

Migrations are version-controlled changes to your database schema. They allow you to:
- Track schema changes over time
- Apply changes consistently across environments
- Rollback changes if needed
- Automatically track which migrations have been executed

## Migration Files

- `000_initial_schema.cjs` - Creates all base tables (users, loan_applications, payments, etc.)
- `001_add_role_to_users.cjs` - Adds `role` column to users table for role-based access control
- `002_create_password_reset_tokens.cjs` - Creates password_reset_tokens table

## Running Migrations

### Run all pending migrations:
```bash
npm run migrate
```

Or directly:
```bash
node scripts/run-migrations.js
```

### How it works:

1. **Migration Tracking**: The system automatically creates a `migrations` table to track which migrations have been executed
2. **Idempotent**: Migrations are safe to run multiple times - already executed migrations are skipped
3. **Ordered Execution**: Migrations run in alphabetical/numerical order (000, 001, 002, etc.)
4. **Error Handling**: If a migration fails, the process stops and shows an error

## Migration File Structure

Each migration file must export an `up` function:

```javascript
async function up(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS my_table (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255)
    )
  `);
}

module.exports = { up };
```

## Best Practices

1. **Number sequentially**: Use `000_`, `001_`, `002_` prefix for ordering
2. **Be idempotent**: Use `IF NOT EXISTS`, `CREATE OR REPLACE`, etc. when possible
3. **Document changes**: Add comments explaining what the migration does
4. **Test first**: Always test migrations on a development database first
5. **One change per migration**: Keep migrations focused on a single change

## Migration Status

To check which migrations have been executed, query the migrations table:

```sql
SELECT * FROM migrations ORDER BY executed_at;
```
