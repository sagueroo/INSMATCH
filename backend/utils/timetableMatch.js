const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Merge an array of intervals [ {start: Date, end: Date}, ... ] 
 * into a non-overlapping array of intervals.
 */
function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  
  // Sort by start time
  intervals.sort((a, b) => a.start - b.start);
  
  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const lastMerged = merged[merged.length - 1];
    
    if (current.start <= lastMerged.end) {
      // Overlap: extend end if necessary
      lastMerged.end = new Date(Math.max(lastMerged.end, current.end));
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}

/**
 * Find common free time for two users/groups on a given date.
 */
async function findCommonFreeTime(user1, user2, searchDate) {
  // Define working hours for the day (8:00 to 20:00)
  const startOfDay = new Date(searchDate);
  startOfDay.setHours(8, 0, 0, 0);
  
  const endOfDay = new Date(searchDate);
  endOfDay.setHours(20, 0, 0, 0);

  // Fetch events for both users
  const events = await prisma.classEvent.findMany({
    where: {
      OR: [
        { department: user1.department, class_group: user1.class_group },
        { department: user2.department, class_group: user2.class_group }
      ],
      start_time: { gte: startOfDay },
      end_time: { lte: endOfDay }
    },
    orderBy: { start_time: 'asc' }
  });

  // Extract busy intervals
  const busyIntervals = events.map(e => ({
    start: e.start_time,
    end: e.end_time
  }));

  const mergedBusyIntervals = mergeIntervals(busyIntervals);

  // Find free times (gaps between busy intervals or borders)
  const freeTimes = [];
  let currentStart = startOfDay;

  for (const busy of mergedBusyIntervals) {
    if (currentStart < busy.start) {
      freeTimes.push({ start: new Date(currentStart), end: new Date(busy.start) });
    }
    // Advance currentStart if the busy interval ends later
    if (busy.end > currentStart) {
      currentStart = busy.end;
    }
  }

  // Add the last gap if any
  if (currentStart < endOfDay) {
    freeTimes.push({ start: new Date(currentStart), end: new Date(endOfDay) });
  }

  // Filter out short free times (e.g., less than 1 hour = 3600000 ms)
  const MIN_FREE_BLOCK_MS = 60 * 60 * 1000;
  return freeTimes.filter(gap => (gap.end - gap.start) >= MIN_FREE_BLOCK_MS);
}

module.exports = { findCommonFreeTime, mergeIntervals };
