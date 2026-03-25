const ical = require('node-ical');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Extract the 3-letter subject code from the iCal SUMMARY field.
 * Example: "3TC-TSN-2025/2_TD/3TC-G1/" -> "TSN"
 */
function extractSubject(summary) {
  if (!summary) return null;
  const str = (summary.val || summary).toString().trim();
  // Pattern: <PROMO>TC[-_\s]([A-Z0-9]{3,8})[-_\s]/i
  const match = str.match(/^\d+TC[-_\s]([A-Z0-9]{3,8})[-_\s]/i);
  if (match) return match[1].toUpperCase();
  // Fallback: look for any 3-8 uppercase block between dashes
  const parts = str.split('-');
  for (const part of parts) {
    const trimmed = part.trim();
    if (/^[A-Z0-9]{3,8}$/i.test(trimmed)) return trimmed.toUpperCase();
  }
  return null;
}

/**
 * Extract and normalize professor trigrams from the iCal DESCRIPTION field.
 * The description may contain one or multiple trigrams, e.g. "CGO" or "CGO\nAHI" or "CGO/AHI"
 * Returns a clean string like "CGO,AHI" or null if none.
 */
function extractProfessors(description) {
  if (!description) return null;
  // Trigrams: uppercase letters, exactly 3 chars
  const found = description.toString().match(/\b[A-Z]{3}\b/g);
  if (!found || found.length === 0) return null;
  // Deduplicate and join
  return [...new Set(found)].join(',');
}

/**
 * Synchronize timetable for a given promo+groupe.
 * Fetches from the TC-Net iCal URL, parses events, and keeps
 * only events within the next 7 days (today → J+7).
 * 
 * Sliding window mode: if `slidingDay` is provided (a Date object),
 * we delete events for J-1 and only insert events from J+7 that are new.
 * Default (full sync): delete all future events and reinsert.
 */
async function syncGroupTimetable(promo, groupe, slidingDay = null) {
  try {
    const now = new Date();
    // J+7 = the limit date we fetch up to
    const dateFin = new Date(now);
    dateFin.setDate(dateFin.getDate() + 7);
    dateFin.setHours(23, 59, 59, 999);

    const dateDeb = now.getTime();
    const url = `https://tc-net.insa-lyon.fr/aff/AffichageEdtPalmGroupe.jsp?promo=${promo}&groupe=${groupe}&dateDeb=${dateDeb}`;

    console.log(`📡 Téléchargement EDT P${promo}G${groupe}...`);
    const response = await axios.get(url, { responseType: 'text', timeout: 15000 });
    const events = ical.sync.parseICS(response.data);

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const newClassEvents = [];
    const seenKeys = new Set(); // Pour dédupliquer les événements

    for (const event of Object.values(events)) {
      if (event.type !== 'VEVENT') continue;
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      // Only keep events within [startOfToday, J+7]
      if (eventStart < startOfToday || eventStart > dateFin) continue;

      const title = event.summary || 'Cours sans nom';
      const key = `${eventStart.getTime()}|${eventEnd.getTime()}|${title}|${event.location || ''}`;
      
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      newClassEvents.push({
        department: promo.toString(),
        class_group: groupe.toString(),
        title: title,
        subject: extractSubject(event.summary),
        start_time: eventStart,
        end_time: eventEnd,
        location: event.location || null,
        professor: extractProfessors(event.description),
      });
    }

    await prisma.$transaction(async (tx) => {
      if (slidingDay) {
        // Sliding mode: delete only J-1 events
        const jMinus1Start = new Date(slidingDay);
        jMinus1Start.setDate(jMinus1Start.getDate() - 1);
        jMinus1Start.setHours(0, 0, 0, 0);
        const jMinus1End = new Date(jMinus1Start);
        jMinus1End.setHours(23, 59, 59, 999);

        await tx.classEvent.deleteMany({
          where: {
            department: promo.toString(),
            class_group: groupe.toString(),
            start_time: { gte: jMinus1Start, lte: jMinus1End },
          },
        });
      } else {
        // Full sync: delete ALL events for this group (cleaning up the past permanently)
        await tx.classEvent.deleteMany({
          where: {
            department: promo.toString(),
            class_group: groupe.toString(),
          },
        });
      }

      if (newClassEvents.length > 0) {
        await tx.classEvent.createMany({ data: newClassEvents, skipDuplicates: true });
      }
    });

    console.log(`✅ ${newClassEvents.length} événements synchronisés pour P${promo}G${groupe}`);
  } catch (error) {
    console.error(`❌ Erreur synchro P${promo}G${groupe}:`, error.message);
  }
}

// All 8 groups to sync: 3TC 1-4 and 4TC 1-4
const ALL_GROUPS = [
  { promo: 3, groupe: 1 },
  { promo: 3, groupe: 2 },
  { promo: 3, groupe: 3 },
  { promo: 3, groupe: 4 },
  { promo: 4, groupe: 1 },
  { promo: 4, groupe: 2 },
  { promo: 4, groupe: 3 },
  { promo: 4, groupe: 4 },
];

/**
 * Full sync of all 8 groups (used at startup or for a full reset).
 */
async function syncAllGroups(slidingDay = null) {
  console.log('🔄 Synchronisation des 8 groupes...');
  for (const g of ALL_GROUPS) {
    await syncGroupTimetable(g.promo, g.groupe, slidingDay);
  }
  console.log('🏁 Synchronisation complète terminée !');
}

module.exports = { syncGroupTimetable, syncAllGroups, extractSubject, extractProfessors };
