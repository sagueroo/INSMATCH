const Groq = require("groq-sdk");
const { PrismaClient } = require("@prisma/client");
const { tryPairAfterCreate } = require("./utils/matchmaking");

const prisma = new PrismaClient();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

async function createMatchRequestTool(sport_name, venue_name, time_slot_notes, currentUser, time_constraints) {
    try {
        const rawVenue = typeof venue_name === 'string' ? venue_name.trim() : '';
        const noVenue = !rawVenue;

        console.log(`\n⚙️ [JS] Demande : ${sport_name} / ${noVenue ? '(lieu à convenir)' : rawVenue} / ${time_slot_notes}`);

        const sport = await prisma.sport.findFirst({
            where: { name: { contains: sport_name, mode: "insensitive" } }
        });
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

const toolsList = [
    {
        type: "function",
        function: {
            name: "create_match_request_tool",
            description: "Crée une recherche partenaire / équipe. Sports collectifs (Basket, Foot…) : si une équipe existe déjà avec un créneau, tu es mis en file pour rejoindre (EDT vérifié sur ce créneau uniquement).",
            parameters: {
                type: "object",
                properties: {
                    sport_name: { type: "string", description: "Sport" },
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

IMPORTANT :
- Basket, Foot, sports d'équipe : plusieurs joueurs peuvent former une équipe sur un créneau commun. Un joueur qui arrive après peut être proposé pour rejoindre l'équipe existante (si son EDT a le créneau libre), pas seulement un 1 contre 1.
- Terrain : si l'étudiant ne précise pas le lieu, appelle l'outil avec venue_name vide.
- Sans horaire : mets "Horaire automatique (Emploi du temps)" dans time_slot_notes.
- Contraintes horaires : si l’étudiant dit par ex. « pas avant 15h le week-end », remplis time_constraints avec { "weekend_not_before_hour": 15 } en plus du texte dans time_slot_notes.
- Ne invente pas de nom de terrain.`;

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
