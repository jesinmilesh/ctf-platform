-- ============================================================================
-- XPLOITX // CYBER BATTLEFIELD
-- Relational Database Schema (PostgreSQL 14+)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COMPETITIONS
CREATE TABLE competitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tagline VARCHAR(255),
    description TEXT,
    status VARCHAR(30) DEFAULT 'LIVE', -- DRAFT, REGISTRATION, SCHEDULED, LIVE, PAUSED, ENDED, ARCHIVED
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    freeze_time TIMESTAMP WITH TIME ZONE,
    flag_prefix VARCHAR(50) DEFAULT 'XploitXβ{',
    flag_suffix VARCHAR(50) DEFAULT '}',
    max_team_size INT DEFAULT 4,
    dynamic_scoring BOOLEAN DEFAULT TRUE,
    scoring_decay INT DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TEAMS
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    access_code VARCHAR(100) NOT NULL,
    captain_id UUID,
    total_score INT DEFAULT 0,
    solves_count INT DEFAULT 0,
    first_bloods INT DEFAULT 0,
    last_score_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_disqualified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, name),
    UNIQUE(competition_id, slug)
);

-- 3. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) DEFAULT 'PLAYER', -- PLAYER, AUTHOR, MODERATOR, ADMIN, SUPER_ADMIN
    callsign VARCHAR(100),
    avatar VARCHAR(255),
    bio TEXT,
    affiliation VARCHAR(255),
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TEAM MEMBERS
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'MEMBER', -- CAPTAIN, MEMBER
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- 5. CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    color_accent VARCHAR(30) DEFAULT '#00ff9c',
    display_order INT DEFAULT 0,
    UNIQUE(competition_id, slug)
);

-- 6. CHALLENGES
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    mission_id VARCHAR(50) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    difficulty VARCHAR(30) DEFAULT 'MEDIUM', -- EASY, MEDIUM, HARD, INSANE
    base_points INT DEFAULT 500,
    minimum_points INT DEFAULT 100,
    decay_threshold INT DEFAULT 30,
    current_points INT DEFAULT 500,
    solve_count INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'LIVE', -- DRAFT, TESTING, SCHEDULED, PUBLISHED, LIVE, ARCHIVED
    has_instance BOOLEAN DEFAULT FALSE,
    instance_host VARCHAR(255),
    instance_port INT,
    instance_ttl_minutes INT DEFAULT 30,
    max_attempts INT DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, mission_id),
    UNIQUE(competition_id, slug)
);

-- 7. FLAGS
CREATE TABLE flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    flag_type VARCHAR(30) DEFAULT 'STATIC', -- STATIC, REGEX, DYNAMIC_HMAC
    flag_value TEXT NOT NULL,
    case_sensitive BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. CHALLENGE FILES
CREATE TABLE challenge_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    download_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. CHALLENGE HINTS
CREATE TABLE challenge_hints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    cost INT DEFAULT 50,
    order_index INT DEFAULT 1,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. SUBMISSIONS
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    submitted_flag TEXT NOT NULL,
    status VARCHAR(30) NOT NULL, -- CORRECT, INCORRECT, RATE_LIMITED, ALREADY_SOLVED
    points_awarded INT DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. SOLVES
CREATE TABLE solves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    points_awarded INT NOT NULL,
    is_first_blood BOOLEAN DEFAULT FALSE,
    solved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(challenge_id, team_id)
);

-- 12. FIRST BLOODS
CREATE TABLE first_bloods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID UNIQUE REFERENCES challenges(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. SCORE EVENTS
CREATE TABLE score_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    delta INT NOT NULL,
    resulting_score INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. ANNOUNCEMENTS
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    urgent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. CHALLENGE INSTANCES
CREATE TABLE challenge_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    container_id VARCHAR(100),
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL,
    status VARCHAR(30) DEFAULT 'RUNNING',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. AUDIT LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target VARCHAR(255),
    ip_address VARCHAR(45),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. PORT ALLOCATIONS
CREATE TABLE port_allocations (
    port INT PRIMARY KEY,
    instance_id UUID REFERENCES challenge_instances(id) ON DELETE CASCADE,
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. HINT REVEALS
CREATE TABLE hint_reveals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hint_id UUID REFERENCES challenge_hints(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    points_deducted INT NOT NULL DEFAULT 0,
    revealed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hint_id, team_id)
);

-- 19. SESSIONS
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. NOTIFICATIONS
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX idx_teams_score ON teams(competition_id, total_score DESC, last_score_update ASC);
CREATE INDEX idx_challenges_comp ON challenges(competition_id, status, category_id);
CREATE INDEX idx_submissions_lookup ON submissions(challenge_id, team_id, created_at DESC);
CREATE INDEX idx_solves_team ON solves(team_id, solved_at);
CREATE INDEX idx_port_allocations_instance ON port_allocations(instance_id);
CREATE INDEX idx_hint_reveals_team ON hint_reveals(team_id, hint_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

