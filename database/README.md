# Database Structure

This directory contains the database schema, migrations, and seeders for Blue Print Financial.

## Directory Structure

```
server/
├── database/
│   └── schema.sql          # Initial database schema (run first)
├── migrations/             # Database migrations (schema changes)
│   └── 001_add_role_to_users.sql
└── seeders/                # Database seeders (initial data)
    ├── 001_admin_user.sql
    └── 002_system_settings.sql
```

## Setup Instructions

### 1. Create Database and Schema

First, run the main schema file to create all tables:

```bash
mysql -u root -p < server/database/schema.sql
```

Or using MySQL client:
```sql
source server/database/schema.sql;
```

### 2. Run Migrations

Run migrations in order to apply schema changes:

```bash
mysql -u root -p blueprint_financial < server/migrations/001_add_role_to_users.sql
```

Or using MySQL client:
```sql
USE blueprint_financial;
source server/migrations/001_add_role_to_users.sql;
```

### 3. Run Seeders

Run seeders to populate initial data:

```bash
# Seed admin user
mysql -u root -p blueprint_financial < server/seeders/001_admin_user.sql

# Seed system settings
mysql -u root -p blueprint_financial < server/seeders/002_system_settings.sql
```

Or using MySQL client:
```sql
USE blueprint_financial;
source server/seeders/001_admin_user.sql;
source server/seeders/002_system_settings.sql;
```

## Default Admin Credentials

After running the admin seeder, you can login with:

- **Email**: `admin@blueprintfinancial.ng`
- **Password**: `Admin@1234`

**⚠️ IMPORTANT**: Change the admin password immediately in production!

## File Naming Convention

- **Migrations**: `XXX_description.sql` (e.g., `001_add_role_to_users.sql`)
  - Migrations modify the database schema (ALTER TABLE, ADD COLUMN, etc.)
  - Should be run in order (001, 002, 003...)
  - Should be idempotent when possible (use IF NOT EXISTS, etc.)

- **Seeders**: `XXX_description.sql` (e.g., `001_admin_user.sql`)
  - Seeders populate initial data (INSERT statements)
  - Can be run multiple times safely (use ON DUPLICATE KEY UPDATE)
  - Should be run after migrations

## Adding New Migrations

1. Create a new file: `migrations/XXX_description.sql`
2. Use sequential numbering (next number after latest migration)
3. Write idempotent SQL when possible
4. Document what the migration does in comments

## Adding New Seeders

1. Create a new file: `seeders/XXX_description.sql`
2. Use sequential numbering
3. Use `ON DUPLICATE KEY UPDATE` to make seeders safe to run multiple times
4. Document default values and usage in comments

