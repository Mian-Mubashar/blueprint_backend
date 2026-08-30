@echo off
echo ========================================
echo Blue Print Financial - Database Setup
echo ========================================
echo.

echo Step 1: Creating database and schema...
echo Enter MySQL root password when prompted...
mysql -u root -p < database\schema.sql

if %errorlevel% == 0 (
    echo ✅ Schema created successfully!
) else (
    echo ❌ Schema creation failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Running migrations...
mysql -u root -p blueprint_financial < migrations\001_add_role_to_users.sql

if %errorlevel% == 0 (
    echo ✅ Migrations completed successfully!
) else (
    echo ❌ Migrations failed!
    pause
    exit /b 1
)

echo.
echo Step 3: Running seeders...
echo Running admin user seeder...
mysql -u root -p blueprint_financial < seeders\001_admin_user.sql

if %errorlevel% == 0 (
    echo ✅ Admin user seeder completed!
) else (
    echo ❌ Admin user seeder failed!
    pause
    exit /b 1
)

echo.
echo Running system settings seeder...
mysql -u root -p blueprint_financial < seeders\002_system_settings.sql

if %errorlevel% == 0 (
    echo ✅ System settings seeder completed!
) else (
    echo ❌ System settings seeder failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ Database setup completed successfully!
echo ========================================
echo.
echo Admin Login Credentials:
echo   Email: admin@blueprintfinancial.ng
echo   Password: Admin@1234
echo.
pause

