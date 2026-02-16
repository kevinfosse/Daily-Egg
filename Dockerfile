# 1. Image de base
FROM node:20-alpine AS base

# 2. Étape des dépendances (Deps)
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copie des fichiers de dépendances
COPY package.json package-lock.json* ./
# Installation propre des dépendances
RUN npm ci

# 3. Étape de construction (Builder)
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV MONGODB_URI="mongodb://build-mock-uri"

# Désactiver la télémétrie Next.js pendant le build
ENV NEXT_TELEMETRY_DISABLED=1

# Construction du projet
RUN npm run build

# 4. Étape de production (Runner)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Création d'un utilisateur système pour la sécurité (ne pas tourner en root)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copie des fichiers nécessaires générés par le mode "standalone"
COPY --from=builder /app/public ./public

# On configure les permissions
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copie automatique de l'output standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Next.js écoute sur le port 3000 par défaut
EXPOSE 3000

ENV PORT=3000
# "server.js" est créé automatiquement par le mode standalone
CMD ["node", "server.js"]