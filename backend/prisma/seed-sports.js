const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/** Basketball / Foot etc. = collective pour permettre les équipes + 3e joueur sur créneau fixe */
const SPORT_CONFIG = {
  Tennis: { match_mode: 'collective', max_players: 4 },
  Football: { match_mode: 'collective', max_players: 16 },
  Basketball: { match_mode: 'collective', max_players: 16 },
  Badminton: { match_mode: 'collective', max_players: 4 },
  Volleyball: { match_mode: 'collective', max_players: 12 },
  Rugby: { match_mode: 'collective', max_players: 16 },
  Handball: { match_mode: 'collective', max_players: 14 },
  Natation: { match_mode: 'open_group', max_players: null },
  Escalade: { match_mode: 'open_group', max_players: null },
  'Ping-pong': { match_mode: 'duel', max_players: null },
};

async function main() {
  const names = Object.keys(SPORT_CONFIG);
  console.log('Seeding sports (modes collectifs / duel)...');
  for (const name of names) {
    const cfg = SPORT_CONFIG[name];
    await prisma.sport.upsert({
      where: { name },
      update: { match_mode: cfg.match_mode, max_players: cfg.max_players },
      create: {
        name,
        match_mode: cfg.match_mode,
        max_players: cfg.max_players,
      },
    });
  }
  console.log('OK — Basketball est en mode « collective » : les joueurs suivants rejoignent le groupe existant.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
