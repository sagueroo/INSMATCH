const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst();
  if (!user) { console.log('no user'); return; }
  console.log("User:", user.id);
  
  const sport = await prisma.sport.findFirst({ where: { name: 'Tennis' }});
  if (!sport) { console.log('no sport'); return; }
  console.log("Sport:", sport.id);
  
  try {
      await prisma.$transaction(async (tx) => {
        await tx.userSport.create({
            data: {
            user_id: user.id,
            sport_id: sport.id,
            level: "Débutant",
            match_count: 0
            }
        });
      });
      console.log('Transaction success');
  } catch (err) {
      console.error('Transaction error:', err);
  }
  
  const res = await prisma.userSport.findMany();
  console.log("User sports in DB:", res);
}
run().catch(console.error).finally(()=>prisma.$disconnect());
