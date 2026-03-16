const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Charge le .env

const { router: authRouter } = require('./routes/auth');
const chatRouter = require('./routes/chat');
const requestsRouter = require('./routes/requests');
const profileRouter = require('./routes/profile');

const app = express();

// --- CONFIGURATION CORS (Pour accepter le React sur le port 5173) ---
app.use(cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true
}));

// --- MIDDLEWARES ---
app.use(express.json()); // Permet de lire req.body en JSON (équivalent Pydantic natif)

// --- ROUTES ---
app.use('/auth', authRouter);
app.use('/chat', chatRouter);
app.use('/requests', requestsRouter);
app.use('/profile', profileRouter);

// --- ROUTE DE TEST ---
app.get('/', (req, res) => {
    res.json({ message: "API INSMATCH (Node.js) opérationnelle !" });
});

// --- LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    // Équivalent à uvicorn main:app --reload
    console.log(`🚀 Serveur en ligne sur http://127.0.0.1:${PORT}`);
});
