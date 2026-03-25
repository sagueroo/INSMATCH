const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentUser } = require('./auth');

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
 * GET /schedule
 * Returns the connected user's timetable from the class_events table.
 */
router.get('/', getCurrentUser, async (req, res) => {
  try {
    const { department, class_group } = req.user;

    const events = await prisma.classEvent.findMany({
      where: { department, class_group },
      orderBy: { start_time: 'asc' },
    });

    const enriched = events.map(e => ({
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

    res.json({ events: enriched, department, class_group });
  } catch (error) {
    console.error('Erreur Schedule:', error);
    res.status(500).json({ detail: "Impossible de charger l'emploi du temps." });
  }
});

module.exports = router;
