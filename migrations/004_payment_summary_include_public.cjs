/**
 * Show public/general payments in payment_summary (no loan required).
 */

async function up(connection) {
  await connection.execute(`
    CREATE OR REPLACE VIEW payment_summary AS
    SELECT 
      p.id,
      p.loan_application_id,
      p.user_id,
      COALESCE(
        NULLIF(TRIM(CONCAT(IFNULL(u.first_name, ''), ' ', IFNULL(u.last_name, ''))), ''),
        p.payer_name,
        'Guest'
      ) AS customer_name,
      p.amount,
      p.payment_type,
      p.payment_method,
      p.status,
      p.payment_date,
      p.due_date,
      la.loan_type,
      la.amount_requested AS loan_amount
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN loan_applications la ON p.loan_application_id = la.id
  `);
}

module.exports = { up };
