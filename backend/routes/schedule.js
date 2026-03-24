const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentUser } = require('./auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /schedule
 * Retourne l'emploi du temps de l'utilisateur connecté
 * basé sur son department et class_group depuis la table class_events
 */
router.get('/', getCurrentUser, async (req, res) => {
  try {
    const { department, class_group } = req.user;

    // Requête raw car la table class_events n'est pas dans le schéma Prisma
    const events = await prisma.$queryRawUnsafe(
      `SELECT id, department, class_group, title, start_time, end_time, location
       FROM class_events
       WHERE department = $1 AND class_group = $2
       ORDER BY start_time ASC`,
      department,
      class_group
    );

    res.json({ events, department, class_group });
  } catch (error) {
    console.error('Erreur Schedule:', error);
    res.status(500).json({ detail: "Impossible de charger l'emploi du temps." });
  }
});

module.exports = router;
