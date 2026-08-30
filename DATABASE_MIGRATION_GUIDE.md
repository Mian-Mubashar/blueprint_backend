# Database Migration & Seeder Guide

## Quick Start

### First Time Setup (Fresh Database)

1. **Create the database** (if not exists):
```sql
CREATE DATABASE IF NOT EXISTS blueprint_financial;
```

2. **Run all migrations** (creates all tables):
```bash
npm run migrate
```

3. **Run all seeders** (populates initial data):
```bash
npm run seed
```

### Or Run Both Together:
```bash
npm run db:reset
```

## Commands

### Migrations
```bash
# Run all pending migrations
npm run migrate

# Or directly
node scripts/run-migrations.js
```

### Seeders
```bash
# Run all seeders
npm run seed

# Or directly
node scripts/run-seeders.js
```

### Both Together
```bash
# Run migrations then seeders
npm run db:reset
```

## How It Works

### Migrations System

1. **Migration Files**: All migrations are in `server/migrations/` with `.cjs` extension
2. **Tracking**: A `migrations` table automatically tracks which migrations have been executed
3. **Idempotent**: Already executed migrations are automatically skipped
4. **Ordered**: Migrations run in numerical order (000, 001, 002, etc.)

**Current Migrations:**
- `000_initial_schema.cjs` - Creates all base tables
- `001_add_role_to_users.cjs` - Adds role column to users
- `002_create_password_reset_tokens.cjs` - Creates password reset table

### Seeders System

1. **Seeder Files**: All seeders are in `server/seeders/` with `.js` extension
2. **Idempotent**: Uses `ON DUPLICATE KEY UPDATE` to be safe for multiple runs
3. **Ordered**: Seeders run in numerical order (001, 002, etc.)

**Current Seeders:**
- `001_admin_user.js` - Creates default admin user
- `002_system_settings.js` - Populates system settings

## File Structure

```
server/
├── migrations/
│   ├── 000_initial_schema.cjs
│   ├── 001_add_role_to_users.cjs
│   ├── 002_create_password_reset_tokens.cjs
│   └── README.md
├── seeders/
│   ├── 001_admin_user.js
│   ├── 002_system_settings.js
│   └── README.md
└── scripts/
    ├── run-migrations.js
    └── run-seeders.js
```

## Migration File Format

Each migration must export an `up` function:

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

## Seeder File Format

Each seeder must export a `seed` function:

```javascript
async function seed(connection) {
  await connection.execute(`
    INSERT INTO my_table (name, value) 
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE value = VALUES(value)
  `, ['name', 'value']);
}

module.exports = { seed };
```

## Environment Variables

Make sure your `.env` file has:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=blueprint_financial
DB_PORT=3306
```

## Troubleshooting

### Migration Already Executed
If you see "already executed (skipping)" - this is normal! The system tracks executed migrations.

### Database Connection Error
- Check your `.env` file has correct database credentials
- Make sure MySQL is running
- Verify the database exists

### Migration Fails
- Check the error message for specific issues
- Common issues: missing tables, duplicate columns, syntax errors
- Migrations are designed to be idempotent, so you can fix and re-run

## Production Deployment

1. **Backup your database first!**
2. Run migrations: `npm run migrate`
3. Run seeders: `npm run seed`
4. **Important**: Change the default admin password after first login!

## Notes

- All migrations and seeders are **idempotent** - safe to run multiple times
- The system automatically tracks executed migrations
- Old `.sql` files are kept for reference but not used by the new system
- The `schema.sql` file is now represented by `000_initial_schema.cjs`

