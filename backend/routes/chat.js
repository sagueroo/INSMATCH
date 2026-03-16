const express = require('express');
const { getCurrentUser } = require('./auth');
const { chatWithAgent } = require('../ai_agent');

const router = express.Router();

/**
 * POST /chat
 * Route principale pour parler à l'IA.
 * `getCurrentUser` joue le rôle du `Depends(get_current_user)` en bloquant l'accès si pas de Token.
 */
router.post('/', getCurrentUser, async (req, res) => {
    try {
        const { history } = req.body;

        if (!history || !Array.isArray(history)) {
            return res.status(400).json({ detail: "Historique manquant ou invalide." });
        }

        // Appel à Llama-3 en passant l'étudiant actuel (req.user)
        const agentReply = await chatWithAgent(history, req.user);

        res.json({ reply: agentReply });
        
    } catch (error) {
        console.error("Erreur serveur Chat:", error);
        res.status(500).json({ detail: "Erreur lors de la discussion avec l'IA." });
    }
});

module.exports = router;
