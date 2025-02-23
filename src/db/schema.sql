-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    karma_score DECIMAL DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE
);

-- User profiles
CREATE TABLE profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    full_name VARCHAR(100),
    bio TEXT,
    location VARCHAR(100),
    profile_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8)
);

-- Skills/favors table
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    category VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    effort_time INTEGER, -- in minutes
    is_offering BOOLEAN DEFAULT TRUE, -- TRUE if offering, FALSE if seeking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ratings table
CREATE TABLE ratings (
    id SERIAL PRIMARY KEY,
    rater_id INTEGER REFERENCES users(id),
    rated_id INTEGER REFERENCES users(id),
    skill_id INTEGER REFERENCES skills(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add verification tokens table
CREATE TABLE verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    token VARCHAR(64) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'email', 'password-reset', etc.
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for token lookups
CREATE INDEX idx_verification_token ON verification_tokens(token);

-- Add index for cleanup of expired tokens
CREATE INDEX idx_verification_expires ON verification_tokens(expires_at);

-- Create indexes
CREATE INDEX idx_skills_user_id ON skills(user_id);
CREATE INDEX idx_ratings_rated_id ON ratings(rated_id);

-- Add index for location-based queries
CREATE INDEX idx_profiles_location ON profiles(latitude, longitude);

-- Add index for full-text search
-- Create a function to generate the search vector
CREATE OR REPLACE FUNCTION skills_search_vector(title TEXT, description TEXT, category TEXT) 
RETURNS tsvector AS $$
BEGIN
  RETURN setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
         setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
         setweight(to_tsvector('english', COALESCE(description, '')), 'C');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add column for search vector
ALTER TABLE skills ADD COLUMN search_vector tsvector;

-- Create index on the search vector
CREATE INDEX idx_skills_search ON skills USING gin(search_vector);

-- Create trigger to automatically update search vector
CREATE TRIGGER skills_search_vector_update
  BEFORE INSERT OR UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger(search_vector, 'pg_catalog.english', title, category, description);

-- Enable PostGIS extension for geographic calculations
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Reviews table for detailed feedback
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  reviewer_id INTEGER REFERENCES users(id),
  reviewed_id INTEGER REFERENCES users(id),
  skill_id INTEGER REFERENCES skills(id),
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reviewer_id, reviewed_id, skill_id)
);

-- Add index for faster lookups
CREATE INDEX idx_reviews_users ON reviews(reviewer_id, reviewed_id);
CREATE INDEX idx_reviews_skills ON reviews(skill_id);

-- Trust verification table
CREATE TABLE trust_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- 'id', 'address', 'professional', etc.
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  verification_data JSONB, -- Stores verification-specific data
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verification documents table
CREATE TABLE verification_documents (
  id SERIAL PRIMARY KEY,
  verification_id INTEGER REFERENCES trust_verifications(id),
  document_type VARCHAR(50) NOT NULL,
  document_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_trust_verifications_user ON trust_verifications(user_id);
CREATE INDEX idx_trust_verifications_status ON trust_verifications(status);
CREATE INDEX idx_verification_documents ON verification_documents(verification_id);

-- Reports table
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER REFERENCES users(id),
  reported_id INTEGER REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- 'user', 'skill', 'review', etc.
  target_id INTEGER NOT NULL, -- ID of the reported content
  reason VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'rejected'
  resolution_notes TEXT,
  resolved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Content moderation table
CREATE TABLE moderation_actions (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id),
  moderator_id INTEGER REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL, -- 'warning', 'suspension', 'ban', etc.
  reason TEXT NOT NULL,
  duration INTERVAL, -- For temporary actions
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_reported ON reports(reported_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_type_target ON reports(type, target_id);
CREATE INDEX idx_moderation_report ON moderation_actions(report_id); 