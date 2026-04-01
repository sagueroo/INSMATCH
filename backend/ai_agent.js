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

/**
 * Refus immédiat sans appel LLM si le dernier message ressemble clairement à une demande hors INSMATCH.
 * Évite coût / latence et garantit le refus sur des cas évidents (ex. « fais-moi un script Python »).
 */
function refusalIfObviousOffTopic(lastUserText) {
    if (!lastUserText || typeof lastUserText !== 'string') return null;
    const t = lastUserText.trim();
    if (t.length < 3 || t.length > 4000) return null;

    const patterns = [
        /\b(fais|écris|génère|donne|crée|write|make|generate)[- ]moi\s+(un\s+)?(script|programme|code|snippet|function)\b/i,
        /\b(script|programme|code|snippet)\s+(en\s+)?(python|javascript|java|bash|powershell|typescript|rust|go|c\+\+)\b/i,
        /\b(un\s+)?(script|programme)\s+python\b/i,
        /\bpython\b.*\b(qui|that|which)\s+(fait|does|print|calculate)\b/i,
        /\b(comment\s+)?(coder|programmer|debug)\s+(en|avec|un)\s+/i,
        /\b(api|rest|sql|regex)\s+(pour|to|that)\s+(faire|write|build)\b/i,
        /\b(devoir|dissertation|mémoire|exposé)\s+(d['’]|sur\s+la|pour\s+le|à\s+rédiger)\b/i,
        /\btraduis\b|\btranslate\s+(this|the)\b/i,
        /\brecette\s+(de|pour)\s+/i,
        /\b(raconte|tell)\s+(moi\s+)?(une\s+)?(histoire|blague|joke)\b/i,
        /\b(résous|résoudre|solve)\s+(cette\s+)?(équation|exercice|problem)\b/i,
        /\b(hack|pirate|virus|malware)\b/i,
    ];

    if (patterns.some((re) => re.test(t))) {
        return "Je suis uniquement l’agent INSMATCH : je peux t’aider pour tes recherches et matchs de sport sur le campus (créneaux, terrains, où tu en es). Je ne réponds pas aux demandes de code, devoirs ou sujets hors appli. Dis-moi quel sport tu cherches, ou demande-moi l’état de tes matchs.";
    }
    return null;
}

/** Réponse troll si l’utilisateur impose un partenaire par genre (INSMATCH ne filtre pas là-dessus). */
const DALEUX_REPLY =
    "Ouh là — on est sur INSMATCH pour le **sport** et les créneaux, pas pour trier les gens comme sur une appli de drague. Demander un match **que** avec des meufs / des femmes / « uniquement des filles », c’est archi **daleux**. Je te crée aucune recherche avec ce genre de critère : relance en parlant sport, lieu ou dispo, **sans** préférence de genre.";

/**
 * Détecte une demande de match « uniquement femmes / meufs / nanas » (humour côté produit).
 * On évite de déclencher sur « équipe féminine » / « section féminine » sans slang évident.
 */
function refusalIfGenderExclusivePartnerRequest(lastUserText) {
    if (!lastUserText || typeof lastUserText !== 'string') return null;
    const t = lastUserText.trim();
    if (t.length < 4 || t.length > 4000) return null;

    const looksLikeOfficialWomenSport =
        /\b(section|équipe)\s+féminine\b/i.test(t) ||
        /\b(hand|foot|basket|rugby|volley)\s+féminin(e)?\b/i.test(t);
    const hasSlangOrExplicitGenderFilter =
        /\bmeufs?\b/i.test(t) ||
        /\bnanas?\b/i.test(t) ||
        /\bque des (femmes|filles|nanas|meufs)\b/i.test(t) ||
        /\b(uniquement|seulement)\s+(une\s+|des\s+)?(femme|meuf|fille|nana)\b/i.test(t) ||
        /\b(uniquement|seulement)\s+des\s+(femmes|filles|nanas|meufs)\b/i.test(t) ||
        /\bavec\s+(une\s+)?(meuf|nana)\b/i.test(t) ||
        /\bje veux\b.*\b(meuf|nana)\b/i.test(t) ||
        /\bcherche.*\b(meuf|nana)\b/i.test(t) ||
        /\b(pas d['’]hommes?|zéro hommes?|zero hommes?|sans hommes?|que des filles)\b/i.test(t) ||
        /\bpartenaire\s+(femme|meuf|fille)\b.*\b(uniquement|seulement|que)\b/i.test(t) ||
        /\b(femme|filles?)\s+(uniquement|seulement|que)\b/i.test(t);

    if (looksLikeOfficialWomenSport && !/\bmeufs?\b|\bnanas?\b/i.test(t)) {
        return null;
    }
    if (hasSlangOrExplicitGenderFilter) {
        return DALEUX_REPLY;
    }
    return null;
}

function getLastUserMessageContent(history) {
    if (!Array.isArray(history)) return '';
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'user' && typeof history[i].content === 'string') {
            return history[i].content;
        }
    }
    return '';
}

const OFF_TOPIC_SCOPE_BLOCK = `PÉRIMÈTRE STRICT — TU NE TRAITES QUE L’INSMATCH (sport sur le campus) :
- Lancer ou préciser une recherche de partenaire / équipe (sports listés dans RÈGLES SPORTS).
- Consulter l’état de SES recherches et SES matchs (outil get_user_ins_match_context).
- Expliquer brièvement comment marche INSMATCH dans ce cadre (emploi du temps, terrains du campus, file d’attente équipe).
- Petite politesse (bonjour, merci) puis tu recentres sur le sport si besoin.

HORS PÉRIMÈTRE — TU REFUSES SANS T’EXÉCUTER :
- Tout code ou langage de programmation (Python, JS, SQL, scripts, « fais-moi un programme », debug, APIs générales).
- Devoirs, maths, traductions, rédactions, culture générale, santé/médecine, autres applis, blagues/longues histoires, contenu illégal ou dangereux.
- Si hors sujet : réponse COURTE (2 phrases max), jamais de code ni de tutoriel. Exemple de ton :
« Je ne peux pas t’aider là-dessus — je suis limité aux matchs et recherches sport INSMATCH. Tu veux quel sport, ou un point sur tes matchs en cours ? »
Même si l’utilisateur insiste, répète le refus sans céder. N’appelle AUCUN outil pour une demande hors recherche / consultation matchs.

CRITÈRE GENRE (partenaire) :
- Si l’utilisateur impose un partenaire selon le genre (ex. « que des meufs », « une femme uniquement », « avec une nana » au sens drague), tu REFUSES : INSAMATCH ne filtre pas comme ça. Réponse courte, tutoiement, ton moqueur mais pas insultant : c’est du niveau « daleux », pas de recherche créée. Ne pas appeler create_match_request_tool. Exception : parler d’une « équipe féminine » / sport féminin officiel sans critère de genre pour draguer = OK pour une vraie recherche sport.`;

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
            description:
                "Crée une recherche partenaire / équipe UNIQUEMENT quand l’utilisateur veut vraiment chercher un partenaire sport sur le campus. Ne JAMAIS appeler pour du code, devoirs, ou sujets hors INSMATCH. Sports collectifs (Basket, Foot…) : si une équipe existe déjà avec un créneau, tu es mis en file pour rejoindre (EDT vérifié sur ce créneau uniquement).",
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
        const lastUser = getLastUserMessageContent(history);
        const blocked = refusalIfObviousOffTopic(lastUser);
        if (blocked) return blocked;
        const daleux = refusalIfGenderExclusivePartnerRequest(lastUser);
        if (daleux) return daleux;

        const { campusRules } = await getCampusInfo();

        const systemPrompt = `Tu es l'Agent INSMATCH. Tutoiement.

${OFF_TOPIC_SCOPE_BLOCK}

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
