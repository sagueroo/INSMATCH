const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sportsList = [
    'Tennis', 'Football', 'Basketball', 'Badminton', 
    'Volleyball', 'Rugby', 'Handball', 'Natation', 'Escalade', 'Ping-pong'
  ];

  console.log('Seeding sports...');
  for (const name of sportsList) {
    await prisma.sport.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log('Sports seeded successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
