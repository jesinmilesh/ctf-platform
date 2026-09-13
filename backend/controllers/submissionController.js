/**
 * XPLOITX // CYBER BATTLEFIELD
 * Submission Controller (backend/controllers/submissionController.js)
 */

const db = require('../config/database');

exports.getRecentSubmissions = (req, res) => {
  const subs = db.getSubmissions().slice(-50).reverse();
  const challenges = db.getChallenges();
  const users = db.getUsers();
  const teams = db.getTeams();

  const formatted = subs.map(s => {
    const ch = challenges.find(c => c.id === s.challenge_id);
    const u = users.find(usr => usr.id === s.user_id);
    const t = teams.find(tm => tm.id === s.team_id);
    return {
      id: s.id,
      challengeTitle: ch ? ch.title : 'Classified Mission',
      operative: u ? (u.callsign || u.username) : 'Operative',
      teamName: t ? t.name : 'Independent',
      status: s.status,
      points: s.points_awarded || 0,
      timestamp: s.created_at
    };
  });

  res.json({ submissions: formatted });
};
