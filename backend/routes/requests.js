const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentUser } = require('./auth');

const router = express.Router();
const prisma = new PrismaClient();
const { promoteScheduledDuelMatchToGroupEvent } = require('../utils/matchmaking');

const LOCATION_TBD = 'À convenir avec votre partenaire';

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

function buildRequestDto(req, userId, extras = {}) {
    const notes = req.availability_notes || '';
    const m = req.matchesAsReqA?.[0] || req.matchesAsReqB?.[0];
    const ge = req.group_event;

    const mode = req.sport?.match_mode || 'duel';
    const kind = mode === 'duel' ? 'duel' : 'collective';

    let location = LOCATION_TBD;
    if (m?.venue?.name) location = m.venue.name;
    else if (ge?.venue?.name) location = ge.venue.name;
    else if (req.venue?.name) location = req.venue.name;
    else if (notes.includes('|')) {
        const parts = notes.split('|');
        const locPart = parts[0].replace('Lieu:', '').trim();
        if (locPart) location = locPart;
    }

    let timeFromNotes = 'Non spécifié';
    if (notes.includes('|')) {
        const parts = notes.split('|');
        timeFromNotes = parts[1].replace('Dispo:', '').trim();
    } else if (notes) {
        timeFromNotes = notes.replace(/^Dispo:\s*/i, '').trim() || notes;
    }

    let partner = null;
    let matchId = null;
    let matchStatus = null;
    let slotStart = null;
    let slotEnd = null;
    let needsMyAction = false;
    let durationMinutes = null;

    if (m) {
        matchId = m.id;
        matchStatus = m.status;
        slotStart = m.start_time;
        slotEnd = m.end_time;
        durationMinutes = m.duration_minutes ?? 60;
        const imA = m.request_a_id === req.id;
        const other = imA ? m.request_b : m.request_a;
        if (other?.user) {
            partner = {
                firstName: other.user.first_name,
                lastName: other.user.last_name,
                email: other.user.email,
            };
        }
        if (m.status === 'pending_acceptance') {
            const isA = m.request_a_id === req.id;
            needsMyAction = isA ? !m.user_a_accepted : !m.user_b_accepted;
        }
    } else if (ge) {
        slotStart = ge.start_time;
        slotEnd = ge.end_time;
        durationMinutes = ge.duration_minutes ?? 60;
        matchStatus = ge.status;
        const others = (ge.members || []).filter((mem) => mem.user_id !== userId);
        partner = others[0]
            ? {
                  firstName: others[0].user?.first_name,
                  lastName: others[0].user?.last_name,
                  email: others[0].user?.email,
                  label: 'Groupe',
              }
            : null;
    }

    const slotLabel = slotStart && slotEnd ? formatSlotLabel(slotStart, slotEnd) : '';
    let timeDisplay = timeFromNotes;
    if (slotStart && slotEnd) {
        timeDisplay = slotLabel || timeFromNotes;
    }

    const awaitingJoinApproval = extras.awaitingJoinByRequestId?.[req.id] === true;

    return {
        id: req.id,
        sportName: req.sport.name,
        kind,
        location,
        time: timeDisplay,
        status: req.status,
        createdAt: req.created_at,
        proposedTime: req.proposed_time,
        matchId,
        matchStatus,
        groupEventId: ge?.id || null,
        participants:
            ge?.members?.map((mem) => ({
                firstName: mem.user?.first_name,
                lastName: mem.user?.last_name,
                isFounder: mem.is_founder,
            })) || null,
        slotStart: slotStart ? slotStart.toISOString() : null,
        slotEnd: slotEnd ? slotEnd.toISOString() : null,
        slotLabel,
        partner,
        needsMyAction,
        durationMinutes,
        awaitingJoinApproval,
    };
}

router.get('/', getCurrentUser, async (req, res) => {
    try {
        const userId = req.user.id;

        const requests = await prisma.matchRequest.findMany({
            where: { user_id: userId },
            include: {
                sport: true,
                venue: true,
                group_event: {
                    include: {
                        sport: true,
                        venue: true,
                        members: {
                            include: { user: { select: { first_name: true, last_name: true, email: true } } },
                        },
                    },
                },
                matchesAsReqA: {
                    include: {
                        request_b: { include: { user: true } },
                        venue: true,
                    },
                },
                matchesAsReqB: {
                    include: {
                        request_a: { include: { user: true } },
                        venue: true,
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });

        const pendingJoins = await prisma.groupJoinRequest.findMany({
            where: { applicant_user_id: userId, status: 'pending' },
            select: { applicant_match_request_id: true },
        });
        const awaitingJoinByRequestId = {};
        for (const pj of pendingJoins) {
            if (pj.applicant_match_request_id) {
                awaitingJoinByRequestId[pj.applicant_match_request_id] = true;
            }
        }

        const pendingJoinApprovals = await prisma.groupJoinRequest.findMany({
            where: {
                status: 'pending',
                group_event: {
                    members: { some: { user_id: userId, is_founder: true } },
                },
            },
            include: {
                applicant: { select: { first_name: true, last_name: true, email: true } },
                group_event: { include: { sport: true } },
            },
            orderBy: { created_at: 'desc' },
        });

        const formattedRequests = requests.map((r) => buildRequestDto(r, userId, { awaitingJoinByRequestId }));

        const pendingActionsCount =
            formattedRequests.filter((r) => r.needsMyAction).length +
            pendingJoinApprovals.length;

        res.json({
            requests: formattedRequests,
            pendingActionsCount,
            pendingJoinApprovals: pendingJoinApprovals.map((pj) => ({
                id: pj.id,
                groupEventId: pj.group_event_id,
                sportName: pj.group_event.sport.name,
                applicant: {
                    firstName: pj.applicant.first_name,
                    lastName: pj.applicant.last_name,
                    email: pj.applicant.email,
                },
            })),
        });
    } catch (error) {
        console.error('Erreur Fetch Requests:', error);
        res.status(500).json({ detail: "Impossible de récupérer vos demandes." });
    }
});

/**
 * POST /requests/match/cancel
 * Annule un match pour les deux joueurs (créneau proposé ou déjà confirmé).
 * Doit être déclaré avant /:id/respond pour éviter tout conflit de route.
 */
router.post('/match/cancel', getCurrentUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { matchId } = req.body;

        if (!matchId || typeof matchId !== 'string') {
            return res.status(400).json({ detail: 'matchId requis.' });
        }

        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: {
                request_a: { select: { user_id: true } },
                request_b: { select: { user_id: true } },
            },
        });

        if (!match) {
            return res.status(404).json({ detail: 'Match introuvable.' });
        }

        const isParticipant =
            match.request_a.user_id === userId || match.request_b.user_id === userId;
        if (!isParticipant) {
            return res.status(403).json({ detail: "Tu ne fais pas partie de ce match." });
        }

        if (!['scheduled', 'pending_acceptance'].includes(match.status)) {
            return res.status(400).json({
                detail: 'Ce match est terminé ou ne peut plus être annulé.',
            });
        }

        await prisma.$transaction(async (tx) => {
            await tx.match.delete({ where: { id: match.id } });
            await tx.matchRequest.update({
                where: { id: match.request_a_id },
                data: { status: 'pending', proposed_time: null, group_event_id: null },
            });
            await tx.matchRequest.update({
                where: { id: match.request_b_id },
                data: { status: 'pending', proposed_time: null, group_event_id: null },
            });
        });

        return res.json({
            ok: true,
            message:
                'Match annulé pour toi et ton partenaire. Vous pouvez relancer une recherche.',
        });
    } catch (error) {
        console.error('Erreur cancel match:', error);
        res.status(500).json({ detail: "Impossible d'annuler ce match." });
    }
});

router.post('/:id/respond', getCurrentUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const requestId = req.params.id;
        const { action } = req.body;

        if (!['accept', 'decline'].includes(action)) {
            return res.status(400).json({ detail: 'Action invalide (accept ou decline).' });
        }

        const matchRequest = await prisma.matchRequest.findUnique({
            where: { id: requestId },
        });

        if (!matchRequest) {
            return res.status(404).json({ detail: 'Demande introuvable.' });
        }

        if (matchRequest.user_id !== userId) {
            return res.status(403).json({ detail: 'Cette demande ne t\'appartient pas.' });
        }

        const match = await prisma.match.findFirst({
            where: {
                OR: [{ request_a_id: requestId }, { request_b_id: requestId }],
            },
        });

        if (!match) {
            return res.status(400).json({ detail: 'Aucun match en attente pour cette demande.' });
        }

        if (action === 'decline') {
            await prisma.$transaction(async (tx) => {
                await tx.matchRequest.update({
                    where: { id: match.request_a_id },
                    data: { status: 'pending', proposed_time: null },
                });
                await tx.matchRequest.update({
                    where: { id: match.request_b_id },
                    data: { status: 'pending', proposed_time: null },
                });
                await tx.match.delete({ where: { id: match.id } });
            });
            return res.json({ ok: true, message: 'Match annulé. Vos recherches sont à nouveau actives.' });
        }

        if (match.status === 'scheduled') {
            return res.json({ ok: true, message: 'Match déjà confirmé.' });
        }

        if (match.status !== 'pending_acceptance') {
            return res.status(400).json({ detail: 'Ce match ne peut plus être modifié.' });
        }

        const isA = match.request_a_id === requestId;

        const updated = await prisma.match.update({
            where: { id: match.id },
            data: isA ? { user_a_accepted: true } : { user_b_accepted: true },
        });

        if (updated.user_a_accepted && updated.user_b_accepted) {
            let formedGroup = false;
            await prisma.$transaction(async (tx) => {
                await tx.match.update({
                    where: { id: match.id },
                    data: { status: 'scheduled' },
                });
                formedGroup = await promoteScheduledDuelMatchToGroupEvent(tx, match.id);
                if (!formedGroup) {
                    await tx.matchRequest.updateMany({
                        where: { id: { in: [match.request_a_id, match.request_b_id] } },
                        data: { status: 'accepted' },
                    });
                }
            });
            return res.json({
                ok: true,
                message: formedGroup
                    ? 'Match confirmé ! Un groupe ouvert a été créé sur ce créneau — d’autres joueurs pourront demander à se joindre.'
                    : 'Match confirmé ! À bientôt sur le terrain.',
            });
        }

        return res.json({ ok: true, message: 'Ta réponse est enregistrée. En attente de l\'autre joueur.' });
    } catch (error) {
        console.error('Erreur respond:', error);
        res.status(500).json({ detail: 'Impossible de traiter ta réponse.' });
    }
});

router.delete('/:id', getCurrentUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const requestId = req.params.id;

        const matchRequest = await prisma.matchRequest.findUnique({
            where: { id: requestId },
        });

        if (!matchRequest) {
            return res.status(404).json({ detail: 'Demande introuvable.' });
        }

        if (matchRequest.user_id !== userId) {
            return res.status(403).json({ detail: 'Tu ne peux supprimer que tes propres demandes.' });
        }

        await prisma.groupJoinRequest.deleteMany({
            where: { applicant_match_request_id: requestId, status: 'pending' },
        });

        if (matchRequest.group_event_id) {
            await prisma.groupEventMember.deleteMany({
                where: { user_id: userId, group_event_id: matchRequest.group_event_id },
            });
        }

        await prisma.match.deleteMany({
            where: {
                OR: [{ request_a_id: requestId }, { request_b_id: requestId }],
            },
        });

        await prisma.matchRequest.delete({
            where: { id: requestId },
        });

        res.json({ message: 'Demande supprimée avec succès.' });
    } catch (error) {
        console.error('Erreur Delete Request:', error);
        res.status(500).json({ detail: 'Impossible de supprimer la demande.' });
    }
});

module.exports = router;
