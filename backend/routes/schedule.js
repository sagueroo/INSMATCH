const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentUser } = require('./auth');
const { professorMatchesTrigramWhere } = require('../utils/timetableMatch');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Extract the session type (CM/TD/TP) from the iCal title.
 * Example: "3TC-WEB-2025/2_TD/3TC-G1/Soutien" -> "TD"
 */
function extractType(title) {
  if (!title) return null;
  const match = title.match(/_([A-Z][A-Za-z]+)\//);
  if (match) {
    const t = match[1].toUpperCase();
    if (['CM', 'TD', 'TP', 'COURS', 'EXAM'].includes(t)) return t;
    if (t.startsWith('CM')) return 'CM';
    if (t.startsWith('TD')) return 'TD';
    if (t.startsWith('TP')) return 'TP';
  }
  return null;
}

/**
 * Build a human-readable subtitle from the title.
 * Example: "3TC-WEB-2025/2_TD/3TC-G1/Soutien" -> "Soutien"
 */
function extractSubtitle(title) {
  if (!title) return '';
  // Last segment after the final '/'
  const parts = title.split('/');
  const last = parts[parts.length - 1]?.trim();
  // Ignore empty or looks like a group code
  if (!last || /^3TC|^4TC|^\d/.test(last)) return '';
  return last;
}

/**
 * Même cours CM (ex. amphi Chappe) : une ligne par groupe dans la BDD, titres du type
 * .../3TC-G1/... vs .../3TC-G2/... On neutralise le code groupe pour fusionner.
 */
function normalizeTitleForProfessorDedup(title) {
  if (!title) return '';
  let t = title.trim();
  t = t.replace(/\/3TC-G\d+\//gi, '/TC-G*/');
  t = t.replace(/\/4TC-G\d+\//gi, '/TC-G*/');
  t = t.replace(/\b3TC-G\d+\b/gi, 'TC-G*');
  t = t.replace(/\b4TC-G\d+\b/gi, 'TC-G*');
  return t;
}

/**
 * CM / amphi commun : même créneau + même lieu + même cours (titre normalisé) → une seule ligne.
 */
function dedupeProfessorEvents(enriched) {
  const seen = new Set();
  const out = [];
  for (const e of enriched) {
    const st = new Date(e.start_time).getTime();
    const et = new Date(e.end_time).getTime();
    const loc = (e.location || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const titleNorm = normalizeTitleForProfessorDedup(e.title || '');
    const key = `${st}|${et}|${loc}|${titleNorm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/**
 * GET /schedule
 * Emploi du temps unifié : cours (class_events) + matchs INSAMATCH (scheduled / pending_acceptance), triés par heure.
 */
router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const isProfessor = user.user_role === 'professor' && user.professor_trigram;

    let events;
    if (isProfessor) {
      const trigram = String(user.professor_trigram).trim().toUpperCase();
      events = await prisma.classEvent.findMany({
        where: professorMatchesTrigramWhere(trigram),
        orderBy: { start_time: 'asc' },
      });
    } else {
      const { department, class_group } = user;
      events = await prisma.classEvent.findMany({
        where: { department, class_group },
        orderBy: { start_time: 'asc' },
      });
    }

    let enriched = events.map(e => ({
      source: 'course',
      id: e.id,
      department: e.department,
      class_group: e.class_group,
      subject: e.subject || null,
      title: e.title,
      subtitle: extractSubtitle(e.title),
      type: extractType(e.title),
      start_time: e.start_time,
      end_time: e.end_time,
      location: (e.location === '000000000' || !e.location) ? null : e.location,
      professor: e.professor || null,
    }));

    if (isProfessor) {
      enriched = dedupeProfessorEvents(enriched);
    }

    const userId = user.id;
    const insMatches = await prisma.match.findMany({
      where: {
        OR: [
          { request_a: { user_id: userId } },
          { request_b: { user_id: userId } },
        ],
        status: { in: ['scheduled', 'pending_acceptance'] },
      },
      include: {
        venue: true,
        request_a: {
          include: {
            user: { select: { id: true, first_name: true, last_name: true } },
            sport: true,
          },
        },
        request_b: {
          include: {
            user: { select: { id: true, first_name: true, last_name: true } },
            sport: true,
          },
        },
      },
      orderBy: { start_time: 'asc' },
    });

    const matchEvents = insMatches.map((m) => {
      const isA = m.request_a.user_id === userId;
      const partner = isA ? m.request_b.user : m.request_a.user;
      const sportName = m.request_a.sport?.name || m.request_b.sport?.name || 'Sport';
      const partnerLabel = partner
        ? `${partner.first_name} ${partner.last_name}`.trim()
        : 'Partenaire';
      return {
        source: 'insmatch',
        id: m.id,
        department: null,
        class_group: null,
        subject: null,
        title: `Match INSAMATCH · ${sportName}`,
        subtitle: `avec ${partnerLabel}`,
        type: 'MATCH',
        ins_match_status: m.status,
        start_time: m.start_time,
        end_time: m.end_time,
        location: m.venue?.name || null,
        professor: null,
      };
    });

    const merged = [...enriched, ...matchEvents].sort(
      (a, b) => new Date(a.start_time) - new Date(b.start_time)
    );

    res.json({
      events: merged,
      department: isProfessor ? null : user.department,
      class_group: isProfessor ? null : user.class_group,
      user_role: user.user_role || 'student',
      professor_trigram: isProfessor ? String(user.professor_trigram).trim().toUpperCase() : null,
    });
  } catch (error) {
    console.error('Erreur Schedule:', error);
    res.status(500).json({ detail: "Impossible de charger l'emploi du temps." });
  }
});

module.exports = router;
