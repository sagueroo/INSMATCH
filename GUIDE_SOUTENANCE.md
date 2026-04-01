# INSAMATCH — Guide de soutenance (projet complet)

Document pour présenter le projet à l’oral : **idée**, **fonctionnalités**, **comment c’est fait techniquement**, sans jargon inutile.

---

## 1. En une phrase

**INSAMATCH** est une application web pour les étudiants (campus type INSA) : ils **cherchent un partenaire ou une équipe** pour faire du sport, l’**emploi du temps** (cours + matchs) est pris en compte pour proposer des **créneaux communs**, et une **IA** aide à créer des recherches dans le langage naturel.

---

## 2. Stack technique (ce que tu utilises)

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Frontend** | React 19 + Vite 8 | Interface utilisateur, une seule grande page `Dashboard` après connexion |
| **Style** | Tailwind CSS 4 | Mise en forme |
| **Carte** | Leaflet + react-leaflet | Affichage des terrains |
| **Backend** | Node.js + Express | API REST, logique métier |
| **ORM / BDD** | Prisma + **PostgreSQL** | Modèles de données, requêtes typées |
| **Auth** | JWT (jsonwebtoken) + hash bcrypt (via `utils/security`) | Token dans `localStorage`, header `Authorization: Bearer …` |
| **IA** | API **Groq** (modèle Llama 3.3) | Chat qui comprend le français et appelle des **fonctions** (tools) pour lire/créer des données |
| **PWA (optionnel)** | `vite-plugin-pwa` | Possibilité d’« installer » le site comme une app (manifest + service worker) |

**Séparation** : le front appelle uniquement des URLs du type `/api/...` (en prod, souvent derrière Nginx qui envoie ça vers Node sur un port interne).

---

## 3. Architecture logique

```
Navigateur (React)
    → HTTPS → /api/*  →  Express (routes par domaine : auth, requests, profile, …)
                              → Prisma → PostgreSQL
                              → Groq (chat IA)
    Emploi du temps : sync iCal → class_events en base
    Matchmaking : lecture EDT des deux users → créneau commun → enregistrement Match
```

- **Pas de SSR** : tout est une SPA (Single Page Application) ; le serveur renvoie du JSON pour l’API et des fichiers statiques pour le build React.

---

## 4. Base de données — les idées importantes

Tu n’as pas besoin de réciter toutes les tables ; retenir les **concepts** :

- **User** : compte (étudiant ou professeur), année, groupe, email, etc.
- **Sport** : nom + **mode** (`duel` = 1v1, `collective` = équipe, etc.) + lien avec les terrains autorisés.
- **Venue** : terrain / lieu avec coordonnées GPS pour la carte.
- **MatchRequest** : « je cherche un partenaire pour le sport X », notes de dispo, contraintes horaires (JSON), statut `pending` / etc.
- **Match** : lien entre **deux** demandes, avec créneau `start_time` / `end_time`, lieu, statut (`pending_acceptance` puis `scheduled`, puis `completed`).
- **ClassEvent** : cours importés depuis les emplois du temps (par groupe).
- **UserSport** : sports du profil + niveau + **nombre de matchs** (incrémenté quand un match est terminé).
- **Reward / UserReward** : badges débloqués selon des seuils (ex. nombre de matchs).
- **GroupEvent** / **GroupJoinRequest** / **Notification** : gestion avancée des **parties collectives** et notifications côté serveur.

Prisma sert à **décrire ces tables en code** et à éviter les requêtes SQL à la main pour le cœur du métier.

---

## 5. Authentification — comment ça marche

1. **Inscription** (`POST /api/auth/register`) : mot de passe hashé, utilisateur créé en base.
2. **Connexion** (`POST /api/auth/login`) : vérif du mot de passe → génération d’un **JWT** contenant l’`id` utilisateur (`sub`).
3. Le front stocke le token dans **`localStorage`** et l’envoie sur chaque requête protégée :  
   `Authorization: Bearer <token>`.
4. Le middleware **`getCurrentUser`** (dans `auth.js`) vérifie le JWT, recharge l’utilisateur en base, et met **`req.user`** pour les routes suivantes.

**À dire à l’oral** : « Session stateless avec JWT : le serveur ne garde pas de session en mémoire, il fait confiance au token signé. »

---

## 6. Fonctionnalités détaillées (ce que fait l’app + comment c’est implémenté)

### 6.1 Écran Login / Register (`App.jsx`, `Login.jsx`, `Register.jsx`)

- Si pas de token → formulaire login ou inscription.
- Après succès → `Dashboard`.
- **Implémentation** : état React `isAuthenticated`, `axios.defaults.baseURL = '/api'` pour préfixer toutes les URLs API.

---

### 6.2 Dashboard — navigation principale (`Dashboard.jsx`)

Une **grosse** composante qui regroupe :

- **Onglet IA** : chat avec l’agent.
- **Emploi du temps** : vue jour avec cours INSA + matchs INSAMATCH.
- **Lieux** : carte Leaflet des terrains.
- **Communauté** : classement / recherche d’utilisateurs.
- **Profil** : stats, sports, récompenses (desktop : colonne de droite sur l’onglet IA).

**Implémentation** : un state `activeTab` + rendu conditionnel (`renderChat`, `renderEmploiPage`, etc.). **Responsive** : barre du bas sur mobile, sidebars sur grand écran.

---

### 6.3 « Mes matchs » et liste des recherches

- **Desktop** : colonne gauche « Mes matchs » = liste des `MatchRequest` (via `GET /api/requests`).
- **Mobile** : même contenu dans un **tiroir** (drawer) ouvert par le bouton « Mes matchs ».
- Clic sur une carte → **détail** : partenaire, statut, boutons accepter / refuser / annuler / supprimer selon le cas.

**Backend** : `routes/requests.js` agrège chaque demande avec son éventuel **Match** ou **GroupEvent**, calcule `needsMyAction` (il manque encore ta confirmation sur un créneau proposé), formate lieu et texte d’heure.

**À dire** : « Une seule route liste enrichit les requêtes avec le match lié pour que le front affiche tout d’un coup. »

---

### 6.4 Agent IA + création de recherche (`ai_agent.js`, `routes/chat.js`)

**Principe** : ce n’est pas le modèle qui « invente » les matchs ; il appelle des **outils** (function calling) :

1. **`get_user_ins_match_context`** : lit en base les recherches actives et les matchs à venir, renvoie du JSON (avec créneaux déjà formatés en **heure Paris** pour éviter les bugs UTC).
2. **`create_match_request_tool`** : crée une vraie `MatchRequest` en base + résolution du sport (ex. tennis vs ping-pong) + déclenche le **matchmaking** (`tryPairAfterCreate`).

**Sécurité produit** :

- **Périmètre** : prompt système + filtres qui refusent code, devoirs, sujets hors appli.
- **Critères de genre** type « que des meufs » : réponse humoristique refusée + pas d’outil.
- **Confirmation** : pour les demandes ambiguës, le prompt demande une validation avant de créer.

**Flux** : `POST /api/chat` avec l’historique des messages → Groq avec `tools` → si l’IA appelle un outil, le serveur exécute la fonction Prisma, renvoie le résultat au modèle, puis **deuxième** réponse texte pour l’utilisateur.

**À dire** : « Pattern agent : LLM + outils = données fiables, pas d’hallucination sur les matchs réels. »

---

### 6.5 Matchmaking (cœur métier — `utils/matchmaking.js`, `utils/timetableMatch.js`)

**But** : quand deux personnes sont compatibles (même sport, terrains OK, etc.), trouver un **créneau où les deux sont libres** d’après leurs **emplois du temps** importés.

- Calcul des **trous** entre les cours (`findCommonFreeTime`) sur une fenêtre de jours.
- Prise en compte d’une contrainte type **« pas avant 15h le week-end »** (`time_constraints` en JSON sur la demande).
- Durée du match : **minimum** des préférences des deux joueurs (bornée 30–180 min).
- **Sports collectifs** : logique de **groupe** (`GroupEvent`) : plusieurs joueurs sur le même créneau, files d’attente pour rejoindre, notifications aux fondateurs.

**À dire** : « On ne propose pas un match si les EDT se chevauchent avec le cours ; c’est la valeur ajoutée par rapport à un simple chat. »

---

### 6.6 Emploi du temps unifié (`routes/schedule.js`)

- **GET /api/schedule** : pour l’utilisateur connecté, mélange **cours** (`ClassEvent`) et **événements match INSAMATCH** (matchs `scheduled` ou en attente d’acceptation).
- **Étudiants** : cours filtrés par `department` + `class_group`.
- **Professeurs** : cours dérivés des trigrammes dans les titres iCal, avec **dédoublonnage** des CM communs à plusieurs groupes (`dedupeProfessorEvents`).

**Sync** : `utils/syncTimetables.js` + **cron** dans `index.js` (tous les jours 3h + au démarrage) pour remplir `class_events` depuis les flux iCal des groupes.

**Front** : onglet Emploi du temps avec cartes colorées (cours vs match).

---

### 6.7 Lieux / carte (`routes/venues.js`, Leaflet dans `Dashboard`)

- API renvoie les terrains avec latitude / longitude.
- Le front affiche des **marqueurs** et popups (disponibilité ou infos selon ce que tu affiches).

---

### 6.8 Communauté (`routes/community.js`)

- Stats globales, **classement** d’athlètes, recherche d’utilisateurs.
- Clic sur un utilisateur → **profil externe** (autre route profil communauté) avec stats et matchs récents.

**Implémentation** : requêtes Prisma agrégées (`count`, `groupBy` ou équivalent selon ton code), pas de logique dans le front hors affichage.

---

### 6.9 Profil utilisateur (`routes/profile.js`)

- **GET** : infos perso, stats (matchs joués, sports, partenaires distincts), liste **UserSport**, **récompenses** (débloquées ou non), matchs récents.
- Déblocage **automatique** des rewards quand les seuils sont atteints (boucle sur les conditions `matches_total:X`, etc.).
- **PUT** : mise à jour profil + sports favoris.

**Robustesse** : gestion des données incomplètes (ex. match sans lieu) pour ne pas faire planter toute la route.

---

### 6.10 Après un match terminé (`utils/processCompletedMatches.js`)

- **Cron** toutes les 15 minutes (+ au boot) : repère les matchs passés → passe en `completed`, incrémente **`UserSport.match_count`** pour les sports concernés.

---

### 6.11 PWA (installer le site comme une app)

- **`vite-plugin-pwa`** génère `manifest.webmanifest` + **service worker** (Workbox) au `npm run build`.
- **`registerSW`** dans `main.jsx` enregistre le worker en production.
- Icônes **`pwa-192.png` / `pwa-512.png`** (script `npm run pwa:icons` si besoin).

**Conditions** : **HTTPS** en production ; servir tout le contenu du dossier `dist/` dont `sw.js` et le manifest.

---

## 7. Déploiement (ce que tu peux mentionner)

- **Backend** : Node lancé avec **PM2**, variables dans `.env` (`DATABASE_URL`, `JWT_SECRET`, `GROQ_API_KEY`, `ALLOWED_ORIGINS` pour CORS si domaine public, etc.).
- **Frontend** : `npm run build` → fichiers statiques derrière **Nginx** ; `location /api` → **reverse proxy** vers le port Node.
- **Base** : PostgreSQL sur la même machine ou managée.

---

## 8. Phrases « jury » — points forts

1. **Séparation des responsabilités** : API REST claire, front qui ne touche pas directement la BDD.
2. **Données cohérentes** : IA bridée par des **outils** + matchmaking basé sur des **EDT réels**.
3. **Modèle de données riche** : duel vs collectif, groupes, récompenses, profil prof / élève.
4. **Expérience mobile** : une app « feeling » avec drawer, bottom nav, et possibilité PWA.
5. **Ops** : cron pour EDT et matchs terminés, déploiement classique Node + Nginx.

---

## 9. Limites honnêtes (si on te pose la question)

- Dépendance à un **fournisseur IA** (Groq) et à la qualité des **flux iCal** des groupes.
- Pas d’application **store native** (sauf enveloppe type TWA si tu creuses plus tard).
- Charge / cache : service worker met en cache le **front** ; les données vivantes restent sur `/api`.

---

## 10. Questions du jury — choix techniques (réponses prêtes)

### Pourquoi **Neon** (ou une base managée) plutôt qu’« autre chose » ?

**Neon**, c’est du **PostgreSQL hébergé dans le cloud** (souvent avec une offre gratuite / étudiant-friendly). Ce n’est pas un autre moteur SQL : **tu restes sur Postgres**, tu changes surtout **où** il tourne.

**Arguments à l’oral :**

- **Pas de serveur à patcher** : pas d’installation Postgres sur la VM, sauvegardes et mises à jour gérées par le fournisseur.
- **Prisma + `DATABASE_URL`** : une seule variable d’environnement ; en local tu peux avoir Postgres dans Docker, en prod Neon — **même schéma**, pas de changement de code.
- **Scalabilité / branches** (selon l’offre) : pratique pour dev vs prod.

**Si on te dit « pourquoi pas tout sur ta VM ? »**  
Réponse honnête : *« On peut. J’ai choisi une base managée pour gagner du temps sur l’admin système et séparer clairement appli (Node) et données. »*

---

### Pourquoi **PostgreSQL** et pas MongoDB, SQLite, MySQL, etc. ?

- **Données relationnelles** : utilisateurs, demandes, matchs, clés étrangères, intégrité référentielle (`onDelete`, contraintes). C’est le cas typique d’un **SGBDR**.
- **JSON quand il le faut** : champ `time_constraints` sur une demande — Postgres gère le **JSON** sans passer à du NoSQL partout.
- **Prisma** est particulièrement mature avec **PostgreSQL** (migrations, types, enums si besoin).
- **SQLite** : très bien pour un prototype seul, moins pour **plusieurs utilisateurs** en écriture concurrente sur un serveur distant.
- **MongoDB** : utile si tout est document flexible ; ici le métier est **très structuré** (match, créneau, EDT), donc relationnel = plus simple à raisonner.

**Une phrase** : *« Le modèle métier est relationnel ; Postgres est le choix naturel avec Prisma. »*

---

### Pourquoi **Llama 3.3** (Meta) et pas GPT, Mistral, etc. ?

- **Llama** est une famille de modèles **ouverts** (licence Meta), bien documentée, avec de **bonnes versions multilingues** dont le français pour le chat étudiant.
- La variante **`llama-3.3-70b-versatile`** utilisée dans le projet est un bon compromis **qualité / compréhension des consignes** et **appel d’outils** (function calling).
- **GPT-4** ou autre aurait été **valable** aussi ; le choix passe souvent par **coût**, **latence**, et **disponibilité d’une API** compatible OpenAI (format messages + tools).

**À dire** : *« J’ai besoin d’un modèle qui comprend le français et qui sait suivre un schéma d’outils ; Llama 3.3 via Groq répond à ça pour ce projet. »*

---

### C’est quoi **Groq** ? Pourquoi Groq et **pas du local** ?

**Groq** (entreprise **Groq Inc.**) propose une **API d’inférence** très rapide sur certains modèles (dont Llama), avec une interface **proche d’OpenAI** (`chat.completions`, messages, `tools`).

**Pourquoi Groq plutôt qu’un modèle 100 % local sur ta machine / ton serveur ?**

| Critère | Cloud (Groq) | Local |
|--------|----------------|-------|
| **Matériel** | Aucun GPU obligatoire côté toi | GPU souvent nécessaire pour un 70B ou accepter un petit modèle moins bon |
| **Perf** | Inférence optimisée (LPU côté Groq) | Dépend de ton CPU/GPU |
| **Maintenance** | Clé API + HTTPS | Télécharger poids, versions, sécurité |
| **Coût projet** | Gratuit / crédits selon offre | Électricité + machine |

**Formulation honnête pour le jury** : *« Pour une soutenance et un déploiement étudiant, passer par une API évite de gérer un serveur GPU. Un modèle local serait pertinent pour de la confidentialité extrême ou sans connexion — ce n’était pas le cœur du sujet ici. »*

---

## 11. Focus IA — ta partie (comment c’est fait, « apprentissage », traitement)

### 11.1 Positionnement : ce n’est **pas** un modèle « entraîné sur INSAMATCH »

**Important à dire clairement :**

- On **n’a pas** refait un *fine-tuning* ou un *RLHF* sur une base INSAMATCH.
- Le modèle est **généraliste** ; ce qui le spécialise, c’est :
  1. le **prompt système** (règles, ton, périmètre) ;
  2. le **contexte injecté** (liste des sports / terrains lue en base via `getCampusInfo`) ;
  3. les **outils** (function calling) qui **forcent** les actions sensibles à passer par ton code ;
  4. des **garde-fous en JavaScript** avant même l’appel au LLM (hors sujet, critères de genre).

**Si on demande « comment tu lui apprends ? »**  
Réponse : *« J’enseigne le comportement par **instructions** (prompt) et **contrats** (schémas d’outils + code qui exécute), pas par réentraînement des poids. C’est l’approche classique “agent” en production pour des applis métier. »*

**Évolutions possibles** (pistes d’amélioration) : journaliser les conversations, ajouter des **exemples few-shot** dans le prompt, ou un jour un **fine-tune** si tu as assez de données étiquetées — **hors scope** du projet actuel.

---

### 11.2 Fichiers et flux réseau

| Élément | Fichier / lieu |
|--------|----------------|
| Logique principale | `backend/ai_agent.js` |
| Route HTTP | `backend/routes/chat.js` → `POST /api/chat` avec `{ history }` |
| SDK | `groq-sdk` (même usage que l’API Chat Completions) |
| Secret | `GROQ_API_KEY` dans `.env` |

**Flux complet (une question utilisateur) :**

1. Le **front** envoie tout l’historique des messages (rôles `user` / `assistant`).
2. Le backend récupère le **dernier message user**.
3. **Filtres immédiats** (sans LLM) :
   - `refusalIfObviousOffTopic` → code, devoirs, etc. ;
   - `refusalIfGenderExclusivePartnerRequest` → demande de match « que des meufs » / slang → réponse fixe « daleux ».
4. Sinon : chargement des **règles campus** (`getCampusInfo` → Prisma : sports, modes duel/collectif, terrains autorisés) injectées dans le **system prompt**.
5. **Premier appel** `groq.chat.completions.create` avec `messages` + `tools` + `tool_choice: "auto"`.
6. Si la réponse contient **`tool_calls`** :
   - pour chaque outil, le serveur exécute du **code Node** (Prisma, matchmaking) ;
   - le résultat est renvoyé dans un message `role: "tool"` ;
   - **deuxième** appel Groq **sans** tools pour produire le texte final lisible par l’utilisateur.
7. Sinon : le texte de l’assistant est renvoyé tel quel.

**Schéma mental :**

```
User → [garde-fous JS] → Groq (Llama) → soit texte, soit appel(s) outil(s)
                                              ↓
                                    fonctions JS + Prisma
                                              ↓
                                    Groq encore → texte final → User
```

---

### 11.3 Les **outils** (function calling) — cœur de la fiabilité

Deux outils déclarés pour le modèle (schéma JSON / description textuelle) :

1. **`get_user_ins_match_context`**  
   - Paramètres : aucun.  
   - Effet : requêtes Prisma sur les `MatchRequest` actives et les `Match` à venir.  
   - Sortie : **JSON stringifié** avec `creneau_pour_l_utilisateur` déjà formaté en **français, fuseau Europe/Paris** — pour que le LLM **recopie** sans recalculer UTC (source d’erreurs classiques).

2. **`create_match_request_tool`**  
   - Paramètres : `sport_name`, `venue_name`, `time_slot_notes`, optionnel `time_constraints` (ex. week-end pas avant 15h).  
   - Effet côté serveur :
     - `resolveSportForAgent` : règles **métier** (ex. « tennis » ≠ ping-pong sauf si tennis de table explicite) ;
     - vérif **terrain** + table de liaison **VenueSport** (interdit foot sur un terrain non autorisé) ;
     - création `MatchRequest` puis **`tryPairAfterCreate`** (matchmaking EDT).

**Pourquoi des outils ?**  
Le LLM **propose** des arguments structurés ; **seul ton code** écrit en base. Ça limite les **hallucinations** (« j’ai créé ton match » sans rien enregistrer).

---

### 11.4 Prompt système — ce qu’on « apprend » au modèle par texte

Le prompt fixe notamment :

- **Périmètre** : uniquement INSAMATCH (sport, créneaux, terrains) ; refus code / devoirs / hors sujet.
- **Règles genre** : refus des critères de partenaire par genre (aligné avec le filtre JS + ton « daleux »).
- **Quand appeler** `get_user_ins_match_context` (état des matchs, éviter les doublons).
- **Quand et comment** appeler `create_match_request_tool` : demandes vagues → poser des questions **sans** outil ; demandes lourdes → demander confirmation ; demande précise → appel direct.
- **Consignes tennis / ping-pong**, terrains, texte par défaut « Horaire automatique (Emploi du temps) », etc.

Les **RÈGLES SPORTS** sont **dynamiques** : générées depuis la BDD à chaque requête, donc si un admin ajoute un sport ou un terrain, l’IA voit la liste à jour.

---

### 11.5 Traitement des données « sensibles » côté code (hors LLM)

- **`sanitizeTimeConstraints`** : ne garde qu’un objet propre (`weekend_not_before_hour` borné 0–23).
- **`createMatchRequestTool`** : si le terrain n’existe pas ou n’est pas lié au sport → **message d’erreur** dans le JSON retour outil, pas de création silencieuse.
- Les **réponses outil** sont des chaînes JSON que le modèle **résume** pour l’utilisateur.

---

### 11.6 Phrases clés pour conclure ta partie IA

- *« Architecture **agent** : LLM pour le langage naturel, **outils** pour les actions sur la base. »*  
- *« Pas d’entraînement custom : **prompt + outils + garde-fous** = comportement contrôlé. »*  
- *« Groq + Llama 3.3 pour la **vitesse** et une API **simple** ; le **métier critique** reste en **Node/Prisma**. »*  
- *« Si je devais aller plus loin : logs, évaluation sur scénarios types, éventuellement few-shot ou fine-tune avec données propres. »*

---

## 12. Ordre suggéré pour l’oral (≈ 10–15 min) — mis à jour

1. **Problème** : partenaire sport + contrainte EDT.  
2. **Démo** : IA → recherche → Mes matchs → emploi du temps.  
3. **Stack** : React, Express, **Postgres** (éventuellement **Neon**), Prisma.  
4. **Auth JWT** (bref).  
5. **Ta partie IA** : garde-fous → prompt dynamique → **tools** → double appel Groq → pas de fine-tuning.  
6. **Matchmaking + EDT**.  
7. **Choix Groq / Llama vs local** si question.  
8. **Déploiement** + PWA si le temps le permet.

---

Bonne soutenance.
