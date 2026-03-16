const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentUser } = require('./auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /requests
 * Récupère l'historique des demandes de matchs de l'utilisateur connecté.
 */
router.get('/', getCurrentUser, async (req, res) => {
    try {
        const userId = req.user.id;

        // Récupérer toutes les demandes triées par date de création (les plus récentes d'abord)
        const requests = await prisma.matchRequest.findMany({
            where: { user_id: userId },
            include: {
                sport: true // Pour récupérer le nom du sport
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Formater les données pour le frontend
        const formattedRequests = requests.map(req => {
            // Extraction rudimentaire du lieu et de l'heure depuis availability_notes
            // Format actuel: "Lieu: Gymnase C | Dispo: 18h00"
            const notes = req.availability_notes || "";
            let location = "Non spécifié";
            let time = "Non spécifié";

            if (notes.includes('|')) {
                const parts = notes.split('|');
                location = parts[0].replace('Lieu:', '').trim();
                time = parts[1].replace('Dispo:', '').trim();
            } else {
                time = notes;
            }

            return {
                id: req.id,
                sportName: req.sport.name,
                location: location,
                time: time,
                status: req.status, // "pending", "matched", "accepted"
                createdAt: req.created_at
            };
        });

        res.json(formattedRequests);

    } catch (error) {
        console.error("Erreur Fetch Requests:", error);
        res.status(500).json({ detail: "Impossible de récupérer vos demandes." });
    }
});

module.exports = router;
