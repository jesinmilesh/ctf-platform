/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin C2 Controller (backend/controllers/adminController.js)
 */

const db = require('../config/database');
const challengeService = require('../services/challengeService');
const instanceService = require('../services/instanceService');
const fileService = require('../services/fileService');
const realtimeService = require('../services/realtimeService');

class AdminController {
  constructor() {
    this.broadcastFn = null;
  }

  setBroadcaster(fn) {
    this.broadcastFn = fn;
  }

  getOverview(req, res) {
    const challenges = db.getChallenges();
    const solves = db.getSolves();
    const submissions = db.getSubmissions();
    const users = db.getUsers();
    const teams = db.getTeams();
    const instances = db.getInstances().filter(i => i.status === 'RUNNING');

    res.json({
      stats: {
        activeOperatives: users.length,
        squads: teams.length,
        totalMissions: challenges.length,
        flagsCaptured: solves.length,
        totalSubmissions: submissions.length,
        activeSandboxes: instances.length,
        systemStatus: 'ONLINE'
      }
    });
  }

  getChallenges(req, res) {
    const categories = db.getCategories();
    const challenges = db.getChallenges().map(c => {
      const fl = db.getFlags().find(f => f.challenge_id === c.id);
      const cat = categories.find(k => k.id === c.category_id);
      const catName = cat ? cat.name : (c.category_name || c.category || 'Misc');
      return {
        ...c,
        category: catName,
        category_name: catName,
        flag: fl ? fl.flag_value : '***'
      };
    });
    res.json({ challenges });
  }

  createChallenge(req, res) {
    try {
      const challenge = challengeService.createChallenge(req.body);
      res.status(201).json({ success: true, challenge });
    } catch (err) {
      res.status(400).json({ error: 'CREATE_FAILED', message: err.message });
    }
  }

  updateChallenge(req, res) {
    try {
      const challenge = challengeService.updateChallenge(req.params.id, req.body);
      res.json({ success: true, challenge });
    } catch (err) {
      res.status(400).json({ error: 'UPDATE_FAILED', message: err.message });
    }
  }

  deleteChallenge(req, res) {
    try {
      challengeService.deleteChallenge(req.params.id);
      res.json({ success: true, message: 'Challenge neutralized' });
    } catch (err) {
      res.status(400).json({ error: 'DELETE_FAILED', message: err.message });
    }
  }

  validateChallenge(req, res) {
    const id = req.params.id;
    const challenge = db.getChallenges().find(c => c.id === id);
    if (!challenge) {
      return res.status(404).json({ success: false, error: 'Challenge not found' });
    }
    const result = challengeService.validateChallengeForPublish(challenge);
    res.json(result);
  }

  async getChallengeFiles(req, res) {
    const challengeId = req.params.id;
    const challenge = db.getChallenges().find(c => c.id === challengeId || c.slug === challengeId);
    if (!challenge) {
      return res.status(404).json({ success: false, error: 'Challenge not found' });
    }
    const files = fileService.getChallengeFiles(challenge.id).map(f => ({
      id: f.id,
      filename: f.filename,
      name: f.filename,
      size: f.file_size_bytes || f.size,
      file_size_bytes: f.file_size_bytes || f.size,
      mimeType: f.mime_type || f.mimeType,
      sha256: f.sha256,
      uploadedAt: f.uploaded_at || f.uploadedAt,
      downloadUrl: `/api/v1/challenges/${challenge.id}/files/${f.id}/download`
    }));
    res.json({ success: true, files });
  }

  async uploadChallengeFiles(req, res) {
    const challengeId = req.params.id;
    const challenge = db.getChallenges().find(c => c.id === challengeId || c.slug === challengeId);
    if (!challenge) {
      return res.status(404).json({ success: false, error: 'Challenge not found' });
    }

    const uploadedFiles = req.files || (req.file ? [req.file] : []);
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided in multipart request' });
    }

    try {
      const savedRecords = [];
      for (const file of uploadedFiles) {
        const record = await fileService.saveChallengeFile({
          challengeId: challenge.id,
          filename: file.originalname || file.name,
          buffer: file.buffer,
          mimeType: file.mimetype,
          user: req.user
        });
        savedRecords.push({
          id: record.id,
          filename: record.filename,
          name: record.filename,
          size: record.file_size_bytes,
          file_size_bytes: record.file_size_bytes,
          mimeType: record.mime_type,
          sha256: record.sha256,
          uploadedAt: record.uploaded_at,
          downloadUrl: `/api/v1/challenges/${challenge.id}/files/${record.id}/download`
        });
      }
      res.status(201).json({ success: true, files: savedRecords });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async deleteChallengeFile(req, res) {
    const { id: challengeId, fileId } = req.params;
    const challenge = db.getChallenges().find(c => c.id === challengeId || c.slug === challengeId);
    if (!challenge) {
      return res.status(404).json({ success: false, error: 'Challenge not found' });
    }

    const fileRec = fileService.getFileRecord(fileId);
    if (!fileRec || (fileRec.challenge_id !== challenge.id && fileRec.challengeId !== challenge.id)) {
      return res.status(404).json({ success: false, error: 'File not found or does not belong to this challenge' });
    }

    try {
      await fileService.deleteFile(fileId);
      res.json({ success: true, message: 'Challenge file neutralized successfully' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  testFlag(req, res) {
    const { flag, challengeId } = req.body;
    const settings = db.getSettings();
    const prefix = settings.flagPrefix || 'XploitXβ{';
    const suffix = settings.flagSuffix || '}';

    const cleanFlag = (flag || '').trim();
    if (!cleanFlag.startsWith(prefix) || !cleanFlag.endsWith(suffix)) {
      return res.json({
        valid: false,
        message: `Format error: Flag must start with '${prefix}' and end with '${suffix}'`
      });
    }

    if (challengeId) {
      const flags = db.getFlags().filter(f => f.challenge_id === challengeId);
      const match = flags.some(f => f.flag_value === cleanFlag);
      return res.json({
        valid: match,
        message: match ? 'FLAG VERIFIED: Exact cryptographic match!' : 'FLAG INVALID: Does not match mission database.'
      });
    }

    res.json({
      valid: true,
      message: 'FLAG SYNTAX VALID: Passes competition format verification.'
    });
  }

  getCategories(req, res) {
    res.json({ categories: db.getCategories() });
  }

  getUsers(req, res) {
    const users = db.getUsers().map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      callsign: u.callsign,
      affiliation: u.affiliation,
      is_banned: !!u.is_banned,
      created_at: u.created_at
    }));
    res.json({ users });
  }

  toggleUserBan(req, res) {
    const user = db.getUsers().find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.is_banned = !user.is_banned;
    res.json({ success: true, is_banned: user.is_banned });
  }

  getTeams(req, res) {
    res.json({ teams: db.getTeams() });
  }

  getSubmissions(req, res) {
    const subs = [...db.getSubmissions()].reverse();
    const challenges = db.getChallenges();
    const users = db.getUsers();
    const teams = db.getTeams();

    const formatted = subs.map(s => {
      const ch = challenges.find(c => c.id === s.challenge_id);
      const u = users.find(usr => usr.id === s.user_id);
      const t = teams.find(tm => tm.id === s.team_id);
      return {
        id: s.id,
        challengeTitle: ch ? ch.title : 'Mission',
        username: u ? u.username : 'Operative',
        teamName: t ? t.name : 'Solo',
        flag: s.submitted_flag,
        status: s.status,
        points: s.points_awarded || 0,
        ip: s.ip_address,
        timestamp: s.created_at
      };
    });
    res.json({ submissions: formatted });
  }

  getAnalytics(req, res) {
    const challenges = db.getChallenges();
    const solves = db.getSolves();
    const submissions = db.getSubmissions();

    // Category distribution
    const categoryStats = {};
    for (const c of challenges) {
      const cat = c.category_name || 'MISC';
      if (!categoryStats[cat]) categoryStats[cat] = { count: 0, solves: 0 };
      categoryStats[cat].count++;
      categoryStats[cat].solves += (c.solve_count || 0);
    }

    res.json({
      categoryStats,
      solveRate: submissions.length ? Math.round((solves.length / submissions.length) * 100) : 0,
      totalSolves: solves.length,
      totalSubmissions: submissions.length
    });
  }

  getInstances(req, res) {
    res.json({ instances: instanceService.getAllInstances() });
  }

  getAuditLogs(req, res) {
    res.json({ logs: [...db.getAuditLogs()].reverse() });
  }

  updateSettings(req, res) {
    const settings = db.getSettings();
    const payload = req.body;
    Object.assign(settings, payload);

    db.getAuditLogs().push({
      id: `aud-${Date.now()}`,
      action: 'SETTINGS_UPDATE',
      target: 'COMPETITION_CONFIG',
      ip_address: req.ip || '127.0.0.1',
      created_at: new Date().toISOString()
    });

    if (payload.status) {
      realtimeService.broadcastCompetitionStatus(payload.status)
        .catch(e => console.error('[ADMIN CONTROLLER] Broadcast status error:', e));
    }

    res.json({ success: true, settings });
  }

  dispatchAnnouncement(req, res) {
    const { title, content, urgent } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }

    const ann = {
      id: `ann-${Date.now()}`,
      competition_id: db.getCompetitions()[0]?.id,
      title: title.trim(),
      content: content.trim(),
      urgent: !!urgent,
      created_at: new Date().toISOString()
    };
    db.getAnnouncements().push(ann);

    if (this.broadcastFn) {
      this.broadcastFn('ANNOUNCEMENT', ann);
    }

    realtimeService.broadcastAnnouncement(ann, ann.competition_id)
      .catch(e => console.error('[ADMIN CONTROLLER] Broadcast announcement error:', e));

    res.status(201).json({ success: true, announcement: ann });
  }
}

module.exports = new AdminController();
