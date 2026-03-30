const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Matchs dont le créneau est passé :
 * - scheduled → completed + incrément UserSport.match_count (une fois par match)
 * - pending_acceptance → completed sans stats (jamais confirmé)
 */
async function processCompletedMatches() {
  const now = new Date();

  await prisma.match.updateMany({
    where: {
      end_time: { lt: now },
      status: 'pending_acceptance',
    },
    data: { status: 'completed' },
  });

  await prisma.groupEvent.updateMany({
    where: {
      end_time: { lt: now },
      status: 'recruiting',
    },
    data: { status: 'completed' },
  });

  const toRecord = await prisma.match.findMany({
    where: {
      end_time: { lt: now },
      status: 'scheduled',
      stats_recorded: false,
    },
    include: {
      request_a: true,
      request_b: true,
    },
  });

  for (const m of toRecord) {
    const sportId = m.request_a.sport_id;
    const users = [m.request_a.user_id, m.request_b.user_id];

    await prisma.$transaction(async (tx) => {
      for (const userId of users) {
        await tx.userSport.upsert({
          where: {
            user_id_sport_id: { user_id: userId, sport_id: sportId },
          },
          create: {
            user_id: userId,
            sport_id: sportId,
            match_count: 1,
          },
          update: {
            match_count: { increment: 1 },
          },
        });
      }

      await tx.match.update({
        where: { id: m.id },
        data: {
          status: 'completed',
          stats_recorded: true,
        },
      });
    });
  }
}

module.exports = { processCompletedMatches };
