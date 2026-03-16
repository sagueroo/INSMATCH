const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentUser } = require('./auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /profile
 * Retourne toutes les données du profil de l'utilisateur connecté :
 * - infos perso (nom, email, phone, département, classe, date inscription)
 * - stats globales (matchs joués, sports pratiqués, partenaires uniques)
 * - mes sports (avec level et match_count)
 * - récompenses (catalogue complet, avec unlocked/locked pour ce user)
 * - matchs récents (les 10 derniers matchs validés)
 */
router.get('/', getCurrentUser, async (req, res) => {
    try {
        const userId = req.user.id;

        // ── 1. Infos de base ──
        const user = req.user;

        // ── 2. Mes Sports ──
        const userSports = await prisma.userSport.findMany({
            where: { user_id: userId },
            include: { sport: true },
            orderBy: { match_count: 'desc' },
        });

        // ── 3. Stats globales ──
        const totalMatches = userSports.reduce((sum, us) => sum + us.match_count, 0);
        const totalSports = userSports.length;

        // Partenaires uniques : compter les users distincts dans les matches
        // (matchs où ce user est request_a ou request_b)
        const matchesAsA = await prisma.match.findMany({
            where: { request_a: { user_id: userId } },
            include: { request_b: { select: { user_id: true } } },
        });
        const matchesAsB = await prisma.match.findMany({
            where: { request_b: { user_id: userId } },
            include: { request_a: { select: { user_id: true } } },
        });

        const partnerIds = new Set();
        matchesAsA.forEach(m => partnerIds.add(m.request_b.user_id));
        matchesAsB.forEach(m => partnerIds.add(m.request_a.user_id));
        const totalPartners = partnerIds.size;

        // ── 4. Récompenses ──
        const allRewards = await prisma.reward.findMany();
        const userRewards = await prisma.userReward.findMany({
            where: { user_id: userId },
        });
        const unlockedRewardIds = new Set(userRewards.map(ur => ur.reward_id));

        // Auto-check & unlock rewards
        for (const reward of allRewards) {
            if (unlockedRewardIds.has(reward.id)) continue;

            const [type, threshold] = reward.condition.split(':');
            const thresholdNum = parseInt(threshold);
            let shouldUnlock = false;

            if (type === 'matches_total') shouldUnlock = totalMatches >= thresholdNum;
            if (type === 'partners') shouldUnlock = totalPartners >= thresholdNum;

            if (shouldUnlock) {
                await prisma.userReward.create({
                    data: { user_id: userId, reward_id: reward.id },
                });
                unlockedRewardIds.add(reward.id);
            }
        }

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
                    { request_a: { user_id: userId } },
                    { request_b: { user_id: userId } },
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
            const isA = m.request_a.user_id === userId;
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
        console.error("Erreur Profile:", error);
        res.status(500).json({ detail: "Impossible de charger le profil." });
    }
});

/**
 * PUT /profile
 * Met à jour le profil (phone pour l'instant)
 */
router.put('/', getCurrentUser, async (req, res) => {
    try {
        const { phone } = req.body;
        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: { phone },
            select: { id: true, phone: true },
        });
        res.json(updated);
    } catch (error) {
        console.error("Erreur Update Profile:", error);
        res.status(500).json({ detail: "Impossible de mettre à jour le profil." });
    }
});

module.exports = router;
