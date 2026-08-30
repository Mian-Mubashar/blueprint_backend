# Migration Instructions

## ⚠️ Important: Use Custom Migration Runner

This project uses a **custom migration system** with raw MySQL queries, NOT Sequelize ORM.

### ✅ Correct Way to Run Migrations:

```bash
npm run migrate
```

OR

```bash
node scripts/run-migrations.js
```

### ❌ DO NOT USE:

```bash
npx sequelize-cli db:migrate  # This will NOT work!
```

## Why?

- This project uses raw MySQL queries with `mysql2` package
- Sequelize CLI expects Sequelize ORM format migrations
- Custom migration runner is already configured and working

## Migration Files Location

All migrations are in `migrations/` directory with `.cjs` extension:
- `000_initial_schema.cjs`
- `001_add_role_to_users.cjs`
- `002_create_password_reset_tokens.cjs`

## Running Seeders

After migrations, run seeders:

```bash
npm run seed
```

OR run both together:

```bash
npm run db:reset
```
