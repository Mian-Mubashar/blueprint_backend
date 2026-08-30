const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDB() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'blueprint_financial'
    });
    try {
        console.log('Adding role column...');
        await pool.execute("ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER profile_picture;");
        console.log('✅ Added role column');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log('Role column already exists.');
        else console.error('ERROR1:', e.message);
    }

    try {
        console.log('Adding index...');
        await pool.execute("CREATE INDEX idx_role ON users(role);");
        console.log('✅ Added index');
    } catch (e) {
        console.error('ERROR2:', e.message);
    }

    try {
        console.log('Seeding settings...');
        await pool.execute(`INSERT INTO system_settings (setting_key, setting_value, description) 
                        VALUES ('base_interest_rate', '15', 'Default monthly interest rate percentage') 
                        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);`);
        console.log('✅ Settings seeded');
    } catch (e) {
        console.error('ERROR3:', e.message);
    }

    await pool.end();
}

fixDB().then(() => {
    console.log('Done.');
    process.exit(0);
});
