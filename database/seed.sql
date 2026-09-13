-- ============================================================================
-- XPLOITX // CYBER BATTLEFIELD
-- Initial Database Seed
-- ============================================================================

-- Competition
INSERT INTO competitions (id, slug, name, tagline, description, status, start_time, end_time, flag_prefix, flag_suffix)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'xploitx-2026',
    'XPLOITX 2.0 BETA',
    'ENTER THE DIGITAL BATTLEFIELD',
    '24-Hour elite cybersecurity capture the flag competition.',
    'LIVE',
    NOW() - INTERVAL '6 HOURS',
    NOW() + INTERVAL '18 HOURS',
    'XploitXβ{',
    '}'
) ON CONFLICT DO NOTHING;

-- Admin User
INSERT INTO users (id, competition_id, username, email, password_hash, role, callsign)
VALUES (
    'u0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'admin',
    'admin@xploitxctf.me',
    'admin123', -- in production bcrypt hashed
    'ADMIN',
    'COMMANDER'
) ON CONFLICT DO NOTHING;

-- Player User
INSERT INTO users (id, competition_id, username, email, password_hash, role, callsign)
VALUES (
    'u0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'jesin',
    'jesin@xploitxctf.me',
    'player123',
    'PLAYER',
    'N0D3_RUNNER'
) ON CONFLICT DO NOTHING;

-- Teams
INSERT INTO teams (id, competition_id, name, slug, access_code, total_score, solves_count, first_bloods)
VALUES 
('t0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'ROOT_ACCESS', 'root-access', 'ROOT-8910', 8450, 31, 8),
('t0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'NULLBYTE', 'nullbyte', 'NULL-4412', 8120, 29, 5),
('t0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'CYBER_VIPERS', 'cyber-vipers', 'VIPER-3391', 7900, 27, 4),
('t0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'NEXUS', 'nexus', 'NEXUS-8921-CLASSIFIED', 4850, 21, 3)
ON CONFLICT DO NOTHING;

-- Categories
INSERT INTO categories (id, competition_id, name, slug, color_accent, display_order)
VALUES
('cat-01', 'c0000000-0000-0000-0000-000000000001', 'CRYPTO', 'crypto', '#c77dff', 1),
('cat-02', 'c0000000-0000-0000-0000-000000000001', 'WEB', 'web', '#00d8f6', 2),
('cat-03', 'c0000000-0000-0000-0000-000000000001', 'PWN', 'pwn', '#ff3b5c', 3),
('cat-04', 'c0000000-0000-0000-0000-000000000001', 'FORENSICS', 'forensics', '#00ff9c', 4),
('cat-05', 'c0000000-0000-0000-0000-000000000001', 'REVERSING', 'reversing', '#ffb020', 5),
('cat-06', 'c0000000-0000-0000-0000-000000000001', 'OSINT', 'osint', '#4cc9f0', 6)
ON CONFLICT DO NOTHING;
