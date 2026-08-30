# Database Setup Commands

## Quick Setup (All at once)

Run the complete setup script:

```bash
# Windows
cd server
setup-database.bat

# Or manually run each step below
```

## Manual Setup Steps

### Step 1: Create Database and Schema

```bash
mysql -u root -p < server/database/schema.sql
```

### Step 2: Run Migrations

```bash
# Single migration
mysql -u root -p blueprint_financial < server/migrations/001_add_role_to_users.sql

# Or use the batch file
cd server
run-migrations.bat
```

### Step 3: Run Seeders

```bash
# Run all seeders
mysql -u root -p blueprint_financial < server/seeders/001_admin_user.sql
mysql -u root -p blueprint_financial < server/seeders/002_system_settings.sql

# Or use the batch file
cd server
run-seeders.bat
```

## Individual Commands

### Run Single Migration

```bash
mysql -u root -p blueprint_financial < server/migrations/001_add_role_to_users.sql
```

### Run Single Seeder

```bash
# Admin user
mysql -u root -p blueprint_financial < server/seeders/001_admin_user.sql

# System settings
mysql -u root -p blueprint_financial < server/seeders/002_system_settings.sql
```

## Using MySQL Client

If you're using MySQL command line client:

```sql
-- Connect to MySQL
mysql -u root -p

-- Create database and schema
source server/database/schema.sql;

-- Run migrations
USE blueprint_financial;
source server/migrations/001_add_role_to_users.sql;

-- Run seeders
source server/seeders/001_admin_user.sql;
source server/seeders/002_system_settings.sql;
```

## Admin Credentials

After running seeders, you can login with:

- **Email**: `admin@blueprintfinancial.ng`
- **Password**: `Admin@1234`

⚠️ **Important**: Change the password in production!

