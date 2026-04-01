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

// Chrome (Private Network Access) : requêtes depuis localhost vers 127.0.0.1 — en-tête utile si l’API est appelée en cross-origin direct.
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    next();
});

// --- CORS : localhost (Vite) + origines prod (ALLOWED_ORIGINS dans .env, séparées par des virgules) ---
const defaultCorsOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
];
const extraCorsOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
const corsAllowed = [...new Set([...defaultCorsOrigins, ...extraCorsOrigins])];

if (extraCorsOrigins.length > 0) {
    console.log(`[CORS] ${corsAllowed.length} origine(s) — prod: ${extraCorsOrigins.join(', ')}`);
}

app.use(
    cors({
        origin(origin, callback) {
            if (!origin) return callback(null, true);
            if (corsAllowed.includes(origin)) return callback(null, true);
            console.warn(`CORS refusé pour origine: ${origin} — ajoute-la dans ALLOWED_ORIGINS (backend .env) si c’est ton front.`);
            return callback(null, false);
        },
        credentials: true,
    })
);

// --- MIDDLEWARES ---
app.use(express.json()); // Permet de lire req.body en JSON (équivalent Pydantic natif)

// --- ROUTES ---
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/community', communityRouter);
app.use('/api/venues', venuesRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/group-events', groupEventsRouter);
app.use('/api/notifications', notificationsRouter);

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
