const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const venues = [
    { name: "Piscine INSA", type: "Piscine / complexe SIUAPS", latitude: 45.783795, longitude: 4.877634 },
    { name: "Salle omnisports (intérieure)", type: "Salle omnisports intérieure", latitude: 45.784095, longitude: 4.877646 },
    { name: "Terrain multisports", type: "Terrain multisports", latitude: 45.78556, longitude: 4.87775 },
    { name: "Gymnase C (Colette Besson)", type: "Gymnase couvert", latitude: 45.785016, longitude: 4.873238 },
    { name: "Gymnase B (Alain Gilles)", type: "Gymnase couvert", latitude: 45.785521, longitude: 4.883419 },
    { name: "Terrain de rugby INSA", type: "Terrain de rugby synthétique", latitude: 45.786057, longitude: 4.878807 },
    { name: "Terrain de football", type: "Terrain de foot extérieur", latitude: 45.785439, longitude: 4.876261 },
    { name: "Piste d'athlétisme", type: "Piste d'athlétisme extérieure", latitude: 45.785474, longitude: 4.877212 },
    { name: "Terrains de tennis extérieurs 2", type: "Courts de tennis", latitude: 45.784445, longitude: 4.873515 },
    { name: "Terrains de tennis extérieurs 1", type: "Courts de tennis", latitude: 45.784539, longitude: 4.878319 },
    { name: "Terrains de basket extérieurs", type: "Terrains de basket", latitude: 45.785436, longitude: 4.883025 },
    { name: "Terrains de volley extérieurs", type: "Terrains de volley", latitude: 45.78497, longitude: 4.881431 },
];

async function main() {
    console.log("🏟️  Seed des venues avec coordonnées...");

    for (const venue of venues) {
        await prisma.venue.upsert({
            where: { id: '00000000-0000-0000-0000-000000000000' }, // force create
            update: {},
            create: {
                name: venue.name,
                type: venue.type,
                latitude: venue.latitude,
                longitude: venue.longitude,
                is_active: true,
            },
        });
    }

    // Also update any existing venues that might match by name
    for (const venue of venues) {
        await prisma.venue.updateMany({
            where: { name: venue.name },
            data: {
                type: venue.type,
                latitude: venue.latitude,
                longitude: venue.longitude,
            },
        });
    }

    console.log(`✅ ${venues.length} venues insérées/mises à jour.`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
