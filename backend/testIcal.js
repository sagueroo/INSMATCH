const { syncGroupTimetable } = require('./utils/syncTimetables');
const { findCommonFreeTime } = require('./utils/timetableMatch');

async function runTest() {
  console.log('--- DÉBUT DU TEST DE SYNCHRONISATION ---');
  
  // 1. On synchronise l'emploi du temps de 3TC Groupe 1 et 3TC Groupe 4
  await syncGroupTimetable(3, 1);
  await syncGroupTimetable(3, 4);
  
  console.log('\n--- TEST DE COMPARAISON DES HORAIRES ---');
  
  // 2. On définit une date pour la recherche (par exemple, la date actuelle)
  const searchDate = new Date();
  
  // Si on est le week-end ou tard le soir, on peut ajouter quelques jours pour tester :
  // searchDate.setDate(searchDate.getDate() + 2);

  // 3. On simule deux profils d'utilisateurs
  const user1 = { department: '3', class_group: '1' };
  const user2 = { department: '3', class_group: '4' };

  console.log(`Recherche de temps libre le ${searchDate.toLocaleDateString()} entre P3G1 et P3G4...`);
  
  const freeTimes = await findCommonFreeTime(user1, user2, searchDate);

  console.log('\n--- RÉSULTAT DU MATCHING ---');
  if (freeTimes.length === 0) {
    console.log("Aucun créneau libre commun supérieur à 1h n'a été trouvé ce jour-là.");
  } else {
    console.log(`✅ ${freeTimes.length} créneaux libres trouvés :`);
    freeTimes.forEach((slot, index) => {
      const startStr = slot.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const endStr = slot.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      console.log(`  - Créneau ${index + 1}  : de ${startStr} à ${endStr}`);
    });
  }
}

runTest()
  .then(() => {
    console.log('\nFin du test !');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
