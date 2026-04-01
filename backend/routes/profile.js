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

        // ── Obtenir tous les sports disponibles ──
        const availableSports = await prisma.sport.findMany({ select: { id: true, name: true } });

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
                status: 'scheduled',
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

        const recentMatches = recentMatchesRaw.map((m) => {
            const isA = m.request_a.user_id === userId;
            const partner = isA ? m.request_b.user : m.request_a.user;
            const sport = m.request_a.sport ?? m.request_b.sport;
            const p = partner;
            const partnerName = p
                ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '?'
                : '?';

            return {
                id: m.id,
                sport: sport?.name ?? '?',
                partnerName,
                date: m.start_time,
                venue: m.venue?.name ?? null,
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
                user_role: user.user_role || 'student',
                professor_trigram: user.professor_trigram || null,
                created_at: user.created_at,
            },
            stats: {
                totalMatches,
                totalSports,
                totalPartners,
            },
            sports: userSports.map(us => ({
                id: us.sport_id,
                name: us.sport.name,
                level: us.level,
                matchCount: us.match_count,
            })),
            rewards,
            recentMatches,
            availableSports,
        });

    } catch (error) {
        console.error("Erreur Profile:", error);
        res.status(500).json({ detail: "Impossible de charger le profil." });
    }
});

/**
 * PUT /profile
 * Met à jour le profil (informations et sports favoris)
 */
router.put('/', getCurrentUser, async (req, res) => {
    try {
        const { first_name, last_name, email, phone, class_group, department, sports, professor_trigram } = req.body;
        const userId = req.user.id;

        // Validation basique
        if (!first_name || !last_name || !email) {
            return res.status(400).json({ detail: "Nom, prénom et email sont requis." });
        }

        const data = {
            first_name,
            last_name,
            email,
            phone,
        };

        if (req.user.user_role === 'professor') {
            if (professor_trigram != null && String(professor_trigram).trim()) {
                const tri = String(professor_trigram).trim().toUpperCase();
                if (!/^[A-Z]{2,6}$/.test(tri)) {
                    return res.status(400).json({ detail: 'Trigramme invalide (2 à 6 lettres).' });
                }
                data.professor_trigram = tri;
            }
        } else {
            data.class_group = class_group;
            data.department = department;
        }

        // Mettre à jour l'utilisateur de base
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data,
        });

        // Mettre à jour les sports si fournis
        if (Array.isArray(sports)) {
            // Transaction pour gérer les sports
            await prisma.$transaction(async (tx) => {
                // 1. Récupérer les sports existants
                const existingUserSports = await tx.userSport.findMany({
                    where: { user_id: userId }
                });

                const incomingSportIds = sports.map(s => s.sport_id);
                
                // 2. Supprimer les sports qui ne sont plus dans la liste
                const sportsToDelete = existingUserSports.filter(
                    eus => !incomingSportIds.includes(eus.sport_id)
                );
                
                if (sportsToDelete.length > 0) {
                    await tx.userSport.deleteMany({
                        where: {
                            id: { in: sportsToDelete.map(s => s.id) }
                        }
                    });
                }

                // 3. Ajouter ou mettre à jour les sports
                for (const sport of sports) {
                    const existing = existingUserSports.find(eus => eus.sport_id === sport.sport_id);
                    if (existing) {
                        // Mettre à jour si le niveau a changé
                        if (existing.level !== sport.level) {
                            await tx.userSport.update({
                                where: { id: existing.id },
                                data: { level: sport.level }
                            });
                        }
                    } else {
                        // Créer un nouveau sport
                        await tx.userSport.create({
                            data: {
                                user_id: userId,
                                sport_id: sport.sport_id,
                                level: sport.level,
                                match_count: 0 // Commence à 0
                            }
                        });
                    }
                }
            });
        }

        res.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error("Erreur Update Profile:", error);
        res.status(500).json({ detail: "Impossible de mettre à jour le profil." });
    }
});

module.exports = router;
