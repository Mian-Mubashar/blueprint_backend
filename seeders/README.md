# Database Seeders

This directory contains database seeders - JavaScript files (.js) that populate initial data.

## What are Seeders?

Seeders are scripts that insert initial/default data into your database. They are used to:
- Create default admin users
- Populate system settings
- Add reference data
- Set up test data (in development)

## Seeder Files

- `001_admin_user.js` - Creates the default admin user
  - Email: `admin@blueprint.com`
  - Password: `Admin@123` (change in production!)
  
- `002_system_settings.js` - Populates default system settings
  - Loan interest rates
  - Maximum loan amounts
  - Processing fee rates
  - System configuration

## Running Seeders

### Run all seeders:
```bash
npm run seed
```

Or directly:
```bash
node scripts/run-seeders.js
```

### Run migrations and seeders together:
```bash
npm run db:reset
```

## How it works:

1. **Automatic Discovery**: The system finds all `.js` files in the seeders directory
2. **Ordered Execution**: Seeders run in alphabetical/numerical order (001, 002, etc.)
3. **Idempotent**: Seeders use `ON DUPLICATE KEY UPDATE` to be safe to run multiple times
4. **Error Handling**: If a seeder fails, the process stops and shows an error

## Seeder File Structure

Each seeder file must export a `seed` function:

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

## Best Practices

1. **Number sequentially**: Use `001_`, `002_`, `003_` prefix for ordering
2. **Be idempotent**: Use `ON DUPLICATE KEY UPDATE` to allow safe re-runs
3. **Document defaults**: Clearly document default values in comments
4. **Security**: Never commit production passwords or sensitive data
5. **Safe to re-run**: Seeders should be safe to run multiple times

## Important Notes

- **Admin Password**: The default admin password is `Admin@123` - **CHANGE THIS IN PRODUCTION!**
- **System Settings**: Default interest rates and limits can be modified after seeding
- **Idempotent Design**: All seeders are designed to be run multiple times safely
