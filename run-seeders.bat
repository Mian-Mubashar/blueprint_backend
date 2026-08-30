@echo off
echo ========================================
echo Running Database Seeders
echo ========================================
echo.

echo Enter MySQL root password when prompted...
echo.

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
    echo.
    echo ========================================
    echo All seeders completed successfully!
    echo ========================================
) else (
    echo ❌ System settings seeder failed!
)

pause

