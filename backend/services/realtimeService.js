/**
 * XPLOITX // CYBER BATTLEFIELD
 * Realtime Service (backend/services/realtimeService.js)
 * Implements Section 5, 6, 7, 8, 9, 10, 11 of Architectural Blueprint:
 * Minimal, privacy-safe event broadcasting into Redis EventBus.
 */

const eventBus = require('../realtime/eventBus');
const Events = require('../realtime/events');

class RealtimeService {
  async broadcastChallengeCreated(challengeId, competitionId = 1) {
    return eventBus.publish(Events.CHALLENGE_CREATED, { challengeId }, competitionId);
  }

  async broadcastChallengeUpdated(challengeId, competitionId = 1) {
    return eventBus.publish(Events.CHALLENGE_UPDATED, { challengeId }, competitionId);
  }

  async broadcastChallengeDeleted(challengeId, competitionId = 1) {
    return eventBus.publish(Events.CHALLENGE_DELETED, { challengeId }, competitionId);
  }

  async broadcastChallengeFileAdded(challengeId, fileMeta, competitionId = 1) {
    return eventBus.publish(Events.CHALLENGE_FILE_ADDED, { challengeId, filename: fileMeta.filename, sha256: fileMeta.sha256 }, competitionId);
  }

  async broadcastFirstBlood({ challengeId, challengeTitle, teamName, points, capturedAt }) {
    return eventBus.publish(Events.CHALLENGE_FIRST_BLOOD, {
      challengeId,
      challengeTitle,
      teamName,
      points,
      capturedAt
    });
  }

  async broadcastScoreboardUpdated({ teamId, teamName, pointsAwarded, challengeTitle }) {
    return eventBus.publish(Events.SCOREBOARD_UPDATED, {
      teamId,
      teamName,
      pointsAwarded,
      challengeTitle
    });
  }

  async broadcastAnnouncement(announcement, competitionId = 1) {
    return eventBus.publish(Events.ANNOUNCEMENT_CREATED, {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      urgent: !!announcement.urgent,
      createdAt: announcement.created_at
    }, competitionId);
  }

  async broadcastCompetitionStatus(status, competitionId = 1) {
    return eventBus.publish(Events.COMPETITION_STATUS_CHANGED, { status }, competitionId);
  }

  async broadcastInstanceEvent(eventType, { instanceId, challengeId, teamId, status, host, port, expiresAt }) {
    return eventBus.publish(eventType, {
      instanceId,
      challengeId,
      teamId,
      status,
      host,
      port,
      expiresAt
    });
  }

  async broadcastAdminEvent(eventType, data) {
    return eventBus.publish(eventType, data);
  }

  async broadcastAuditLog(logRecord) {
    return eventBus.publish('audit.created', logRecord);
  }
}

const realtimeService = new RealtimeService();
module.exports = realtimeService;
