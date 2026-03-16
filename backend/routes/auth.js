const express = require('express');
const { PrismaClient } = require('@prisma/client');
const security = require('../utils/security');
const jwt = require('jsonwebtoken');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Middleware de sécurité équivalent à get_current_user de FastAPI
 * Vérifie le token (badge) de l'utilisateur.
 */
async function getCurrentUser(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ detail: "Session invalide ou expirée. Reconnecte-toi." });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, security.SECRET_KEY);
        const userId = payload.sub;

        if (!userId) {
            return res.status(401).json({ detail: "Session invalide." });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(401).json({ detail: "Utilisateur introuvable." });
        }

        // On attache l'étudiant à la requête pour que la suite du code y ait accès
        req.user = user;
        next();

    } catch (error) {
        return res.status(401).json({ detail: "Session invalide ou expirée." });
    }
}

/**
 * POST /auth/register
 * Équivalent à register_user. Crée un nouvel étudiant.
 */
router.post('/register', async (req, res) => {
    try {
        const { first_name, last_name, email, password, department, class_group } = req.body;

        // 1. On vérifie si l'email existe déjà
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ detail: "Cet email est déjà utilisé !" });
        }

        // 2. On hache le mot de passe
        const hashedPassword = await security.getPasswordHash(password);

        // 3. On crée l'utilisateur dans Neon via Prisma
        const newUser = await prisma.user.create({
            data: {
                first_name,
                last_name,
                email,
                password_hash: hashedPassword,
                department,
                class_group
            }
        });

        // 4. On renvoie l'utilisateur sans le mot de passe
        const userToReturn = {
            id: newUser.id,
            first_name: newUser.first_name,
            last_name: newUser.last_name,
            email: newUser.email,
            department: newUser.department,
            class_group: newUser.class_group
        };

        res.status(201).json(userToReturn);
        
    } catch (error) {
        console.error("Erreur Register:", error);
        res.status(500).json({ detail: "Erreur serveur lors de l'inscription." });
    }
});

/**
 * POST /auth/login
 * Équivalent à login. Connecte l'étudiant et renvoie le token.
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Chercher l'utilisateur par email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(403).json({ detail: "Identifiants invalides" });
        }

        // 2. Vérifier le mot de passe
        const isPasswordValid = await security.verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(403).json({ detail: "Identifiants invalides" });
        }

        // 3. Générer le Token JWT
        const accessToken = security.createAccessToken({ sub: user.id });

        res.json({
            access_token: accessToken,
            token_type: "bearer",
            user: {
                first_name: user.first_name,
                last_name: user.last_name,
                id: user.id
            }
        });

    } catch (error) {
        console.error("Erreur Login:", error);
        res.status(500).json({ detail: "Erreur serveur lors de la connexion." });
    }
});

module.exports = {
    router,
    getCurrentUser
};
