const ical = require('node-ical');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncGroupTimetable(promo, groupe) {
  try {
    const dateDeb = new Date().getTime(); 
    const url = `https://tc-net.insa-lyon.fr/aff/AffichageEdtPalmGroupe.jsp?promo=${promo}&groupe=${groupe}&dateDeb=${dateDeb}`;

    console.log(`📡 Téléchargement de l'EDT promo ${promo} groupe ${groupe}...`);
    
    const response = await axios.get(url, { responseType: 'text' });
    const events = ical.sync.parseICS(response.data);

    const newClassEvents = [];
    for (const event of Object.values(events)) {
      if (event.type === 'VEVENT') {
        newClassEvents.push({
          department: promo.toString(),
          class_group: groupe.toString(),
          title: event.summary || 'Cours sans nom',
          start_time: new Date(event.start),
          end_time: new Date(event.end),
          location: event.location || null
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.classEvent.deleteMany({
        where: {
          department: promo.toString(),
          class_group: groupe.toString(),
          start_time: { gte: new Date() }
        }
      });

      if (newClassEvents.length > 0) {
        await tx.classEvent.createMany({ data: newClassEvents });
      }
    });

    console.log(`✅ ${newClassEvents.length} événements mis à jour pour P${promo}G${groupe}`);

  } catch (error) {
    console.error(`❌ Erreur lors de la synchro P${promo}G${groupe}:`, error.message);
  }
}

module.exports = { syncGroupTimetable };
