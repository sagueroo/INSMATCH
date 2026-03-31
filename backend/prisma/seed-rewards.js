/**
 * Script de seed pour initialiser les Récompenses dans la base de données.
 * Usage: node prisma/seed-rewards.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rewards = [
        { name: 'Premier Match', description: 'Complétez votre premier match', condition: 'matches_total:1' },
        { name: 'Sportif Régulier', description: '10 matchs au total', condition: 'matches_total:10' },
        { name: 'Champion Social', description: '20 partenaires différents', condition: 'partners:20' },
        { name: 'Marathonien', description: '50 matchs au total', condition: 'matches_total:50' },
    ];

    for (const r of rewards) {
        await prisma.reward.upsert({
            where: { name: r.name },
            update: { description: r.description, condition: r.condition },
            create: r,
        });
    }

    console.log('✅ Récompenses initialisées !');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
