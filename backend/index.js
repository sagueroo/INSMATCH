const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Charge le .env

const { router: authRouter } = require('./routes/auth');
const chatRouter = require('./routes/chat');
const requestsRouter = require('./routes/requests');
const profileRouter = require('./routes/profile');
const communityRouter = require('./routes/community');
const venuesRouter = require('./routes/venues');
const scheduleRouter = require('./routes/schedule');
const groupEventsRouter = require('./routes/groupEvents');
const notificationsRouter = require('./routes/notifications');

const app = express();

// --- CONFIGURATION CORS (Pour accepter le React sur le port 5173) ---
app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175"],
    credentials: true
}));

// --- MIDDLEWARES ---
app.use(express.json()); // Permet de lire req.body en JSON (équivalent Pydantic natif)

// --- ROUTES ---
app.use('/auth', authRouter);
app.use('/chat', chatRouter);
app.use('/requests', requestsRouter);
app.use('/profile', profileRouter);
app.use('/community', communityRouter);
app.use('/venues', venuesRouter);
app.use('/schedule', scheduleRouter);
app.use('/group-events', groupEventsRouter);
app.use('/notifications', notificationsRouter);

// --- ROUTE DE TEST ---
app.get('/', (req, res) => {
    res.json({ message: "API INSMATCH (Node.js) opérationnelle !" });
});

// --- SYNCHRONISATION EMPLOI DU TEMPS ---
const cron = require('node-cron');
const { syncAllGroups } = require('./utils/syncTimetables');
const { processCompletedMatches } = require('./utils/processCompletedMatches');

// CRON JOB : Tous les soirs à 03:00 — fenêtre glissante J-1 supprimé / J+7 ajouté
cron.schedule('0 3 * * *', async () => {
    console.log('🔄 Lancement de la synchronisation nocturne des EDT (fenêtre glissante)...');
    await syncAllGroups(new Date()); // passe la date du jour pour le mode sliding
    console.log('🏁 Synchronisation terminée !');
});

// Matchs terminés → compteur par sport (UserSport) + statut completed
cron.schedule('*/15 * * * *', async () => {
    try {
        await processCompletedMatches();
    } catch (e) {
        console.error('Erreur processCompletedMatches:', e.message);
    }
});

// Sync initiale au démarrage du serveur (full sync, sans sliding)
syncAllGroups().catch(err => console.error('Erreur sync initiale:', err.message));
processCompletedMatches().catch(err => console.error('Erreur matchs complétés (init):', err.message));

// --- LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    // Équivalent à uvicorn main:app --reload
    console.log(`🚀 Serveur en ligne sur http://127.0.0.1:${PORT}`);
});
