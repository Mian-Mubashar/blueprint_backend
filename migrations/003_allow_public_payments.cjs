/**
 * Allow public / guest payments to be stored.
 * - loan_application_id and user_id can be null
 * - payer_name / payer_email for guests
 * - payment_type includes 'other'
 */

async function dropForeignKeys(connection, table, column) {
  const [fks] = await connection.execute(
    `SELECT CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [table, column]
  );

  for (const fk of fks) {
    await connection.execute(
      `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``
    );
  }
}

async function columnNullable(connection, table, column) {
  const [cols] = await connection.execute(
    `SELECT IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );
  return cols[0]?.IS_NULLABLE === 'YES';
}

async function columnExists(connection, table, column) {
  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );
  return cols.length > 0;
}

async function up(connection) {
  if (!(await columnNullable(connection, 'payments', 'loan_application_id'))) {
    await dropForeignKeys(connection, 'payments', 'loan_application_id');
    await connection.execute(
      'ALTER TABLE payments MODIFY loan_application_id INT NULL'
    );
    await connection.execute(`
      ALTER TABLE payments
      ADD CONSTRAINT fk_payments_loan_application
      FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id) ON DELETE CASCADE
    `);
  }

  if (!(await columnNullable(connection, 'payments', 'user_id'))) {
    await dropForeignKeys(connection, 'payments', 'user_id');
    await connection.execute('ALTER TABLE payments MODIFY user_id INT NULL');
    await connection.execute(`
      ALTER TABLE payments
      ADD CONSTRAINT fk_payments_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `);
  }

  if (!(await columnExists(connection, 'payments', 'payer_name'))) {
    await connection.execute(
      'ALTER TABLE payments ADD COLUMN payer_name VARCHAR(255) NULL AFTER user_id'
    );
  }

  if (!(await columnExists(connection, 'payments', 'payer_email'))) {
    await connection.execute(
      'ALTER TABLE payments ADD COLUMN payer_email VARCHAR(255) NULL AFTER payer_name'
    );
  }

  await connection.execute(`
    ALTER TABLE payments
    MODIFY payment_type ENUM(
      'loan_repayment',
      'processing_fee',
      'late_fee',
      'early_repayment',
      'other'
    ) NOT NULL
  `);
}

module.exports = { up };
