const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ⚠️ À METTRE DANS LE .ENV PLUS TARD
const SECRET_KEY = process.env.JWT_SECRET || "UNE_CLE_TRES_SECRETE_INSA_2026";
const ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24; // Le badge dure 24h

/**
 * Hache le mot de passe pour l'inscription.
 * @param {string} password - Le mot de passe en clair.
 * @returns {Promise<string>} - Le mot de passe haché.
 */
async function getPasswordHash(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

/**
 * Vérifie si le mot de passe en clair correspond au hash en base de données.
 * @param {string} plainPassword - Le mot de passe soumis.
 * @param {string} hashedPassword - Le hash stocké.
 * @returns {Promise<boolean>} - True si ça correspond, false sinon.
 */
async function verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Génère un badge JWT pour l'utilisateur.
 * @param {object} data - Les données à encoder (ex: { sub: userId }).
 * @returns {string} - Le token JWT.
 */
function createAccessToken(data) {
    const expiresIn = ACCESS_TOKEN_EXPIRE_MINUTES * 60; // en secondes pour jsonwebtoken
    return jwt.sign(data, SECRET_KEY, { expiresIn });
}

module.exports = {
    SECRET_KEY,
    getPasswordHash,
    verifyPassword,
    createAccessToken
};
