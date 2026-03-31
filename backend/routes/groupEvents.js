const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentUser } = require('./auth');
const {
  checkSlotAvailability,
  parseTimeConstraints,
  slotStartSatisfiesTimeConstraints,
} = require('../utils/timetableMatch');
const { userToTimetableEntity } = require('../utils/userTimetableEntity');

const router = express.Router();
const prisma = new PrismaClient();

function formatSlotLabel(start, end) {
  if (!start || !end) return '';
  const d = new Date(start);
  const d2 = new Date(end);
  const dayPart = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  const endPart = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d2);
  return `${dayPart} – ${endPart}`;
}

router.get('/', getCurrentUser, async (req, res) => {
  try {
    const now = new Date();
    const events = await prisma.groupEvent.findMany({
      where: { status: 'recruiting', start_time: { gte: now } },
      include: {
        sport: true,
        venue: true,
        members: {
          include: { user: { select: { id: true, first_name: true, last_name: true } } },
        },
      },
      orderBy: { start_time: 'asc' },
      take: 50,
    });

    const result = events.map((ev) => ({
      id: ev.id,
      sportName: ev.sport.name,
      matchMode: ev.sport.match_mode,
      maxPlayers: ev.sport.max_players,
      venueName: ev.venue?.name ?? 'À convenir',
      startTime: ev.start_time.toISOString(),
      endTime: ev.end_time.toISOString(),
      slotLabel: formatSlotLabel(ev.start_time, ev.end_time),
      participantCount: ev.members.length,
      members: ev.members.map((m) => ({
        id: m.user.id,
        firstName: m.user.first_name,
        lastName: m.user.last_name,
        isFounder: m.is_founder,
      })),
    }));

    res.json({ events: result });
  } catch (e) {
    console.error('GET /group-events', e);
    res.status(500).json({ detail: 'Impossible de charger les événements.' });
  }
});

router.post('/join-requests/:jrId/respond', getCurrentUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ detail: 'Action invalide.' });
    }

    const jr = await prisma.groupJoinRequest.findUnique({
      where: { id: req.params.jrId },
      include: {
        group_event: { include: { sport: true, members: true } },
        applicant: true,
      },
    });

    if (!jr || jr.status !== 'pending') {
      return res.status(400).json({ detail: 'Demande introuvable ou déjà traitée.' });
    }

    const founder = jr.group_event.members.find((m) => m.user_id === userId && m.is_founder);
    if (!founder) {
      return res.status(403).json({ detail: 'Seuls les organisateurs peuvent répondre.' });
    }

    if (action === 'reject') {
      await prisma.$transaction([
        prisma.groupJoinRequest.update({
          where: { id: jr.id },
          data: { status: 'rejected', resolved_at: new Date() },
        }),
        prisma.notification.create({
          data: {
            user_id: jr.applicant_user_id,
            type: 'join_rejected',
            title: 'Demande refusée',
            body: `Ta demande pour rejoindre (${jr.group_event.sport?.name || 'sport'}) a été refusée.`,
            group_event_id: jr.group_event_id,
            join_request_id: jr.id,
          },
        }),
      ]);
      return res.json({ ok: true, message: 'Demande refusée.' });
    }

    const ev = jr.group_event;
    const max = ev.sport.max_players;
    if (max != null && ev.members.length >= max) {
      return res.status(400).json({ detail: 'L\'événement est complet.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupEventMember.create({
        data: {
          group_event_id: ev.id,
          user_id: jr.applicant_user_id,
          is_founder: false,
        },
      });

      if (jr.applicant_match_request_id) {
        await tx.matchRequest.update({
          where: { id: jr.applicant_match_request_id },
          data: {
            status: 'matched',
            proposed_time: ev.start_time,
            group_event_id: ev.id,
          },
        });
      } else {
        await tx.matchRequest.updateMany({
          where: {
            user_id: jr.applicant_user_id,
            sport_id: ev.sport_id,
            status: 'pending',
            group_event_id: null,
          },
          data: {
            status: 'matched',
            proposed_time: ev.start_time,
            group_event_id: ev.id,
          },
        });
      }

      await tx.groupJoinRequest.update({
        where: { id: jr.id },
        data: { status: 'approved', resolved_at: new Date() },
      });

      await tx.notification.create({
        data: {
          user_id: jr.applicant_user_id,
          type: 'join_approved',
          title: 'Tu es dans le groupe !',
          body: `Tu as été accepté pour ${jr.group_event.sport?.name || 'l\'événement'}.`,
          group_event_id: ev.id,
          join_request_id: jr.id,
        },
      });
    });

    res.json({ ok: true, message: 'Participant ajouté.' });
  } catch (e) {
    console.error('respond join', e);
    res.status(500).json({ detail: 'Impossible de traiter la demande.' });
  }
});

router.get('/:id', getCurrentUser, async (req, res) => {
  try {
    const ev = await prisma.groupEvent.findUnique({
      where: { id: req.params.id },
      include: {
        sport: true,
        venue: true,
        members: {
          include: { user: { select: { id: true, first_name: true, last_name: true, email: true } } },
          orderBy: { joined_at: 'asc' },
        },
        joinRequests: {
          where: { status: 'pending' },
          include: {
            applicant: { select: { id: true, first_name: true, last_name: true, email: true } },
          },
        },
      },
    });

    if (!ev) {
      return res.status(404).json({ detail: 'Événement introuvable.' });
    }

    res.json({
      id: ev.id,
      sportName: ev.sport.name,
      matchMode: ev.sport.match_mode,
      maxPlayers: ev.sport.max_players,
      venueName: ev.venue?.name ?? 'À convenir avec le groupe',
      status: ev.status,
      startTime: ev.start_time.toISOString(),
      endTime: ev.end_time.toISOString(),
      slotLabel: formatSlotLabel(ev.start_time, ev.end_time),
      durationMinutes: ev.duration_minutes,
      members: ev.members.map((m) => ({
        id: m.user.id,
        firstName: m.user.first_name,
        lastName: m.user.last_name,
        email: m.user.email,
        isFounder: m.is_founder,
      })),
      pendingJoinRequests: ev.joinRequests.map((j) => ({
        id: j.id,
        applicant: {
          id: j.applicant.id,
          firstName: j.applicant.first_name,
          lastName: j.applicant.last_name,
          email: j.applicant.email,
        },
      })),
    });
  } catch (e) {
    console.error('GET /group-events/:id', e);
    res.status(500).json({ detail: 'Impossible de charger l\'événement.' });
  }
});

router.post('/:id/join', getCurrentUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const event = await prisma.groupEvent.findUnique({
      where: { id: req.params.id },
      include: { sport: true, venue: true, members: true },
    });

    if (!event || event.status !== 'recruiting') {
      return res.status(400).json({ detail: 'Cet événement n\'accepte plus de participants.' });
    }

    if (event.members.some((m) => m.user_id === userId)) {
      return res.status(400).json({ detail: 'Tu participes déjà à cet événement.' });
    }

    const max = event.sport.max_players;
    if (max != null && event.members.length >= max) {
      return res.status(400).json({ detail: 'L\'événement est complet.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const { free } = await checkSlotAvailability(userToTimetableEntity(user), event.start_time, event.end_time);
    if (!free) {
      return res.status(400).json({
        detail: 'Ce créneau chevauche tes cours : impossible de rejoindre.',
      });
    }

    const existingPending = await prisma.groupJoinRequest.findFirst({
      where: { applicant_user_id: userId, status: 'pending' },
    });
    if (existingPending) {
      return res.status(400).json({ detail: 'Tu as déjà une demande en attente pour un groupe.' });
    }

    let mr = await prisma.matchRequest.findFirst({
      where: {
        user_id: userId,
        sport_id: event.sport_id,
        status: 'pending',
        group_event_id: null,
      },
    });

    if (!mr) {
      mr = await prisma.matchRequest.create({
        data: {
          user_id: userId,
          sport_id: event.sport_id,
          venue_id: event.venue_id,
          availability_notes: 'Dispo: inscription Communauté',
        },
      });
    }

    if (!slotStartSatisfiesTimeConstraints(event.start_time, parseTimeConstraints(mr))) {
      return res.status(400).json({
        detail:
          'Ce créneau ne respecte pas tes contraintes horaires enregistrées (par ex. week-end après une certaine heure).',
      });
    }

    const jr = await prisma.groupJoinRequest.create({
      data: {
        group_event_id: event.id,
        applicant_user_id: userId,
        applicant_match_request_id: mr.id,
        status: 'pending',
      },
    });

    const founders = await prisma.groupEventMember.findMany({
      where: { group_event_id: event.id, is_founder: true },
    });
    const name = `${user.first_name} ${user.last_name}`;
    for (const f of founders) {
      if (f.user_id === userId) continue;
      await prisma.notification.create({
        data: {
          user_id: f.user_id,
          type: 'group_join_request',
          title: 'Demande pour rejoindre ton événement',
          body: `${name} souhaite rejoindre (inscription manuelle).`,
          group_event_id: event.id,
          join_request_id: jr.id,
        },
      });
    }

    res.json({
      ok: true,
      message: 'Demande envoyée. Un organisateur doit accepter.',
      joinRequestId: jr.id,
    });
  } catch (e) {
    console.error('POST /group-events/:id/join', e);
    res.status(500).json({ detail: 'Impossible de rejoindre l\'événement.' });
  }
});

module.exports = router;
