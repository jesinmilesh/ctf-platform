-- ============================================================================
-- XPLOITX // CYBER BATTLEFIELD
-- Initial Production Setup (database/seed.sql)
-- Note: Contains only initial competition state, default sector taxonomy,
-- and primary administrator credentials. NO DEMO/FAKE COMPETITION DATA.
-- ============================================================================

-- 1. COMPETITION SETUP
INSERT INTO competitions (id, slug, name, tagline, description, status, start_time, end_time, flag_prefix, flag_suffix, max_team_size, dynamic_scoring, scoring_decay)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'xploitx-2026',
    'XPLOITX 2.0 BETA',
    'ENTER THE DIGITAL BATTLEFIELD',
    '24-Hour elite cybersecurity capture the flag competition.',
    'LIVE',
    NOW() - INTERVAL '1 HOUR',
    NOW() + INTERVAL '23 HOURS',
    'XploitXβ{',
    '}',
    4,
    TRUE,
    30
) ON CONFLICT (id) DO NOTHING;

-- 2. INITIAL C2 ADMINISTRATOR (Default login: admin / admin123)
-- In production, replace with bcrypt hash from ADMIN_PASSWORD env
INSERT INTO users (id, competition_id, username, email, password_hash, role, callsign, affiliation)
VALUES (
    'u0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'admin',
    'admin@xploitxctf.me',
    'admin123',
    'ADMIN',
    'COMMANDER',
    'XploitX Operations Command'
) ON CONFLICT (id) DO NOTHING;

-- 3. SECTOR TAXONOMY / CATEGORIES
INSERT INTO categories (id, competition_id, name, slug, description, color_accent, display_order)
VALUES
('cat-01', 'c0000000-0000-0000-0000-000000000001', 'PWN', 'pwn', 'Binary exploitation, ROP chains, and heap manipulation', '#ff3b5c', 1),
('cat-02', 'c0000000-0000-0000-0000-000000000001', 'Misc', 'misc', 'Miscellaneous tactical missions and puzzle solving', '#a3a3a3', 2),
('cat-03', 'c0000000-0000-0000-0000-000000000001', 'Web', 'web', 'Web application exploitation, API bypasses, and injection flaws', '#00d8f6', 3),
('cat-04', 'c0000000-0000-0000-0000-000000000001', 'Network', 'network', 'Packet inspection, covert channels, and routing protocol analysis', '#f9c74f', 4),
('cat-05', 'c0000000-0000-0000-0000-000000000001', 'Digital Forensic', 'forensic', 'Memory artifact analysis, disk triage, and file carving', '#00ff9c', 5),
('cat-06', 'c0000000-0000-0000-0000-000000000001', 'OSINT', 'osint', 'Open source reconnaissance, asset intelligence, and threat actor tracking', '#4cc9f0', 6),
('cat-07', 'c0000000-0000-0000-0000-000000000001', 'Cryptography', 'crypto', 'Mathematical ciphers, PRNG state recovery, and cryptanalysis', '#c77dff', 7),
('cat-08', 'c0000000-0000-0000-0000-000000000001', 'Steganography', 'stegano', 'Covert data exfiltration and concealed payload extraction', '#ffb020', 8)
ON CONFLICT (id) DO NOTHING;
