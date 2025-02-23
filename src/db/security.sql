-- Security events table
CREATE TABLE security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for event type and timestamp
CREATE INDEX idx_security_events_type_time ON security_events(event_type, created_at);

-- Session tracking table
CREATE TABLE sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  device_info JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for session queries
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_activity ON sessions(last_activity);

-- Security settings table
CREATE TABLE security_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret VARCHAR(64),
  backup_codes JSONB,
  login_notification_enabled BOOLEAN DEFAULT TRUE,
  suspicious_activity_notification_enabled BOOLEAN DEFAULT TRUE,
  allowed_ips JSONB,
  last_password_change TIMESTAMP,
  password_history JSONB,
  failed_login_attempts INTEGER DEFAULT 0,
  lockout_until TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IP blacklist table
CREATE TABLE ip_blacklist (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  reason VARCHAR(100),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ip_blacklist ON ip_blacklist(ip_address);

-- Device tracking table
CREATE TABLE user_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  device_id VARCHAR(64) NOT NULL,
  device_name VARCHAR(100),
  device_type VARCHAR(50),
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_trusted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_devices ON user_devices(user_id, device_id); 