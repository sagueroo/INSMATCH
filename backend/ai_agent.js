const Groq = require("groq-sdk");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ==========================================
// 1. Outils pour la Base de données (Database Functions)
// ==========================================

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

    // On crée un tableau clair pour l'IA : { Sport: [Terrain1, Terrain2] }
    const sportsVenuesMapping = sports.map(sport => {
        const allowedVenues = sport.venues.map(v => v.venue.name);
        return `${sport.name} (Terrains: ${allowedVenues.length > 0 ? allowedVenues.join(', ') : 'Aucun'})`;
    });

    return {
        campusRules: sportsVenuesMapping
    };
}

async function createMatchRequestTool(sport_name, venue_name, time_slot_notes, currentUser) {
    try {
        console.log(`\n⚙️ [JS] Vérification : ${sport_name} au ${venue_name} pour ${time_slot_notes}...`);

        // 1. Chercher le sport
        const sport = await prisma.sport.findFirst({
            where: { name: { contains: sport_name, mode: "insensitive" } }
        });
        if (!sport) return JSON.stringify({ success: false, message: `Le sport '${sport_name}' n'existe pas.` });

        // 2. Chercher le terrain
        const venue = await prisma.venue.findFirst({
            where: { name: { contains: venue_name, mode: "insensitive" } }
        });
        if (!venue) return JSON.stringify({ success: false, message: `Le terrain '${venue_name}' n'existe pas.` });

        // 3. Vérifier la liaison
        const liaison = await prisma.venueSport.findFirst({
            where: { venue_id: venue.id, sport_id: sport.id }
        });

        if (!liaison) {
            return JSON.stringify({
                success: false,
                message: `INTERDIT : On ne peut pas faire de ${sport.name} au ${venue.name}. Demande de choisir un autre terrain compatible selon mes règles.`
            });
        }

        // 4. Enregistrer (On utilise proposed_time si ce n'est pas automatique, on le garde textuel pour l'instant dans availability_notes)
        await prisma.matchRequest.create({
            data: {
                user_id: currentUser.id,
                sport_id: sport.id,
                availability_notes: `Lieu: ${venue.name} | Dispo: ${time_slot_notes}`
            }
        });

        return JSON.stringify({ success: true, message: `Parfait, demande de ${sport.name} enregistrée !` });
        
    } catch (error) {
        console.error("Erreur createMatchRequestTool:", error);
        return JSON.stringify({ success: false, message: error.message });
    }
}

async function findPendingPlayersTool(sport_name, currentUser) {
    try {
        console.log(`\n📡 [JS] Radar activé : Recherche de ${sport_name}...`);

        const sport = await prisma.sport.findFirst({
            where: { name: { contains: sport_name, mode: "insensitive" } }
        });
        if (!sport) return JSON.stringify({ success: false, message: `Le sport '${sport_name}' n'existe pas.` });

        const pendingRequests = await prisma.matchRequest.findMany({
            where: {
                sport_id: sport.id,
                status: "pending",
                user_id: { not: currentUser.id }
            },
            include: { user: true }
        });

        if (pendingRequests.length === 0) {
            return JSON.stringify({ 
                success: true, players_found: 0, 
                message: `Aucun joueur en attente pour le ${sport.name}.` 
            });
        }

        const playersList = pendingRequests.map(req => ({
            request_id: req.id,
            first_name: req.user.first_name,
            availability_notes: req.availability_notes
        }));

        return JSON.stringify({
            success: true,
            players_found: playersList.length,
            players_list: playersList,
            message: `J'ai trouvé ${playersList.length} joueur(s). Propose à l'étudiant de jouer avec l'un d'eux.`
        });

    } catch (error) {
        console.error("Erreur findPendingPlayersTool:", error);
        return JSON.stringify({ success: false, message: error.message });
    }
}

async function confirmMatchTool(sport_name, other_player_name, currentUser) {
    try {
        console.log(`\n🤝 [JS] Validation de match avec ${other_player_name}...`);

        const sport = await prisma.sport.findFirst({
            where: { name: { contains: sport_name, mode: "insensitive" } }
        });
        if (!sport) return JSON.stringify({ success: false, message: "Sport introuvable." });

        const otherRequest = await prisma.matchRequest.findFirst({
            where: {
                sport_id: sport.id,
                status: "pending",
                user_id: { not: currentUser.id },
                user: {
                    first_name: { contains: other_player_name, mode: "insensitive" }
                }
            },
            include: { user: true }
        });

        if (!otherRequest) {
            return JSON.stringify({ 
                success: false, 
                message: `Désolé, aucune demande trouvée pour ${other_player_name}.` 
            });
        }

        // On passe les deux en 'matched' (Trouvé, en attente d'acceptation)
        await prisma.matchRequest.update({
            where: { id: otherRequest.id },
            data: { status: "matched" }
        });

        await prisma.matchRequest.create({
            data: {
                user_id: currentUser.id,
                sport_id: sport.id,
                status: "matched",
                availability_notes: `Match confirmé avec ${otherRequest.user.first_name}`
            }
        });

        return JSON.stringify({
            success: true,
            message: `Match validé ! L'email de ${otherRequest.user.first_name} est: ${otherRequest.user.email}.`
        });

    } catch (error) {
        console.error("Erreur confirmMatchTool:", error);
        return JSON.stringify({ success: false, message: error.message });
    }
}

// ==========================================
// 2. Modèle des Outils (Tool Descriptions)
// ==========================================
const toolsList = [
    {
        type: "function",
        function: {
            name: "create_match_request_tool",
            description: "Enregistre l'envie de l'étudiant pour un sport et un terrain.",
            parameters: {
                type: "object",
                properties: {
                    sport_name: { type: "string", description: "Le sport souhaité" },
                    venue_name: { type: "string", description: "Le terrain. S'il n'est pas précisé dans la conversation, n'invente rien et demande à l'utilisateur de choisir parmi la liste compatible." },
                    time_slot_notes: { type: "string", description: "L'horaire souhaité. Si l'utilisateur n'a pas précisé d'horaire, écris EXACTEMENT 'Horaire automatique (Emploi du temps)'." }
                },
                required: ["sport_name", "venue_name", "time_slot_notes"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "find_pending_players_tool",
            description: "Cherche d'autres étudiants en attente. TOUJOURS UTILISER AVANT de créer une demande.",
            parameters: {
                type: "object",
                properties: {
                    sport_name: { type: "string" }
                },
                required: ["sport_name"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "confirm_match_tool",
            description: "Valide un match avec un joueur listé. À utiliser quand l'étudiant confirme le nom du joueur.",
            parameters: {
                type: "object",
                properties: {
                    sport_name: { type: "string" },
                    other_player_name: { type: "string" }
                },
                required: ["sport_name", "other_player_name"]
            }
        }
    }
];

// ==========================================
// 3. Le Cerveau IA (Process Conversation)
// ==========================================
async function chatWithAgent(history, currentUser) {
    try {
        const { campusRules } = await getCampusInfo();

        const systemPrompt = `Tu es l'Agent INSMATCH. Tu tutoies l'étudiant.
        
VOICI LES RÈGLES DU CAMPUS (Très important) :
${campusRules.join('\n')}

DIRECTIVES GLOBALES :
1. Si l'étudiant demande à jouer à un sport SANS préciser le lieu, ne lance SURTOUT PAS d'outil. Tu dois lui lister EXCLUSIVEMENT les lieux compatibles avec ce sport (en lisant les règles ci-dessus) et lui demander de choisir.
2. Si l'étudiant demande à jouer SANS préciser d'horaire, préviens-le avec cette phrase : "Comme tu n'as pas précisé d'horaire, je vais utiliser le premier créneau libre dans ton emploi du temps." Ensuite appelle l'outil de création en mettant "Horaire automatique (Emploi du temps)" dans le time_slot_notes.
3. Si l'étudiant a précisé une heure, retiens-la et utilise-la dans le tool.
4. Ne crée JAMAIS de demande sur un terrain non listé pour le sport demandé.
5. Sois cool et naturel dans tes réponses.`;

        const messages = [{ role: "system", content: systemPrompt }, ...history];

        // --- Appel Initial ---
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            tools: toolsList,
            tool_choice: "auto"
        });

        const assistantMessage = response.choices[0].message;

        // -- Tool Call Detection --
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            messages.push(assistantMessage); // Ajouter l'intention d'appeler l'outil au contexte

            for (const toolCall of assistantMessage.tool_calls) {
                const args = JSON.parse(toolCall.function.arguments);
                let toolResult = "";

                if (toolCall.function.name === "create_match_request_tool") {
                    toolResult = await createMatchRequestTool(args.sport_name, args.venue_name, args.time_slot_notes, currentUser);
                } else if (toolCall.function.name === "find_pending_players_tool") {
                    toolResult = await findPendingPlayersTool(args.sport_name, currentUser);
                } else if (toolCall.function.name === "confirm_match_tool") {
                    toolResult = await confirmMatchTool(args.sport_name, args.other_player_name, currentUser);
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

            // --- Deuxième Appel ---
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
