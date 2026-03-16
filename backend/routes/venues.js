const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentUser } = require('./auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /venues
 * Retourne tous les lieux sportifs avec leurs coordonnées
 * et leur statut dynamique (disponible/occupé basé sur les matchs en cours)
 */
router.get('/', getCurrentUser, async (req, res) => {
    try {
        const now = new Date();

        const venues = await prisma.venue.findMany({
            where: { is_active: true },
            include: {
                sports: { include: { sport: true } },
                matches: {
                    where: {
                        start_time: { lte: now },
                        end_time: { gte: now },
                        status: { in: ['scheduled', 'accepted'] },
                    },
                    take: 1,
                },
            },
        });

        const result = venues
            .filter(v => v.latitude !== null && v.longitude !== null)
            .map(v => ({
                id: v.id,
                name: v.name,
                type: v.type || '',
                latitude: v.latitude,
                longitude: v.longitude,
                available: v.matches.length === 0,
                sports: v.sports.map(vs => vs.sport.name),
            }));

        res.json(result);
    } catch (error) {
        console.error("Erreur Venues:", error);
        res.status(500).json({ detail: "Impossible de charger les lieux." });
    }
});

module.exports = router;
