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

/**
 * DELETE /requests/:id
 * Supprime une demande de match (seulement si elle appartient à l'utilisateur).
 */
router.delete('/:id', getCurrentUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const requestId = req.params.id;

        // Vérifier que la demande existe et appartient à l'utilisateur
        const matchRequest = await prisma.matchRequest.findUnique({
            where: { id: requestId },
        });

        if (!matchRequest) {
            return res.status(404).json({ detail: "Demande introuvable." });
        }

        if (matchRequest.user_id !== userId) {
            return res.status(403).json({ detail: "Tu ne peux supprimer que tes propres demandes." });
        }

        // Supprimer les matchs liés à cette demande d'abord
        await prisma.match.deleteMany({
            where: {
                OR: [
                    { request_a_id: requestId },
                    { request_b_id: requestId },
                ],
            },
        });

        // Supprimer la demande
        await prisma.matchRequest.delete({
            where: { id: requestId },
        });

        res.json({ message: "Demande supprimée avec succès." });

    } catch (error) {
        console.error("Erreur Delete Request:", error);
        res.status(500).json({ detail: "Impossible de supprimer la demande." });
    }
});

module.exports = router;
