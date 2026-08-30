/**
 * Seeder: Seed system settings
 * 
 * This seeder populates default system settings for loan rates and limits
 */

async function seed(connection) {
  await connection.execute(`
    INSERT INTO system_settings (setting_key, setting_value, description) VALUES
    ('small_business_interest_rate', '15.5', 'Default interest rate for small business loans (%)'),
    ('payday_interest_rate', '25.0', 'Default interest rate for payday loans (%)'),
    ('collateral_interest_rate', '12.0', 'Default interest rate for collateral loans (%)'),
    ('max_small_business_amount', '5000000', 'Maximum amount for small business loans (Naira)'),
    ('max_payday_amount', '500000', 'Maximum amount for payday loans (Naira)'),
    ('max_collateral_amount', '50000000', 'Maximum amount for collateral loans (Naira)'),
    ('processing_fee_rate', '2.5', 'Processing fee rate (%)'),
    ('admin_email', 'mubasharhanif24@gmail.com', 'Admin email for notifications'),
    ('stripe_webhook_secret', '', 'Stripe webhook secret for payment verification'),
    ('email_service_enabled', 'true', 'Enable/disable email notifications')
    ON DUPLICATE KEY UPDATE
      setting_value = VALUES(setting_value),
      description = VALUES(description)
  `);
}

module.exports = { seed };

