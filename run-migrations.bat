@echo off
echo ========================================
echo Running Database Migrations
echo ========================================
echo.

echo Enter MySQL root password when prompted...
echo.

mysql -u root -p blueprint_financial < migrations\001_add_role_to_users.sql

if %errorlevel% == 0 (
    echo.
    echo ✅ Migration completed successfully!
) else (
    echo.
    echo ❌ Migration failed!
)

pause

