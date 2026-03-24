const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Merges overlapping or adjacent intervals.
 */
function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a.start - b.start);
  const merged = [{ ...intervals[0] }];
  for (let i = 1; i < intervals.length; i++) {
    const cur = intervals[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) {
      last.end = new Date(Math.max(last.end, cur.end));
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * Validates that a search date is within the allowed rolling window:
 * - Not in the past (before today)
 * - Not beyond J+7
 * Returns { valid: bool, error: string|null }
 */
function validateSearchDate(searchDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 7);
  maxDate.setHours(23, 59, 59, 999);

  const d = new Date(searchDate);
  d.setHours(0, 0, 0, 0);

  if (d < today) {
    return { valid: false, error: `La date ${d.toLocaleDateString()} est dans le passé. La recherche est impossible.` };
  }
  if (d > maxDate) {
    return { valid: false, error: `La date ${d.toLocaleDateString()} dépasse la fenêtre autorée de 7 jours. La prochaine sync n'a pas encore eu lieu.` };
  }
  return { valid: true, error: null };
}

/**
 * Builds a Prisma WHERE clause for a given entity.
 * Accepts:
 *   - Student group: { type: 'student', department: '3', class_group: '1' }
 *   - Professor:     { type: 'professor', trigram: 'CGO' }
 */
function buildEntityQuery(entity) {
  if (entity.type === 'professor') {
    return { professor: { contains: entity.trigram } };
  }
  return { department: entity.department, class_group: entity.class_group };
}

/**
 * Get all busy intervals for a single entity on a given day.
 */
async function getBusyIntervals(entity, startOfDay, endOfDay) {
  const events = await prisma.classEvent.findMany({
    where: {
      ...buildEntityQuery(entity),
      start_time: { gte: startOfDay },
      end_time: { lte: endOfDay },
    },
    orderBy: { start_time: 'asc' },
  });
  return events.map(e => ({ start: e.start_time, end: e.end_time }));
}

/**
 * Functionality 1: Check if a specific time slot is free for one entity.
 * Returns { free: bool, conflicts: [] }
 */
async function checkSlotAvailability(entity, slotStart, slotEnd) {
  const startOfDay = new Date(slotStart);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(slotStart);
  endOfDay.setHours(23, 59, 59, 999);

  const busy = await getBusyIntervals(entity, startOfDay, endOfDay);

  const conflicts = busy.filter(b => b.start < slotEnd && b.end > slotStart);
  return { free: conflicts.length === 0, conflicts };
}

/**
 * Functionality 2: Find common free slots between two entities on a given date.
 * Works for: group/group, prof/prof, group/prof.
 */
async function findCommonFreeTime(entity1, entity2, searchDate) {
  const { valid, error } = validateSearchDate(searchDate);
  if (!valid) throw new Error(error);

  const startOfDay = new Date(searchDate);
  startOfDay.setHours(8, 0, 0, 0);
  const endOfDay = new Date(searchDate);
  endOfDay.setHours(20, 0, 0, 0);

  // Fetch busy intervals for both entities in parallel
  const [busy1, busy2] = await Promise.all([
    getBusyIntervals(entity1, startOfDay, endOfDay),
    getBusyIntervals(entity2, startOfDay, endOfDay),
  ]);

  const allBusy = mergeIntervals([...busy1, ...busy2]);

  // Compute free gaps
  const freeTimes = [];
  let cursor = startOfDay;

  for (const busy of allBusy) {
    if (cursor < busy.start) {
      freeTimes.push({ start: new Date(cursor), end: new Date(busy.start) });
    }
    if (busy.end > cursor) cursor = busy.end;
  }
  if (cursor < endOfDay) {
    freeTimes.push({ start: new Date(cursor), end: new Date(endOfDay) });
  }

  // Filter gaps shorter than 1 hour
  const MIN_MS = 60 * 60 * 1000;
  return freeTimes.filter(gap => gap.end - gap.start >= MIN_MS);
}

module.exports = { findCommonFreeTime, checkSlotAvailability, validateSearchDate, mergeIntervals };
