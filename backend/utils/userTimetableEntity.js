/**
 * Entité pour l’EDT / créneaux : étudiant (département + groupe) ou enseignant (trigramme).
 * @param {import('@prisma/client').User} user
 * @returns {{ type: 'student', department: string, class_group: string } | { type: 'professor', trigram: string }}
 */
function userToTimetableEntity(user) {
  if (user.user_role === 'professor' && user.professor_trigram && String(user.professor_trigram).trim()) {
    return { type: 'professor', trigram: String(user.professor_trigram).trim().toUpperCase() };
  }
  return { type: 'student', department: user.department, class_group: user.class_group };
}

module.exports = { userToTimetableEntity };
