const { PrismaClient } = require('@prisma/client');
const {
  findCommonFreeTime,
  checkSlotAvailability,
  effectiveWeekendMinHour,
  slotStartSatisfiesTimeConstraints,
  parseTimeConstraints,
} = require('./timetableMatch');

const prisma = new PrismaClient();
const { userToTimetableEntity } = require('./userTimetableEntity');

const DEFAULT_DURATION_MIN = 60;
const MIN_DURATION_MIN = 30;
const MAX_DURATION_MIN = 180;

function resolvedVenueIdPair(a, b) {
  return a.venue_id || b.venue_id || null;
}

function venueWhereForCandidate(newRequest) {
  if (newRequest.venue_id) {
    return { OR: [{ venue_id: newRequest.venue_id }, { venue_id: null }] };
  }
  return {};
}

function venuesCompatibleForJoin(ev, newRequest) {
  if (ev.venue_id && newRequest.venue_id && ev.venue_id !== newRequest.venue_id) {
    return false;
  }
  return true;
}

function resolvedDurationMinutes(reqA, reqB) {
  const a = reqA.preferred_duration_minutes;
  const b = reqB.preferred_duration_minutes;
  const da = Number.isFinite(a) && a >= MIN_DURATION_MIN && a <= MAX_DURATION_MIN ? a : DEFAULT_DURATION_MIN;
  const db = Number.isFinite(b) && b >= MIN_DURATION_MIN && b <= MAX_DURATION_MIN ? b : DEFAULT_DURATION_MIN;
  return Math.min(da, db);
}

async function applicantHasPendingJoin(userId) {
  const n = await prisma.groupJoinRequest.count({
    where: { applicant_user_id: userId, status: 'pending' },
  });
  return n > 0;
}

/**
 * @param {import('@prisma/client').User} userA
 * @param {import('@prisma/client').User} userB
 * @param {import('@prisma/client').MatchRequest | null} [requestA]
 * @param {import('@prisma/client').MatchRequest | null} [requestB]
 */
async function findFirstCommonSlot(userA, userB, durationMs, requestA, requestB) {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekendMinHour = effectiveWeekendMinHour(requestA, requestB);

  for (let d = 0; d < 8; d++) {
    const searchDate = new Date(today);
    searchDate.setDate(searchDate.getDate() + d);

    try {
      const gaps = await findCommonFreeTime(
        userToTimetableEntity(userA),
        userToTimetableEntity(userB),
        searchDate
      );
      for (const gap of gaps) {
        let startMs = Math.max(gap.start.getTime(), now.getTime());
        const endMs = gap.end.getTime();

        if (weekendMinHour != null) {
          const day = searchDate.getDay();
          if (day === 0 || day === 6) {
            const minStart = new Date(searchDate);
            minStart.setHours(weekendMinHour, 0, 0, 0);
            startMs = Math.max(startMs, minStart.getTime());
          }
        }

        if (endMs - startMs >= durationMs) {
          const start = new Date(startMs);
          const end = new Date(startMs + durationMs);
          return { start, end };
        }
      }
    } catch {
      // date hors fenêtre EDT
    }
  }
  return null;
}

async function notifyFoundersOfJoinRequest(groupEventId, joinRequestId, applicantUser) {
  const founders = await prisma.groupEventMember.findMany({
    where: { group_event_id: groupEventId, is_founder: true },
  });
  const name = `${applicantUser.first_name} ${applicantUser.last_name}`;
  for (const f of founders) {
    if (f.user_id === applicantUser.id) continue;
    await prisma.notification.create({
      data: {
        user_id: f.user_id,
        type: 'group_join_request',
        title: 'Quelqu’un veut rejoindre ton équipe',
        body: `${name} souhaite rejoindre ta partie de basket (ou sport collectif). Ouvre « Mes matchs » pour accepter ou refuser.`,
        group_event_id: groupEventId,
        join_request_id: joinRequestId,
      },
    });
  }
}

/**
 * Joueur suivant : on ne recalcule pas un triple EDT — on teste seulement si le créneau du groupe est libre pour lui.
 */
async function tryJoinExistingGroupEvent(newRequest) {
  const mode = newRequest.sport.match_mode || 'duel';
  if (mode !== 'collective' && mode !== 'open_group') {
    return { joined: false };
  }

  if (await applicantHasPendingJoin(newRequest.user_id)) {
    return { joined: false };
  }

  const now = new Date();

  const events = await prisma.groupEvent.findMany({
    where: {
      sport_id: newRequest.sport_id,
      status: 'recruiting',
      start_time: { gte: now },
    },
    include: {
      sport: true,
      venue: true,
      members: true,
    },
    orderBy: { created_at: 'asc' },
  });

  for (const ev of events) {
    if (ev.members.some((m) => m.user_id === newRequest.user_id)) continue;
    if (!venuesCompatibleForJoin(ev, newRequest)) continue;

    const max = ev.sport.max_players;
    if (max != null && ev.members.length >= max) continue;

    const { free } = await checkSlotAvailability(
      userToTimetableEntity(newRequest.user),
      ev.start_time,
      ev.end_time
    );
    if (!free) continue;

    if (!slotStartSatisfiesTimeConstraints(ev.start_time, parseTimeConstraints(newRequest))) {
      continue;
    }

    const jr = await prisma.groupJoinRequest.create({
      data: {
        group_event_id: ev.id,
        applicant_user_id: newRequest.user_id,
        applicant_match_request_id: newRequest.id,
        status: 'pending',
      },
    });

    await notifyFoundersOfJoinRequest(ev.id, jr.id, newRequest.user);

    return {
      joined: true,
      awaitingApproval: true,
      joinRequestId: jr.id,
      groupEventId: ev.id,
    };
  }

  return { joined: false };
}

async function pickCollectiveCandidate(newRequest) {
  const baseWhere = {
    sport_id: newRequest.sport_id,
    status: 'pending',
    user_id: { not: newRequest.user_id },
    id: { not: newRequest.id },
    group_event_id: null,
    ...venueWhereForCandidate(newRequest),
  };

  const list = await prisma.matchRequest.findMany({
    where: baseWhere,
    orderBy: { created_at: 'asc' },
    take: 40,
    include: { user: true, sport: true, venue: true },
  });

  for (const c of list) {
    const sm = c.sport.match_mode || 'duel';
    if (sm !== 'collective' && sm !== 'open_group') continue;
    if (await applicantHasPendingJoin(c.user_id)) continue;
    return c;
  }
  return null;
}

async function tryPairCollectiveAfterCreate(newRequest) {
  const candidate = await pickCollectiveCandidate(newRequest);
  if (!candidate) {
    return { paired: false, reason: 'no_candidate' };
  }

  const durationMin = resolvedDurationMinutes(candidate, newRequest);
  const durationMs = durationMin * 60 * 1000;

  const slot = await findFirstCommonSlot(
    candidate.user,
    newRequest.user,
    durationMs,
    candidate,
    newRequest
  );
  if (!slot) {
    return { paired: false, reason: 'no_slot', durationMinutes: durationMin };
  }

  const ordered = [candidate, newRequest].sort((a, b) => a.created_at - b.created_at);
  const reqA = ordered[0];
  const reqB = ordered[1];
  const resolvedVenueId = resolvedVenueIdPair(reqA, reqB);

  await prisma.$transaction(async (tx) => {
    const ge = await tx.groupEvent.create({
      data: {
        sport_id: newRequest.sport_id,
        venue_id: resolvedVenueId,
        start_time: slot.start,
        end_time: slot.end,
        duration_minutes: durationMin,
        status: 'recruiting',
      },
    });

    await tx.groupEventMember.createMany({
      data: [
        { group_event_id: ge.id, user_id: reqA.user_id, is_founder: true },
        { group_event_id: ge.id, user_id: reqB.user_id, is_founder: true },
      ],
    });

    await tx.matchRequest.update({
      where: { id: reqA.id },
      data: {
        status: 'matched',
        proposed_time: slot.start,
        group_event_id: ge.id,
      },
    });
    await tx.matchRequest.update({
      where: { id: reqB.id },
      data: {
        status: 'matched',
        proposed_time: slot.start,
        group_event_id: ge.id,
      },
    });
  });

  return {
    paired: true,
    collective: true,
    startTime: slot.start.toISOString(),
    endTime: slot.end.toISOString(),
    durationMinutes: durationMin,
  };
}

async function pickDuelCandidate(newRequest) {
  const baseWhere = {
    sport_id: newRequest.sport_id,
    status: 'pending',
    user_id: { not: newRequest.user_id },
    id: { not: newRequest.id },
    group_event_id: null,
    ...venueWhereForCandidate(newRequest),
  };

  const list = await prisma.matchRequest.findMany({
    where: baseWhere,
    orderBy: { created_at: 'asc' },
    take: 40,
    include: { user: true, sport: true },
  });

  for (const c of list) {
    if ((c.sport.match_mode || 'duel') !== 'duel') continue;
    return c;
  }
  return null;
}

async function tryPairDuelAfterCreate(newRequest) {
  const candidate = await pickDuelCandidate(newRequest);
  if (!candidate) {
    return { paired: false, reason: 'no_candidate' };
  }

  const durationMin = resolvedDurationMinutes(candidate, newRequest);
  const durationMs = durationMin * 60 * 1000;

  const slot = await findFirstCommonSlot(
    candidate.user,
    newRequest.user,
    durationMs,
    candidate,
    newRequest
  );
  if (!slot) {
    return { paired: false, reason: 'no_slot', durationMinutes: durationMin };
  }

  const ordered = [candidate, newRequest].sort((a, b) => a.created_at - b.created_at);
  const reqA = ordered[0];
  const reqB = ordered[1];
  const resolvedVenueId = resolvedVenueIdPair(reqA, reqB);

  const match = await prisma.$transaction(async (tx) => {
    const m = await tx.match.create({
      data: {
        request_a_id: reqA.id,
        request_b_id: reqB.id,
        venue_id: resolvedVenueId,
        start_time: slot.start,
        end_time: slot.end,
        duration_minutes: durationMin,
        status: 'pending_acceptance',
        user_a_accepted: false,
        user_b_accepted: false,
      },
    });
    await tx.matchRequest.update({
      where: { id: reqA.id },
      data: { status: 'matched', proposed_time: slot.start },
    });
    await tx.matchRequest.update({
      where: { id: reqB.id },
      data: { status: 'matched', proposed_time: slot.start },
    });
    return m;
  });

  return {
    paired: true,
    matchId: match.id,
    startTime: slot.start.toISOString(),
    endTime: slot.end.toISOString(),
    durationMinutes: durationMin,
  };
}

/**
 * Après acceptation mutuelle d’un duel : si le sport est collectif / groupe ouvert,
 * remplace la ligne Match par un GroupEvent en recrutement pour permettre à d’autres joueurs de demander à rejoindre.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @returns {Promise<boolean>} true si un groupe a été créé (Match supprimé)
 */
async function promoteScheduledDuelMatchToGroupEvent(tx, matchId) {
  const m = await tx.match.findUnique({
    where: { id: matchId },
    include: {
      request_a: { include: { sport: true } },
      request_b: { include: { sport: true } },
    },
  });
  if (!m || m.status !== 'scheduled') return false;
  if (m.request_a.sport_id !== m.request_b.sport_id) return false;
  const mode = m.request_a.sport.match_mode || 'duel';
  if (mode !== 'collective' && mode !== 'open_group') return false;

  const ge = await tx.groupEvent.create({
    data: {
      sport_id: m.request_a.sport_id,
      venue_id: m.venue_id,
      start_time: m.start_time,
      end_time: m.end_time,
      duration_minutes: m.duration_minutes,
      status: 'recruiting',
    },
  });

  await tx.groupEventMember.createMany({
    data: [
      { group_event_id: ge.id, user_id: m.request_a.user_id, is_founder: true },
      { group_event_id: ge.id, user_id: m.request_b.user_id, is_founder: true },
    ],
  });

  await tx.matchRequest.update({
    where: { id: m.request_a_id },
    data: {
      status: 'matched',
      proposed_time: m.start_time,
      group_event_id: ge.id,
    },
  });
  await tx.matchRequest.update({
    where: { id: m.request_b_id },
    data: {
      status: 'matched',
      proposed_time: m.start_time,
      group_event_id: ge.id,
    },
  });

  await tx.match.delete({ where: { id: m.id } });
  return true;
}

async function tryPairAfterCreate(newRequestId) {
  const newRequest = await prisma.matchRequest.findUnique({
    where: { id: newRequestId },
    include: { user: true, sport: true, venue: true },
  });

  if (!newRequest) {
    return { paired: false, reason: 'not_found' };
  }

  const mode = newRequest.sport.match_mode || 'duel';

  if (mode === 'collective' || mode === 'open_group') {
    const joinTry = await tryJoinExistingGroupEvent(newRequest);
    if (joinTry.joined) {
      return { paired: false, awaitingJoinApproval: true, ...joinTry };
    }
    return tryPairCollectiveAfterCreate(newRequest);
  }

  return tryPairDuelAfterCreate(newRequest);
}

module.exports = {
  tryPairAfterCreate,
  tryJoinExistingGroupEvent,
  findFirstCommonSlot,
  resolvedDurationMinutes,
  DEFAULT_DURATION_MIN,
  promoteScheduledDuelMatchToGroupEvent,
};
