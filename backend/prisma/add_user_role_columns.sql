-- À exécuter sur Neon **uniquement** si la table `users` date d’une vieille version sans ces colonnes
-- (erreur SQL du type "column user_role does not exist").
-- Sinon, préfère : `npx prisma db push` depuis le backend à jour.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_role" TEXT NOT NULL DEFAULT 'student';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "professor_trigram" TEXT;
