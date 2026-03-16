const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentUser } = require('./auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /community
 * Retourne les données de la page Communauté :
 * - stats globales (étudiants actifs, matchs cette semaine, sports disponibles)
 * - top athlètes du mois (classement par total de matchs)
 * - activité récente (dernières demandes et matchs de tous les utilisateurs)
 */
router.get('/', getCurrentUser, async (req, res) => {
    try {
        // ── 1. Stats globales ──
        const totalUsers = await prisma.user.count();
        
        // Matchs cette semaine (7 derniers jours)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const matchesThisWeek = await prisma.match.count({
            where: { start_time: { gte: oneWeekAgo } },
        });

        const totalSports = await prisma.sport.count();

        // ── 2. Top Athlètes du Mois ──
        // On récupère tous les UserSport, groupés par user, triés par total de matchs
        const topUsersRaw = await prisma.user.findMany({
            include: {
                userSports: {
                    include: { sport: true },
                    orderBy: { match_count: 'desc' },
                },
            },
        });

        // Calculer le total de matchs par user et trier
        const topAthletes = topUsersRaw
            .map(user => {
                const totalMatches = user.userSports.reduce((sum, us) => sum + us.match_count, 0);
                // Sport principal = celui avec le plus de matchs
                const mainSport = user.userSports[0] || null;
                return {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    classGroup: user.class_group,
                    department: user.department,
                    totalMatches,
                    mainSport: mainSport ? mainSport.sport.name : null,
                    level: mainSport ? mainSport.level : null,
                };
            })
            .filter(u => u.totalMatches > 0)
            .sort((a, b) => b.totalMatches - a.totalMatches)
            .slice(0, 10);

        // ── 3. Activité Récente ──
        // Dernières demandes de match (toutes les demandes récentes)
        const recentRequests = await prisma.matchRequest.findMany({
            include: {
                user: { select: { first_name: true, last_name: true } },
                sport: { select: { name: true } },
            },
            orderBy: { created_at: 'desc' },
            take: 10,
        });

        // Derniers matchs créés
        const recentMatches = await prisma.match.findMany({
            include: {
                request_a: {
                    include: {
                        user: { select: { first_name: true, last_name: true } },
                        sport: { select: { name: true } },
                    },
                },
                request_b: {
                    include: {
                        user: { select: { first_name: true, last_name: true } },
                    },
                },
            },
            orderBy: { start_time: 'desc' },
            take: 10,
        });

        // Fusionner et trier les activités par date
        const activities = [];

        recentRequests.forEach(r => {
            activities.push({
                type: 'request',
                userName: `${r.user.first_name} ${r.user.last_name}`,
                sport: r.sport.name,
                message: `recherche un partenaire pour ${r.sport.name}`,
                date: r.created_at,
            });
        });

        recentMatches.forEach(m => {
            const userA = m.request_a.user;
            const userB = m.request_b.user;
            activities.push({
                type: 'match',
                userName: `${userA.first_name} ${userA.last_name}`,
                sport: m.request_a.sport.name,
                message: `a un match de ${m.request_a.sport.name} avec ${userB.first_name} ${userB.last_name}`,
                date: m.start_time,
            });
        });

        // Trier par date décroissante et garder les 15 plus récentes
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentActivity = activities.slice(0, 15);

        // ── RESPONSE ──
        res.json({
            stats: {
                totalUsers,
                matchesThisWeek,
                totalSports,
            },
            topAthletes,
            recentActivity,
        });

    } catch (error) {
        console.error("Erreur Community:", error);
        res.status(500).json({ detail: "Impossible de charger la communauté." });
    }
});

module.exports = router;
