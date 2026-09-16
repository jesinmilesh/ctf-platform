/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin C2 Controller (backend/controllers/adminController.js)
 */

const path = require('path');
const db = require('../config/database');
const challengeService = require('../services/challengeService');
const instanceService = require('../services/instanceService');
const fileService = require('../services/fileService');
const realtimeService = require('../services/realtimeService');
const auditService = require('../services/auditService');
const flagVerificationService = require('../services/flagVerificationService');

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

  async getChallenges(req, res) {
    // Hydrate from Atlas if empty
    if (db.isMongo && db.mongoDb && db.getChallenges().length === 0) {
      await db.syncFromMongo().catch(() => {});
    }
    const categories = db.getCategories();
    const challenges = db.getChallenges().map(c => {
      const fl = db.getFlags().find(f => f.challenge_id === c.id || (c._id && f.challenge_id === String(c._id)));
      const cat = categories.find(k => k.id === c.category_id);
      const catName = cat ? cat.name : (c.category_name || c.category || 'Misc');
      return {
        ...c,
        id: c.id,
        _id: c._id ? String(c._id) : undefined,
        category: catName,
        category_name: catName,
        flag: fl ? fl.flag_value : '***'
      };
    });
    res.json({ challenges });
  }

  async getChallenge(req, res) {
    const rawId = req.params.id ? String(req.params.id).trim() : '';
    if (!rawId) {
      return res.status(400).json({ success: false, error: 'CHALLENGE_ID_REQUIRED', message: 'Challenge identifier is required.' });
    }

    // Hydrate from Atlas if empty
    if (db.isMongo && db.mongoDb && db.getChallenges().length === 0) {
      await db.syncFromMongo().catch(() => {});
    }

    const challenge = challengeService.getAdminChallengeDetails(rawId);
    if (!challenge) {
      return res.status(404).json({ success: false, error: 'CHALLENGE_NOT_FOUND', message: 'Challenge dossier not found in database.' });
    }

    res.json({ success: true, challenge });
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
    const challengeId = req.params.id ? String(req.params.id).trim() : '';

    // Hydrate from Atlas if empty
    if (db.isMongo && db.mongoDb && db.getChallenges().length === 0) {
      await db.syncFromMongo().catch(() => {});
    }

    const challenge = db.getChallenges().find(c =>
      c.id === challengeId ||
      (c._id && String(c._id) === challengeId) ||
      c.slug === challengeId ||
      c.mission_id === challengeId
    );
    if (!challenge) {
      return res.status(404).json({ success: false, error: 'Challenge not found' });
    }
    const canonicalId = challenge.id;
    const files = fileService.getChallengeFiles(canonicalId, challenge._id).map(f => ({
      id: f.id,
      filename: f.filename,
      name: f.filename,
      size: f.file_size_bytes || f.size,
      file_size_bytes: f.file_size_bytes || f.size,
      mimeType: f.mime_type || f.mimeType,
      sha256: f.sha256,
      uploadedAt: f.uploaded_at || f.uploadedAt,
      downloadUrl: `/api/v1/challenges/${canonicalId}/files/${f.id}/download`
    }));
    res.json({ success: true, files });
  }

  async uploadChallengeFiles(req, res) {
    const rawId = req.params.id ? String(req.params.id).trim() : '';

    // Hydrate cache from Atlas if empty (important after server restart)
    if (db.isMongo && db.mongoDb && db.getChallenges().length === 0) {
      await db.syncFromMongo().catch(() => {});
    }

    let challenge = db.getChallenges().find(c =>
      c.id === rawId ||
      c.challengeId === rawId ||
      c.publicRouteId === rawId ||
      (c._id && String(c._id) === rawId) ||
      c.slug === rawId ||
      c.mission_id === rawId
    );

    // Direct Atlas lookup fallback
    if (!challenge && db.isMongo && db.mongoDb && rawId) {
      try {
        const orConditions = [
          { id: rawId },
          { challengeId: rawId },
          { publicRouteId: rawId },
          { slug: rawId },
          { mission_id: rawId }
        ];
        if (rawId.length === 24 && /^[0-9a-fA-F]{24}$/.test(rawId)) {
          const { ObjectId } = require('mongodb');
          orConditions.push({ _id: new ObjectId(rawId) });
        }
        const doc = await db.mongoDb.collection('challenges').findOne({ $or: orConditions });
        if (doc) {
          challenge = doc;
          challenge.id = doc.id || (doc._id ? doc._id.toString() : rawId);
          db.getChallenges().push(challenge);
        }
      } catch (_) {}
    }

    if (!challenge) {
      return res.status(404).json({
        success: false,
        code: 'CHALLENGE_NOT_FOUND',
        message: 'Challenge not found for target identifier.',
        error: { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found for target identifier.' }
      });
    }

    const uploadedFiles = req.files || (req.file ? [req.file] : []);
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'NO_FILES_PROVIDED',
        message: 'No files provided in multipart request. Please select files to upload.',
        error: { code: 'NO_FILES_PROVIDED', message: 'No files provided in multipart request.' }
      });
    }

    try {
      // Authoritative Canonical challenge ID for database relationship
      const canonicalId = challenge.id;
      const savedRecords = [];

      for (const file of uploadedFiles) {
        const originalName = file.originalname || file.name || 'asset.bin';
        const buffer = file.buffer;

        if (!buffer || buffer.length === 0) {
          return res.status(400).json({
            success: false,
            code: 'EMPTY_FILE',
            message: `Uploaded file '${originalName}' is empty (0 bytes).`,
            error: { code: 'EMPTY_FILE', message: `Uploaded file '${originalName}' is empty.` }
          });
        }

        // ZIP Archive Security Inspection (Section 10 & 11)
        if (originalName.toLowerCase().endsWith('.zip') || file.mimetype === 'application/zip') {
          // Verify ZIP magic bytes PK\x03\x04 or PK\x05\x06 (empty zip) or PK\x07\x08
          if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
            return res.status(400).json({
              success: false,
              code: 'INVALID_ZIP_SIGNATURE',
              message: `The file '${originalName}' is not a valid ZIP archive (missing PK signature).`,
              error: { code: 'INVALID_ZIP_SIGNATURE', message: 'Invalid ZIP archive signature.' }
            });
          }

          // Scan ZIP headers for path traversal (Zip Slip protection) without extracting
          let offset = 0;
          while (offset + 30 < buffer.length) {
            if (buffer[offset] === 0x50 && buffer[offset+1] === 0x4B && buffer[offset+2] === 0x03 && buffer[offset+3] === 0x04) {
              const fileNameLen = buffer.readUInt16LE(offset + 26);
              const extraLen = buffer.readUInt16LE(offset + 28);
              if (offset + 30 + fileNameLen <= buffer.length) {
                const entryName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLen);
                if (entryName.includes('../') || entryName.includes('..\\') || path.isAbsolute(entryName)) {
                  return res.status(400).json({
                    success: false,
                    code: 'ZIP_SECURITY_VIOLATION',
                    message: `Archive entry '${entryName}' contains path traversal sequences. Upload rejected.`,
                    error: { code: 'ZIP_SECURITY_VIOLATION', message: 'Zip Slip path traversal entry detected.' }
                  });
                }
              }
              offset += 30 + fileNameLen + extraLen;
            } else {
              offset++;
              if (offset > 50000 && offset % 5000 !== 0) {
                const nextPK = buffer.indexOf(Buffer.from([0x50, 0x4B, 0x03, 0x04]), offset);
                if (nextPK === -1) break;
                offset = nextPK;
              }
            }
          }
        }

        const record = await fileService.saveChallengeFile({
          challengeId: canonicalId,
          filename: originalName,
          buffer: buffer,
          mimeType: file.mimetype,
          user: req.user
        });

        savedRecords.push({
          id: record.id,
          filename: record.filename,
          originalName: record.originalName || record.filename,
          name: record.filename,
          size: record.file_size_bytes,
          file_size_bytes: record.file_size_bytes,
          mimeType: record.mime_type,
          sha256: record.sha256,
          uploadedAt: record.uploaded_at,
          downloadUrl: `/api/v1/challenges/${canonicalId}/files/${record.id}/download`
        });
      }

      return res.status(201).json({
        success: true,
        files: savedRecords,
        file: savedRecords[0] || null
      });
    } catch (err) {
      console.error('[ADMIN CONTROLLER] File upload error:', err);
      return res.status(400).json({
        success: false,
        code: 'UPLOAD_FAILED',
        message: err.message || 'Unable to store file asset.',
        error: { code: 'UPLOAD_FAILED', message: err.message || 'Unable to store file asset.' }
      });
    }
  }

  async deleteChallengeFile(req, res) {
    const { id: challengeId, fileId } = req.params;
    const cleanId = challengeId ? String(challengeId).trim() : '';

    if (db.isMongo && db.mongoDb && db.getChallenges().length === 0) {
      await db.syncFromMongo().catch(() => {});
    }

    const challenge = db.getChallenges().find(c =>
      c.id === cleanId ||
      c.challengeId === cleanId ||
      c.publicRouteId === cleanId ||
      (c._id && String(c._id) === cleanId) ||
      c.slug === cleanId ||
      c.mission_id === cleanId
    );
    if (!challenge) {
      return res.status(404).json({
        success: false,
        code: 'CHALLENGE_NOT_FOUND',
        message: 'Challenge not found.',
        error: { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found.' }
      });
    }

    const fileRec = fileService.getFileRecord(fileId);
    const altIds = [
      challenge.id,
      challenge.challengeId,
      challenge.publicRouteId,
      String(challenge._id || ''),
      challenge.slug,
      challenge.mission_id,
      challenge.legacy_id
    ].filter(Boolean).map(s => String(s).trim());

    const belongs = fileRec && (
      altIds.includes(String(fileRec.challenge_id || '').trim()) ||
      altIds.includes(String(fileRec.challengeId || '').trim()) ||
      (fileRec.challengeObjectId && challenge._id && String(fileRec.challengeObjectId) === String(challenge._id))
    );
    if (!fileRec || !belongs) {
      return res.status(404).json({
        success: false,
        code: 'FILE_NOT_FOUND',
        message: 'File not found or does not belong to this challenge.',
        error: { code: 'FILE_NOT_FOUND', message: 'File not found or does not belong to this challenge.' }
      });
    }

    try {
      await fileService.deleteFile(fileId);
      return res.json({
        success: true,
        code: 'FILE_DELETED',
        message: 'Challenge file neutralized successfully.'
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        code: 'DELETE_FAILED',
        message: err.message || 'Unable to delete file asset.',
        error: { code: 'DELETE_FAILED', message: err.message }
      });
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
      const challenge = challengeService.resolveChallenge(challengeId);
      if (!challenge) {
        return res.json({
          valid: false,
          message: 'FLAG INVALID: Target mission dossier not found in database.'
        });
      }

      const verification = flagVerificationService.verifySubmission(challenge, cleanFlag, req.user);
      return res.json({
        valid: verification.correct,
        message: verification.correct
          ? 'FLAG VERIFIED: Exact cryptographic match with mission database!'
          : 'FLAG INVALID: Does not match mission database.'
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

    auditService.record({
      action: user.is_banned ? 'MODERATION.USER_SUSPENDED' : 'MODERATION.USER_UNSUSPENDED',
      category: 'MODERATION',
      severity: 'WARNING',
      actor: req.user,
      resource: { type: 'USER', id: user.id },
      result: 'SUCCESS',
      description: `Operative ${user.username} (${user.id}) ${user.is_banned ? 'suspended/banned' : 'unsuspended/reinstated'}`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip: req.ip || '127.0.0.1', userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { targetUserId: user.id, targetUsername: user.username, isBanned: user.is_banned }
    }).catch(() => {});

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

  async getAuditLogs(req, res) {
    try {
      const result = await auditService.queryLogs(req.query);
      res.json({
        success: true,
        logs: result.logs,
        pagination: result.pagination,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'QUERY_FAILED', message: err.message });
    }
  }

  async getAuditStats(req, res) {
    try {
      const stats = await auditService.getDashboardStats();
      res.json({ success: true, stats });
    } catch (err) {
      res.status(500).json({ success: false, error: 'STATS_FAILED', message: err.message });
    }
  }

  async exportAuditLogs(req, res) {
    try {
      const format = (req.query.format || 'json').toLowerCase();
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
      const exportResult = await auditService.exportLogs(req.query, format, req.user, req.id, ip);

      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      return res.send(exportResult.data);
    } catch (err) {
      res.status(500).json({ success: false, error: 'EXPORT_FAILED', message: err.message });
    }
  }

  async getAuditLogEntry(req, res) {
    try {
      const event = await auditService.getEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Audit event not found' });
      }
      res.json({ success: true, event });
    } catch (err) {
      res.status(500).json({ success: false, error: 'FETCH_FAILED', message: err.message });
    }
  }

  updateSettings(req, res) {
    const settings = db.getSettings();
    const payload = req.body;
    Object.assign(settings, payload);

    auditService.record({
      action: 'ADMIN.SETTINGS_UPDATED',
      category: 'ADMIN',
      severity: 'NOTICE',
      actor: req.user,
      resource: { type: 'SETTINGS', id: 'COMPETITION_CONFIG' },
      result: 'SUCCESS',
      description: `Competition settings updated by ${req.user?.username || 'ADMIN'}`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip: req.ip || '127.0.0.1', userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { updatedKeys: Object.keys(payload) }
    }).catch(() => {});

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

    auditService.record({
      action: 'ANNOUNCEMENT.CREATED',
      category: 'ANNOUNCEMENT',
      severity: urgent ? 'WARNING' : 'INFO',
      actor: req.user,
      resource: { type: 'ANNOUNCEMENT', id: ann.id },
      result: 'SUCCESS',
      description: `Announcement dispatched: "${ann.title}"`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip: req.ip || '127.0.0.1', userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { announcementId: ann.id, title: ann.title, urgent: ann.urgent }
    }).catch(() => {});

    if (this.broadcastFn) {
      this.broadcastFn('ANNOUNCEMENT', ann);
    }

    realtimeService.broadcastAnnouncement(ann, ann.competition_id)
      .catch(e => console.error('[ADMIN CONTROLLER] Broadcast announcement error:', e));

    res.status(201).json({ success: true, announcement: ann });
  }
}

module.exports = new AdminController();
