require('dotenv').config();
const { syncAllGroups } = require('./utils/syncTimetables');
const { findCommonFreeTime, checkSlotAvailability } = require('./utils/timetableMatch');

async function runTest() {
  console.log('=== TEST 1 : Synchronisation des 8 groupes ===');
  await syncAllGroups();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(`\n=== TEST 2 : Créneaux libres communs (groupe vs groupe) ===`);
  console.log(`Date de recherche : ${tomorrow.toLocaleDateString()}`);
  const g1 = { type: 'student', department: '3', class_group: '1' };
  const g4 = { type: 'student', department: '3', class_group: '4' };
  const slots1 = await findCommonFreeTime(g1, g4, tomorrow);
  printSlots('3TC1 vs 3TC4', slots1);

  console.log(`\n=== TEST 3 : Créneaux libres communs (étudiant vs prof) ===`);
  const prof = { type: 'professor', trigram: 'CGO' };
  const slots2 = await findCommonFreeTime(g1, prof, tomorrow);
  printSlots('3TC1 vs Prof CGO', slots2);

  console.log(`\n=== TEST 4 : Vérification d'un créneau spécifique (Fonctionnalité 1) ===`);
  // Créneau libre (12h - 14h)
  const slotStart = new Date(tomorrow);
  slotStart.setHours(12, 0, 0, 0);
  const slotEnd = new Date(tomorrow);
  slotEnd.setHours(14, 0, 0, 0);
  const avail = await checkSlotAvailability(g1, slotStart, slotEnd);
  console.log(`3TC1 disponible de 12h à 14h le ${tomorrow.toLocaleDateString()} ?`, avail.free ? '✅ OUI' : `❌ NON (${avail.conflicts.length} conflit(s))`);

  // Créneau occupé (ex: 08h - 12h)
  const slotStartBusy = new Date(tomorrow);
  slotStartBusy.setHours(8, 0, 0, 0);
  const slotEndBusy = new Date(tomorrow);
  slotEndBusy.setHours(12, 0, 0, 0);
  const availBusy = await checkSlotAvailability(g1, slotStartBusy, slotEndBusy);
  console.log(`3TC1 disponible de 08h à 12h le ${tomorrow.toLocaleDateString()} ?`, availBusy.free ? '✅ OUI' : `❌ NON (${availBusy.conflicts.length} conflit(s))`);
}

function printSlots(label, slots) {
  if (slots.length === 0) {
    console.log(`  ❌ [${label}] Aucun créneau commun trouvé.`);
    return;
  }
  console.log(`  ✅ [${label}] ${slots.length} créneau(x) :`);
  slots.forEach((s, i) => {
    const start = s.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const end = s.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dur = Math.round((s.end - s.start) / 60000);
    console.log(`    Créneau ${i + 1}: ${start} → ${end} (${dur} min)`);
  });
}

runTest()
  .then(() => { console.log('\nFin du test !'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
