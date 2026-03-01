-- 001_users.sql: Users and role-based profiles
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  roles TEXT[] NOT NULL DEFAULT '{}',
  active_role VARCHAR(10) CHECK (active_role IN ('buyer', 'seller')),
  location VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT FALSE,
  is_suspended BOOLEAN DEFAULT FALSE
);

CREATE TABLE buyer_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  shipping_address JSONB,
  default_payment_method_token VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  total_won INT DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  feedback_score NUMERIC(3,2) DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE
);

CREATE TABLE seller_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  storefront_name VARCHAR(150),
  storefront_banner_url TEXT,
  description TEXT,
  total_sales INT DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  stripe_account_id VARCHAR(255),
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  is_verified_seller BOOLEAN DEFAULT FALSE
);
