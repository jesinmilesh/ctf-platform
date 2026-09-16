/**
 * XPLOITX // CYBER BATTLEFIELD
 * Standardized Event Definitions (backend/realtime/events.js)
 * Implements Section 31 of Architectural Blueprint:
 * Standard envelope format { event, timestamp, competitionId, payload }
 */

const Events = {
  // Challenge Lifecycle
  CHALLENGE_CREATED: 'challenge.created',
  CHALLENGE_UPDATED: 'challenge.updated',
  CHALLENGE_DELETED: 'challenge.deleted',
  CHALLENGE_FILE_ADDED: 'challenge.file_added',
  CHALLENGE_FIRST_BLOOD: 'challenge.first_blood',

  // Scoreboard & Submissions
  SCOREBOARD_UPDATED: 'scoreboard.updated',
  SUBMISSION_CREATED: 'submission.created',

  // Announcements & Competition State
  ANNOUNCEMENT_CREATED: 'announcement.created',
  COMPETITION_STATUS_CHANGED: 'competition.status_changed',

  // Instance Lifecycle (Section 27)
  INSTANCE_REQUESTED: 'instance.requested',
  INSTANCE_STARTING: 'instance.starting',
  INSTANCE_STARTED: 'instance.started',
  INSTANCE_STOPPING: 'instance.stopping',
  INSTANCE_STOPPED: 'instance.stopped',
  INSTANCE_EXPIRED: 'instance.expired',
  INSTANCE_FAILED: 'instance.failed',

  // Team & Squad Lifecycle
  TEAM_CREATED: 'team.created',
  TEAM_MEMBER_JOINED: 'team.member_joined',
  TEAM_MEMBER_REMOVED: 'team.member_removed',
  TEAM_MEMBERSHIP_CHANGED: 'team.membership_changed'
};

module.exports = Events;
