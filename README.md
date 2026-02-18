# VoidManagment

Panel staff Discord moderne (dashboard realtime) avec:
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Base de donnees: MongoDB
- Realtime: Socket.io
- API Discord: bot (et lien OAuth2)

## Structure

```txt
/client
/server
/models
/routes
/middleware
```

## Installation

1. Installer les dependances:

```bash
npm install
```

2. Configurer les variables:

```bash
copy .env.example .env
```

3. Renseigner dans `.env`:
- `MONGO_URI`
- `JWT_SECRET`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_CLIENT_ID` (optionnel)
- `DISCORD_CLIENT_SECRET` (optionnel)
- `DISCORD_REDIRECT_URI` (optionnel)

4. Creer une premiere cle fondateur:

```bash
npm run seed
```

5. Lancer le projet:

```bash
npm run dev
```

Le panel sera disponible sur `http://localhost:5000`.

## Fonctions incluses

- Auth par cles de session (hash bcrypt en base)
- Roles: `Modérateur`, `Admin`, `SuperAdmin`, `Fondateur`
- Permissions personnalisees par cle
- Desactivation/activation de cles a distance
- Logs de connexion (pseudo, date, heure, IP)
- Workbook CSV de connexion (`server/data/connection_workbook.csv`)
- Historique actions staff
- Export CSV des logs actions/connexions
- Gestion Discord:
  - recherche membres
  - profil membre
  - warn + compteur
  - notes internes
  - mute temporaire
  - kick
  - demande de ban
  - ban temp / ban definitif / unban (permissions elevees)
- Tickets support
- Page activite recente en live (Socket.io)
- Notifications temps reel pour fondateurs

## Endpoints API principaux

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/dashboard/stats`
- `GET /api/dashboard/recent-activity`
- `GET /api/discord/members?q=`
- `POST /api/discord/member/:id/warn`
- `POST /api/discord/member/:id/note`
- `POST /api/discord/member/:id/mute-temp`
- `POST /api/discord/member/:id/ban-request`
- `POST /api/discord/member/:id/ban-temp`
- `POST /api/discord/member/:id/ban`
- `DELETE /api/discord/member/:id/ban`
- `GET /api/logs/actions`
- `GET /api/logs/connections`
- `GET /api/logs/actions/export.csv`
- `GET /api/logs/connections/export.csv`
- `GET /api/tickets`
- `POST /api/tickets`
- `PATCH /api/tickets/:id/status`
- `GET /api/keys` (fondateur)
- `POST /api/keys` (fondateur)
- `PATCH /api/keys/:id/active` (fondateur)

## Notes securite

- `helmet` + `express-rate-limit` + `express-mongo-sanitize`
- Verification role + permission middleware sur chaque action sensible
- Token bot Discord via variables d'environnement
- Clés hashées en base (jamais stockees en clair)
