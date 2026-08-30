-- Blue Print Financial Ltd Database Schema
-- Created for financial services in Nigeria

CREATE DATABASE IF NOT EXISTS blueprint_financial;
USE blueprint_financial;

-- Users table for authentication and profile management
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Nigeria',
    bvn VARCHAR(11) UNIQUE,
    bank_account_number VARCHAR(20),
    bank_name VARCHAR(100),
    account_name VARCHAR(255),
    employment_status ENUM('employed', 'self-employed', 'unemployed', 'student', 'retired'),
    monthly_income DECIMAL(15,2),
    employer_name VARCHAR(255),
    job_title VARCHAR(255),
    employment_duration INT, -- in months
    is_verified BOOLEAN DEFAULT FALSE,
    verification_documents JSON,
    google_id VARCHAR(255) UNIQUE,
    profile_picture VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_bvn (bvn),
    INDEX idx_google_id (google_id)
);

-- Loan applications table
CREATE TABLE loan_applications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    loan_type ENUM('small_business', 'payday', 'collateral') NOT NULL,
    amount_requested DECIMAL(15,2) NOT NULL,
    loan_duration INT NOT NULL, -- in months
    purpose TEXT,
    monthly_repayment DECIMAL(15,2),
    interest_rate DECIMAL(5,2),
    status ENUM('pending', 'under_review', 'approved', 'rejected', 'disbursed', 'completed') DEFAULT 'pending',
    application_documents JSON,
    collateral_details JSON,
    business_details JSON,
    review_notes TEXT,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    disbursed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_loan_type (loan_type)
);

-- Payment records table
CREATE TABLE payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    loan_application_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_type ENUM('loan_repayment', 'processing_fee', 'late_fee', 'early_repayment') NOT NULL,
    payment_method ENUM('bank_transfer', 'card', 'cash', 'automatic_debit') NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    transaction_reference VARCHAR(255),
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_loan_application_id (loan_application_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

-- Contact form submissions
CREATE TABLE contact_submissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    status ENUM('new', 'in_progress', 'resolved') DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status)
);

-- System settings table
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Note: System settings are seeded via seeders/002_system_settings.sql
-- Run seeders after running this schema

-- Create indexes for better performance
CREATE INDEX idx_loan_applications_created_at ON loan_applications(created_at);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_contact_submissions_created_at ON contact_submissions(created_at);

-- Create a view for loan application summary
CREATE VIEW loan_application_summary AS
SELECT 
    la.id,
    la.user_id,
    CONCAT(u.first_name, ' ', u.last_name) as customer_name,
    u.email,
    u.phone,
    la.loan_type,
    la.amount_requested,
    la.loan_duration,
    la.monthly_repayment,
    la.interest_rate,
    la.status,
    la.created_at,
    la.approved_at,
    la.disbursed_at
FROM loan_applications la
JOIN users u ON la.user_id = u.id;

-- Create a view for payment summary
CREATE VIEW payment_summary AS
SELECT 
    p.id,
    p.loan_application_id,
    p.user_id,
    CONCAT(u.first_name, ' ', u.last_name) as customer_name,
    p.amount,
    p.payment_type,
    p.payment_method,
    p.status,
    p.payment_date,
    p.due_date,
    la.loan_type,
    la.amount_requested as loan_amount
FROM payments p
JOIN users u ON p.user_id = u.id
JOIN loan_applications la ON p.loan_application_id = la.id;



