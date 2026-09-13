-- ============================================================================
-- XPLOITX // CYBER BATTLEFIELD
-- Initial Database Seed (database/seeds/initial_seed.sql)
-- ============================================================================

-- 1. COMPETITION
INSERT INTO competitions (id, slug, name, tagline, description, status, start_time, end_time, flag_prefix, flag_suffix, max_team_size, dynamic_scoring, scoring_decay)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'xploitx-2026',
    'XPLOITX 2.0 BETA',
    'ENTER THE DIGITAL BATTLEFIELD',
    '24-Hour elite cybersecurity capture the flag competition. Secure flags, breach targets, dominate the leaderboard.',
    'LIVE',
    NOW() - INTERVAL '6 HOURS',
    NOW() + INTERVAL '18 HOURS',
    'XploitXβ{',
    '}',
    4,
    TRUE,
    30
) ON CONFLICT (slug) DO NOTHING;

-- 2. OPERATIVE USERS
-- Default passwords: admin = 'admin123', player = 'player123'
INSERT INTO users (id, competition_id, username, email, password_hash, role, callsign, affiliation)
VALUES 
(
    'u0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'admin',
    'admin@xploitxctf.me',
    '$2a$10$w8c2E6W56P94191sJ7n0y.090aK6u.0/9kF1aR1Kj6U5C8l0e3cye', -- bcrypt hash of admin123
    'ADMIN',
    'COMMANDER',
    'XPLOITX_C2_HQ'
),
(
    'u0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'jesin',
    'jesin@xploitxctf.me',
    '$2a$10$w8c2E6W56P94191sJ7n0y.090aK6u.0/9kF1aR1Kj6U5C8l0e3cye',
    'PLAYER',
    'N0D3_RUNNER',
    'SHADOW_CELL'
) ON CONFLICT (username) DO NOTHING;

-- 3. SQUADS / TEAMS
INSERT INTO teams (id, competition_id, name, slug, access_code, total_score, solves_count, first_bloods)
VALUES 
('t0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'ROOT_ACCESS', 'root-access', 'ROOT-8910', 8450, 31, 8),
('t0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'NULLBYTE', 'nullbyte', 'NULL-4412', 8120, 29, 5),
('t0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'CYBER_VIPERS', 'cyber-vipers', 'VIPER-3391', 7900, 27, 4),
('t0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'NEXUS', 'nexus', 'NEXUS-8921-CLASSIFIED', 4850, 21, 3)
ON CONFLICT (competition_id, slug) DO NOTHING;

-- Assign user to team
UPDATE users SET team_id = 't0000000-0000-0000-0000-000000000004' WHERE username = 'jesin';

-- 4. CATEGORIES
INSERT INTO categories (id, competition_id, name, slug, color_accent, display_order)
VALUES
('cat-01', 'c0000000-0000-0000-0000-000000000001', 'CRYPTO', 'crypto', '#c77dff', 1),
('cat-02', 'c0000000-0000-0000-0000-000000000001', 'WEB', 'web', '#00d8f6', 2),
('cat-03', 'c0000000-0000-0000-0000-000000000001', 'PWN', 'pwn', '#ff3b5c', 3),
('cat-04', 'c0000000-0000-0000-0000-000000000001', 'FORENSICS', 'forensics', '#00ff9c', 4),
('cat-05', 'c0000000-0000-0000-0000-000000000001', 'REVERSING', 'reversing', '#ffb020', 5),
('cat-06', 'c0000000-0000-0000-0000-000000000001', 'OSINT', 'osint', '#4cc9f0', 6)
ON CONFLICT (competition_id, slug) DO NOTHING;

-- 5. CHALLENGES
INSERT INTO challenges (id, competition_id, category_id, mission_id, slug, title, description, difficulty, base_points, minimum_points, current_points, solve_count, status, has_instance)
VALUES
(
    'ch-01',
    'c0000000-0000-0000-0000-000000000001',
    'cat-02',
    'OP-WEB-01',
    'quantum-vault',
    'Quantum Vault Breach',
    'Infiltrate the legacy executive mainframe. An undocumented REST debugging endpoint leaks state.',
    'EASY',
    300,
    100,
    280,
    14,
    'LIVE',
    TRUE
),
(
    'ch-02',
    'c0000000-0000-0000-0000-000000000001',
    'cat-03',
    'OP-PWN-02',
    'stack-crusher',
    'Stack Crusher: Ret2Win',
    'A vulnerable telemetry forwarder daemon accepts unchecked buffer inputs. Smash the stack and hijack RIP.',
    'MEDIUM',
    450,
    100,
    420,
    6,
    'LIVE',
    TRUE
),
(
    'ch-03',
    'c0000000-0000-0000-0000-000000000001',
    'cat-01',
    'OP-CRY-03',
    'elliptic-eclipse',
    'Elliptic Eclipse',
    'Intercepted satellite telemetry uses a custom ECC curve with a suspiciously smooth group order. Recover the private key.',
    'HARD',
    500,
    150,
    500,
    1,
    'LIVE',
    FALSE
)
ON CONFLICT (competition_id, slug) DO NOTHING;

-- 6. FLAGS (Strict XploitXβ{...} Format)
INSERT INTO flags (id, challenge_id, flag_type, flag_value, case_sensitive)
VALUES
('f-01', 'ch-01', 'STATIC', 'XploitXβ{qU4n7uM_v4uL7_byp4ss_2026}', TRUE),
('f-02', 'ch-02', 'STATIC', 'XploitXβ{s74ck_sm4sh_pwn_b0f_succ3ss}', TRUE),
('f-03', 'ch-03', 'STATIC', 'XploitXβ{p0h119_h311m4n_3cc_br34k_2026}', TRUE)
ON CONFLICT DO NOTHING;

-- 7. ANNOUNCEMENTS
INSERT INTO announcements (id, competition_id, title, content, urgent)
VALUES
(
    'ann-01',
    'c0000000-0000-0000-0000-000000000001',
    'BATTLEFIELD GRID INITIALIZED',
    'All tactical operatives report to stations. Challenges are live. Verify all flags match XploitXβ{...} standard.',
    TRUE
),
(
    'ann-02',
    'c0000000-0000-0000-0000-000000000001',
    'DYNAMIC SCORING ACTIVE',
    'Scores decay with solve frequency. Deploy fast to claim maximum bounty points.',
    FALSE
)
ON CONFLICT DO NOTHING;
