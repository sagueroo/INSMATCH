const Groq = require("groq-sdk");
const { PrismaClient } = require("@prisma/client");
const { tryPairAfterCreate } = require("./utils/matchmaking");

const prisma = new PrismaClient();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/** Fuseau affiché dans l’app / campus — évite que le LLM lise du UTC (ex. 10h Z = 12h à Paris). */
const CAMPUS_TZ = 'Europe/Paris';

function formatParisTimeHm(d) {
    const parts = new Intl.DateTimeFormat('fr-FR', {
        timeZone: CAMPUS_TZ,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(d);
    const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${h}h${m}`;
}

function formatParisDateLong(d) {
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone: CAMPUS_TZ,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(d);
}

/** Texte unique à recopier pour l’utilisateur (pas d’ISO / UTC). */
function formatMatchCreneauForUser(start, end) {
    const ds = formatParisDateLong(start);
    const de = formatParisDateLong(end);
    const t0 = formatParisTimeHm(start);
    const t1 = formatParisTimeHm(end);
    if (ds === de) {
        return `${ds}, de ${t0} à ${t1} (heure locale Lyon/Paris, comme dans l’app)`;
    }
    return `du ${ds} ${t0} au ${de} ${t1} (heure locale Lyon/Paris)`;
}

async function getCampusInfo() {
    const sports = await prisma.sport.findMany({
        include: {
            venues: {
                include: {
                    venue: true
                }
            }
        }
    });

    const sportsVenuesMapping = sports.map(sport => {
        const allowedVenues = sport.venues.map(v => v.venue.name);
        const mode = sport.match_mode || 'duel';
        const hint = mode === 'collective'
            ? ' [équipe — plusieurs joueurs sur le même créneau]'
            : mode === 'open_group'
              ? ' [groupe ouvert]'
              : ' [1 contre 1]';
        return `${sport.name}${hint} — Terrains: ${allowedVenues.length > 0 ? allowedVenues.join(', ') : 'Aucun'}`;
    });

    return {
        campusRules: sportsVenuesMapping
    };
}

/** @param {unknown} tc */
function sanitizeTimeConstraints(tc) {
    if (!tc || typeof tc !== "object" || Array.isArray(tc)) return undefined;
    const o = /** @type {Record<string, unknown>} */ (tc);
    const h = o.weekend_not_before_hour;
    if (Number.isFinite(h) && h >= 0 && h <= 23) {
        return { weekend_not_before_hour: Math.floor(Number(h)) };
    }
    return undefined;
}

/**
 * « Tennis » seul → sport Tennis. Ping-pong uniquement si tennis de table / ping-pong / table tennis explicites.
 */
async function resolveSportForAgent(sport_name) {
    const raw = String(sport_name || '').trim();
    if (!raw) return null;

    const q = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const pingPongPhrases = [
        'tennis de table',
        'tennis-de-table',
        'ping-pong',
        'ping pong',
        'pingpong',
        'table tennis',
    ];
    for (const p of pingPongPhrases) {
        if (q.includes(p)) {
            return prisma.sport.findFirst({
                where: { name: { equals: 'Ping-pong', mode: 'insensitive' } },
            });
        }
    }
    if (q.includes('tennis') && q.includes('table')) {
        return prisma.sport.findFirst({
            where: { name: { equals: 'Ping-pong', mode: 'insensitive' } },
        });
    }

    if (/\btennis\b/.test(q) || q === 'tennis') {
        const tennis = await prisma.sport.findFirst({
            where: { name: { equals: 'Tennis', mode: 'insensitive' } },
        });
        if (tennis) return tennis;
    }

    return prisma.sport.findFirst({
        where: { name: { contains: raw, mode: 'insensitive' } },
    });
}

async function createMatchRequestTool(sport_name, venue_name, time_slot_notes, currentUser, time_constraints) {
    try {
        const rawVenue = typeof venue_name === 'string' ? venue_name.trim() : '';
        const noVenue = !rawVenue;

        console.log(`\n⚙️ [JS] Demande : ${sport_name} / ${noVenue ? '(lieu à convenir)' : rawVenue} / ${time_slot_notes}`);

        const sport = await resolveSportForAgent(sport_name);
        if (!sport) return JSON.stringify({ success: false, message: `Le sport '${sport_name}' n'existe pas.` });

        let venue = null;
        if (!noVenue) {
            venue = await prisma.venue.findFirst({
                where: { name: { contains: rawVenue, mode: "insensitive" } }
            });
            if (!venue) return JSON.stringify({ success: false, message: `Le terrain '${rawVenue}' n'existe pas.` });

            const liaison = await prisma.venueSport.findFirst({
                where: { venue_id: venue.id, sport_id: sport.id }
            });

            if (!liaison) {
                return JSON.stringify({
                    success: false,
                    message: `INTERDIT : On ne peut pas faire de ${sport.name} au ${venue.name}. Choisis un terrain compatible.`
                });
            }
        }

        const constraints = sanitizeTimeConstraints(time_constraints);

        const created = await prisma.matchRequest.create({
            data: {
                user_id: currentUser.id,
                sport_id: sport.id,
                venue_id: venue ? venue.id : null,
                availability_notes: venue
                    ? `Lieu: ${venue.name} | Dispo: ${time_slot_notes}`
                    : `Dispo: ${time_slot_notes}`,
                ...(constraints ? { time_constraints: constraints } : {}),
            }
        });

        const pair = await tryPairAfterCreate(created.id);
        const mode = sport.match_mode || 'duel';

        if (pair.awaitingJoinApproval) {
            return JSON.stringify({
                success: true,
                paired: false,
                message: mode === 'collective' || mode === 'open_group'
                    ? `Une équipe cherchait déjà des joueurs au même endroit (ou compatible) : ton EDT a été vérifié sur leur créneau uniquement. Un organisateur doit accepter ta demande dans « Mes matchs ».`
                    : `Demande enregistrée.`,
            });
        }

        if (pair.paired) {
            if (pair.collective) {
                return JSON.stringify({
                    success: true,
                    paired: true,
                    message: `Un autre joueur cherchait le même sport. Créneau commun trouvé — c’est une équipe : les prochains pourront demander à rejoindre ce groupe. Ouvre « Mes matchs ».`,
                });
            }
            const place = venue ? ` (${venue.name})` : '';
            return JSON.stringify({
                success: true,
                paired: true,
                message: `Un partenaire cherchait déjà le même sport${place}. Créneau calculé. Ouvre « Mes matchs ».`,
            });
        }

        if (pair.reason === "no_slot") {
            return JSON.stringify({
                success: true,
                paired: false,
                message: `Demande enregistrée. Quelqu’un cherchait aussi, mais aucun créneau d’au moins 1h commun n’a été trouvé.`,
            });
        }

        return JSON.stringify({
            success: true,
            paired: false,
            message: venue
                ? `Demande enregistrée pour ${sport.name} au ${venue.name}.`
                : `Demande enregistrée pour ${sport.name}. Tu seras notifié dans Mes Matchs.`,
        });

    } catch (error) {
        console.error("Erreur createMatchRequestTool:", error);
        return JSON.stringify({ success: false, message: error.message });
    }
}

/**
 * Lecture seule : demandes actives + matchs à venir (évite doublons et réponses inventées).
 */
async function getUserInsMatchContextTool(currentUser) {
    try {
        const userId = currentUser.id;
        const pendingReqs = await prisma.matchRequest.findMany({
            where: {
                user_id: userId,
                status: { in: ['pending', 'matched'] },
            },
            include: { sport: true, venue: true },
            orderBy: { created_at: 'desc' },
            take: 10,
        });

        const pending_search_requests = pendingReqs.map((r) => ({
            sport: r.sport?.name || '?',
            venue: r.venue?.name || null,
            status: r.status,
            notes: (r.availability_notes || '').slice(0, 200),
        }));

        const now = new Date();
        const matches = await prisma.match.findMany({
            where: {
                OR: [
                    { request_a: { user_id: userId } },
                    { request_b: { user_id: userId } },
                ],
                status: { in: ['scheduled', 'pending_acceptance'] },
                end_time: { gte: now },
            },
            include: {
                venue: true,
                request_a: {
                    include: {
                        user: { select: { first_name: true, last_name: true } },
                        sport: true,
                    },
                },
                request_b: {
                    include: {
                        user: { select: { first_name: true, last_name: true } },
                        sport: true,
                    },
                },
            },
            orderBy: { start_time: 'asc' },
            take: 15,
        });

        const upcoming_matches = matches.map((m) => {
            const isA = m.request_a.user_id === userId;
            const partner = isA ? m.request_b.user : m.request_a.user;
            const sportName = m.request_a.sport?.name || m.request_b.sport?.name || '?';
            const partnerLabel = partner
                ? `${partner.first_name} ${partner.last_name}`.trim()
                : '?';
            return {
                sport: sportName,
                creneau_pour_l_utilisateur: formatMatchCreneauForUser(m.start_time, m.end_time),
                venue: m.venue?.name || null,
                partner: partnerLabel,
                match_status: m.status,
            };
        });

        return JSON.stringify({
            fuseau_reference: CAMPUS_TZ,
            pending_search_requests,
            upcoming_matches,
        });
    } catch (error) {
        console.error('Erreur getUserInsMatchContextTool:', error);
        return JSON.stringify({ error: 'Impossible de lire le contexte matchmaking.' });
    }
}

const toolsList = [
    {
        type: "function",
        function: {
            name: "get_user_ins_match_context",
            description:
                "Lit les demandes de recherche actives (pending/matched) et les matchs INSAMATCH à venir. Chaque match inclut creneau_pour_l_utilisateur (heure locale Europe/Paris, identique à l’app) — à recopier tel quel pour les heures.",
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: "function",
        function: {
            name: "create_match_request_tool",
            description: "Crée une recherche partenaire / équipe. Sports collectifs (Basket, Foot…) : si une équipe existe déjà avec un créneau, tu es mis en file pour rejoindre (EDT vérifié sur ce créneau uniquement).",
            parameters: {
                type: "object",
                properties: {
                    sport_name: {
                        type: "string",
                        description:
                            "Sport exact côté appli. « Tennis » seul = tennis (court). Ping-pong / tennis de table uniquement si l’utilisateur dit tennis de table, ping-pong, ping pong ou table tennis (une seule entrée « Ping-pong » en base).",
                    },
                    venue_name: { type: "string", description: "Terrain (nom du campus) ou vide si lieu à convenir" },
                    time_slot_notes: { type: "string", description: "Sans horaire précis : 'Horaire automatique (Emploi du temps)'" },
                    time_constraints: {
                        type: "object",
                        description:
                            "Si l’étudiant impose un horaire : ex. pas avant 15h le week-end → weekend_not_before_hour: 15 (samedi et dimanche, heure locale).",
                        properties: {
                            weekend_not_before_hour: {
                                type: "integer",
                                description: "0–23. Créneau ne commence pas avant cette heure le samedi et le dimanche. Omettre si aucune contrainte.",
                            },
                        },
                    },
                },
                required: ["sport_name", "time_slot_notes"]
            }
        }
    },
];

async function chatWithAgent(history, currentUser) {
    try {
        const { campusRules } = await getCampusInfo();

        const systemPrompt = `Tu es l'Agent INSMATCH. Tutoiement.

RÈGLES SPORTS :
${campusRules.join('\n')}

OUTIL get_user_ins_match_context :
- Appelle-le quand l'utilisateur demande ses matchs, ses recherches en cours, ou « où j'en suis » ; aussi avant une NOUVELLE recherche si tu veux vérifier qu'il n'a pas déjà une demande identique en cours.
- Ne invente pas de données : si tu n'es pas sûr, appelle cet outil.
- HORAIRES : pour chaque entrée de upcoming_matches, utilise UNIQUEMENT le champ creneau_pour_l_utilisateur pour dire l'heure à l'utilisateur (déjà en heure Lyon/Paris). Ne jamais convertir ni réinterpréter une heure UTC/ISO : ce champ est la source de vérité.

CONFIRMATION avant create_match_request_tool :
- Si la demande est vague (« du sport », « n'importe quoi »), pose des questions SANS outil jusqu'à avoir au moins le sport (et idéalement lieu ou dispo).
- Pour une NOUVELLE recherche claire mais qui pourrait être ambiguë ou lourde (ex. plusieurs sports à la fois sans précision), résume en une phrase ce que tu vas créer et demande une confirmation (« oui », « vas-y », « confirme »). N'appelle create_match_request_tool qu'après cette confirmation dans la conversation.
- Exception : la phrase est déjà précise (sport explicite + au moins lieu OU créneau/disponibilité claire, ex. « cherche foot au terrain X demain aprem ») — tu peux appeler create_match_request_tool directement sans étape de confirmation supplémentaire.
- Après succès de l'outil, rappelle que l'emploi du temps INSAMATCH (onglet Emploi du temps) affiche aussi les matchs confirmés ou proposés.

IMPORTANT (inchangé) :
- Basket, Foot, sports d'équipe : plusieurs joueurs peuvent former une équipe sur un créneau commun. Un joueur qui arrive après peut être proposé pour rejoindre l'équipe existante (si son EDT a le créneau libre), pas seulement un 1 contre 1.
- Terrain : si l'étudiant ne précise pas le lieu, appelle l'outil avec venue_name vide.
- Sans horaire : mets "Horaire automatique (Emploi du temps)" dans time_slot_notes.
- Contraintes horaires : si l'étudiant dit par ex. « pas avant 15h le week-end », remplis time_constraints avec { "weekend_not_before_hour": 15 } en plus du texte dans time_slot_notes.
- Ne invente pas de nom de terrain.
- Tennis : « tennis » ou « tennis (court) » → sport_name \"Tennis\". Jamais Ping-pong sauf si l’utilisateur parle explicitement de tennis de table / ping-pong / table tennis → sport_name \"Ping-pong\".`;

        const messages = [{ role: "system", content: systemPrompt }, ...history];

        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            tools: toolsList,
            tool_choice: "auto"
        });

        const assistantMessage = response.choices[0].message;

        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            messages.push(assistantMessage);

            for (const toolCall of assistantMessage.tool_calls) {
                const args = JSON.parse(toolCall.function.arguments);
                let toolResult = "";

                if (toolCall.function.name === "create_match_request_tool") {
                    toolResult = await createMatchRequestTool(
                        args.sport_name,
                        args.venue_name ?? "",
                        args.time_slot_notes,
                        currentUser,
                        args.time_constraints
                    );
                } else if (toolCall.function.name === "get_user_ins_match_context") {
                    toolResult = await getUserInsMatchContextTool(currentUser);
                } else {
                    toolResult = JSON.stringify({ error: "Outil inconnu" });
                }

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolCall.function.name,
                    content: toolResult
                });
            }

            const finalResponse = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages
            });
            return finalResponse.choices[0].message.content;
        }

        return assistantMessage.content;

    } catch (error) {
        console.error("❌ Erreur de l'API IA :", error);
        return "Oups, je suis un peu surchargé, peux-tu répéter ta demande ?";
    }
}

module.exports = {
    chatWithAgent
};
