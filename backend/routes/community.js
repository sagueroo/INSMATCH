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

        const nowEv = new Date();
        const groupEventsRaw = await prisma.groupEvent.findMany({
            where: { status: 'recruiting', start_time: { gte: nowEv } },
            include: {
                sport: true,
                venue: true,
                members: {
                    include: { user: { select: { first_name: true, last_name: true } } },
                    take: 4,
                    orderBy: { joined_at: 'asc' },
                },
                _count: { select: { members: true } },
            },
            orderBy: { start_time: 'asc' },
            take: 20,
        });

        const publicEvents = groupEventsRaw.map((ev) => ({
            id: ev.id,
            sportName: ev.sport.name,
            matchMode: ev.sport.match_mode,
            maxPlayers: ev.sport.max_players,
            venueName: ev.venue?.name ?? 'À convenir',
            startTime: ev.start_time.toISOString(),
            participantCount: ev._count.members,
            membersPreview: ev.members.map((m) => `${m.user.first_name} ${m.user.last_name}`),
        }));

        // ── RESPONSE ──
        res.json({
            stats: {
                totalUsers,
                matchesThisWeek,
                totalSports,
            },
            topAthletes,
            recentActivity,
            publicEvents,
        });

    } catch (error) {
        console.error("Erreur Community:", error);
        res.status(500).json({ detail: "Impossible de charger la communauté." });
    }
});

/**
 * GET /community/search
 * Recherche des étudiants par nom, prénom, classe, département ou sport
 */
router.get('/search', getCurrentUser, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length === 0) {
            return res.json([]);
        }

        const searchQuery = q.trim();
        
        // On cherche dans User (first_name, last_name, class_group, department)
        // et on inclut leurs sports pour filtrer potentiellement par sport
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { first_name: { contains: searchQuery, mode: 'insensitive' } },
                    { last_name: { contains: searchQuery, mode: 'insensitive' } },
                    { class_group: { contains: searchQuery, mode: 'insensitive' } },
                    { department: { contains: searchQuery, mode: 'insensitive' } },
                    { userSports: { some: { sport: { name: { contains: searchQuery, mode: 'insensitive' } } } } }
                ],
            },
            include: {
                userSports: {
                    include: { sport: true },
                    orderBy: { match_count: 'desc' }
                }
            },
            take: 20
        });

        // Format de réponse
        const results = users.map(u => {
            const mainSport = u.userSports[0] || null;
            const totalMatches = u.userSports.reduce((sum, us) => sum + us.match_count, 0);
            
            return {
                id: u.id,
                firstName: u.first_name,
                lastName: u.last_name,
                classGroup: u.class_group,
                department: u.department,
                mainSport: mainSport ? mainSport.sport.name : null,
                level: mainSport ? mainSport.level : 'Débutant',
                totalMatches
            };
        });

        res.json(results);
    } catch (error) {
        console.error("Erreur Search Community:", error);
        res.status(500).json({ detail: "Erreur lors de la recherche." });
    }
});

/**
 * GET /community/users/:id/profile
 * Récupère le profil détaillé d'un utilisateur spécifique
 */
router.get('/users/:id/profile', getCurrentUser, async (req, res) => {
    try {
        const targetUserId = req.params.id;

        const user = await prisma.user.findUnique({
            where: { id: targetUserId }
        });

        if (!user) {
            return res.status(404).json({ detail: "Utilisateur non trouvé." });
        }

        // ── 2. Ses Sports ──
        const userSports = await prisma.userSport.findMany({
            where: { user_id: targetUserId },
            include: { sport: true },
            orderBy: { match_count: 'desc' },
        });

        // ── 3. Stats globales ──
        const totalMatches = userSports.reduce((sum, us) => sum + us.match_count, 0);
        const totalSports = userSports.length;

        // Partenaires uniques
        const matchesAsA = await prisma.match.findMany({
            where: { request_a: { user_id: targetUserId } },
            include: { request_b: { select: { user_id: true } } },
        });
        const matchesAsB = await prisma.match.findMany({
            where: { request_b: { user_id: targetUserId } },
            include: { request_a: { select: { user_id: true } } },
        });

        const partnerIds = new Set();
        matchesAsA.forEach(m => partnerIds.add(m.request_b.user_id));
        matchesAsB.forEach(m => partnerIds.add(m.request_a.user_id));
        const totalPartners = partnerIds.size;

        // ── 4. Récompenses ──
        const allRewards = await prisma.reward.findMany();
        const userRewards = await prisma.userReward.findMany({
            where: { user_id: targetUserId },
        });
        const unlockedRewardIds = new Set(userRewards.map(ur => ur.reward_id));

        const rewards = allRewards.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            unlocked: unlockedRewardIds.has(r.id),
        }));

        // ── 5. Matchs récents ──
        const recentMatchesRaw = await prisma.match.findMany({
            where: {
                OR: [
                    { request_a: { user_id: targetUserId } },
                    { request_b: { user_id: targetUserId } },
                ],
            },
            include: {
                request_a: { include: { user: { select: { first_name: true, last_name: true } }, sport: true } },
                request_b: { include: { user: { select: { first_name: true, last_name: true } }, sport: true } },
                venue: true,
            },
            orderBy: { start_time: 'desc' },
            take: 10,
        });

        const recentMatches = recentMatchesRaw.map(m => {
            const isA = m.request_a.user_id === targetUserId;
            const partner = isA ? m.request_b.user : m.request_a.user;
            const sport = m.request_a.sport;

            return {
                id: m.id,
                sport: sport.name,
                partnerName: `${partner.first_name} ${partner.last_name}`,
                date: m.start_time,
                venue: m.venue.name,
                status: m.status,
            };
        });

        // ── RESPONSE ──
        res.json({
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                department: user.department,
                class_group: user.class_group,
                created_at: user.created_at,
            },
            stats: {
                totalMatches,
                totalSports,
                totalPartners,
            },
            sports: userSports.map(us => ({
                id: us.id,
                name: us.sport.name,
                level: us.level,
                matchCount: us.match_count,
            })),
            rewards,
            recentMatches,
        });

    } catch (error) {
        console.error("Erreur Target User Profile:", error);
        res.status(500).json({ detail: "Impossible de charger le profil de l'utilisateur." });
    }
});

module.exports = router;
