# Blue Print Financial - Server Structure

## 📁 Directory Structure

```
server/
├── config/                    # Configuration files
│   └── database.js            # Database connection pool
│
├── database/                 # Database reference files
│   ├── schema.sql            # Original schema (reference only)
│   └── README.md             # Database documentation
│
├── migrations/               # Database migrations (.cjs files)
│   ├── 000_initial_schema.cjs           # Initial database schema
│   ├── 001_add_role_to_users.cjs        # Add role column to users
│   ├── 002_create_password_reset_tokens.cjs  # Password reset table
│   ├── README.md             # Migration documentation
│   └── .gitkeep              # Git tracking
│
├── seeders/                  # Database seeders (.js files)
│   ├── 001_admin_user.js     # Default admin user
│   ├── 002_system_settings.js # System settings
│   ├── README.md             # Seeder documentation
│   └── .gitkeep              # Git tracking
│
├── scripts/                  # Utility scripts
│   ├── run-migrations.js     # Migration runner
│   └── run-seeders.js        # Seeder runner
│
├── middleware/               # Express middleware
│   ├── auth.js               # JWT authentication
│   └── roles.js              # Role-based access control
│
├── routes/                   # API routes
│   ├── admin.js              # Admin routes
│   ├── auth.js               # Authentication routes
│   ├── contact.js            # Contact form routes
│   ├── loans.js              # Loan application routes
│   ├── payments.js           # Payment routes
│   └── users.js              # User routes
│
├── utils/                    # Utility functions
│   └── email.js              # Email service
│
├── index.js                  # Main server file
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables (not in git)
└── README.md                 # Project documentation
```

## 🗄️ Database Migrations

### Migration Files (`.cjs`)

All migrations are in `server/migrations/` directory:

1. **000_initial_schema.cjs**
   - Creates all base tables (users, loan_applications, payments, etc.)
   - Creates indexes and views
   - Must run first

2. **001_add_role_to_users.cjs**
   - Adds `role` column to users table
   - Creates index on role column

3. **002_create_password_reset_tokens.cjs**
   - Creates password_reset_tokens table
   - For forgot password functionality

### Running Migrations

```bash
npm run migrate
```

- Automatically tracks executed migrations
- Skips already executed migrations
- Runs in numerical order (000, 001, 002...)

## 🌱 Database Seeders

### Seeder Files (`.js`)

All seeders are in `server/seeders/` directory:

1. **001_admin_user.js**
   - Creates default admin user
   - Email: `admin@blueprint.com`
   - Password: `Admin@123`

2. **002_system_settings.js**
   - Populates system settings
   - Interest rates, loan limits, etc.

### Running Seeders

```bash
npm run seed
```

- Idempotent (safe to run multiple times)
- Uses `ON DUPLICATE KEY UPDATE`

## 🚀 Quick Start Commands

```bash
# Run migrations only
npm run migrate

# Run seeders only
npm run seed

# Run both (migrations then seeders)
npm run db:reset
```

## 📝 File Naming Conventions

### Migrations
- Format: `XXX_description.cjs`
- Example: `000_initial_schema.cjs`, `001_add_role.cjs`
- Must export `up` function

### Seeders
- Format: `XXX_description.js`
- Example: `001_admin_user.js`, `002_settings.js`
- Must export `seed` function

## 🔒 Security Notes

- Never commit `.env` file
- Change default admin password in production
- Use environment variables for sensitive data
- Migrations and seeders are idempotent

## 📚 Documentation Files

- `DATABASE_MIGRATION_GUIDE.md` - Complete migration guide
- `migrations/README.md` - Migration documentation
- `seeders/README.md` - Seeder documentation
- `PROJECT_STRUCTURE.md` - This file

