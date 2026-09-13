-- ============================================================================
-- XPLOITX // CYBER BATTLEFIELD
-- DEVELOPMENT & TESTING FIXTURES ONLY
-- WARNING: NEVER EXECUTE IN PRODUCTION DEPLOYMENTS
-- ============================================================================

-- Development Test Users
INSERT INTO users (id, competition_id, username, email, password_hash, role, callsign, affiliation)
VALUES 
(
    'u0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'dev_operative',
    'dev_op@xploitxctf.me',
    'player123',
    'PLAYER',
    'N0D3_RUNNER',
    'Dev Taskforce'
) ON CONFLICT (username) DO NOTHING;

-- Development Test Teams
INSERT INTO teams (id, competition_id, name, slug, access_code, total_score, solves_count, first_bloods)
VALUES 
('t0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'DEV_ALPHA', 'dev-alpha', 'ALPHA-8910', 0, 0, 0)
ON CONFLICT (competition_id, slug) DO NOTHING;
