# KRYPTOS

A research prototype for invisible communication — encrypted messages hidden inside meme images and code snippets on public platforms, with no direct connections between parties and no observable communication pattern.

**Core idea:** Exchange information through public internet artifacts (images on Imgur, gists on GitHub) with zero direct connectivity, using cryptographic rendezvous to coordinate without ever communicating out-of-band again.

---

## How It Works

### The Cover

The app opens as a meme browser. Nothing looks covert. The real interface unlocks via Konami code: `↑ ↑ ↓ ↓ ← → ← → B A`.

### The Pipeline

When Alice sends a message to Bob:

1. **Encrypt** — XSalsa20-Poly1305 with a per-message ephemeral X25519 key (forward secrecy)
2. **Shard** — Shamir 3-of-5: split into 5 pieces, any 3 can reconstruct. Bob survives 2 dead drops going offline.
3. **Cover traffic** — Generate 15 fake shards (3× real count). Observers can't tell real from fake.
4. **Route** — Randomly assign each of the 20 shards to Imgur or Gist, with 500–8000ms jitter between uploads to break burst correlation.
5. **Embed** — Hide each shard in an image (LSB pixel manipulation) or a code file (trailing whitespace encoding). Visually undetectable.
6. **Upload** — Post to Imgur/GitHub tagged with the current rendezvous ID.

Bob polls Imgur/GitHub for items tagged with the same rendezvous ID, extracts the hidden data, verifies each shard's BLAKE2b-256 integrity, tries 3-shard combinations until Shamir reconstruction succeeds, and decrypts.

### Rendezvous Protocol

Both parties independently compute the same ID from the shared seed and the current UTC hour:

```
prk = BLAKE2b-256(seed)
rendezvous_id = BLAKE2b-128(date | hour | contactId, key=prk)
```

No communication required after the initial seed exchange. The ID rotates every hour automatically. Bob polls a ±2 hour window to handle clock drift and late uploads.

---

## Technical Architecture

### Cryptographic Stack

| Primitive | Implementation | Purpose |
|-----------|---------------|---------|
| X25519 | libsodium | Per-message ephemeral key exchange |
| XSalsa20-Poly1305 | libsodium secretbox | Authenticated encryption |
| Shamir 3-of-5 | secrets.js | Threshold secret sharing |
| BLAKE2b-256 | libsodium | Shard integrity hashing |
| BLAKE2b HKDF | libsodium | Hourly rendezvous ID derivation |
| BLAKE2b ratchet | libsodium | One-way session key advancement |

### Steganographic Channels

| Channel | Method | Carrier |
|---------|--------|---------|
| Imgur | LSB in R,G,B pixel channels | PNG images (3 bits/pixel) |
| GitHub Gist | Trailing space (0) / tab (1) per line | Code snippets |

### Layer Architecture

```
L6  Core pipeline       src/core/send.js, receive.js
L4  Rendezvous          src/rendezvous/
L3  Routing + cover     src/routing/
L2  Steganography       src/stego/
L1  Crypto primitives   src/crypto/
L0  Dead-drop channels  src/channels/
```

---

## Project Structure

```
kryptos/
├── src/                        # Backend (Node.js/Express)
│   ├── index.js                # HTTP server, API routes
│   ├── healthcheck.js          # External service probing
│   ├── keystore.js             # Generate-once keypair persistence
│   ├── ratchet.js              # One-way BLAKE2b key ratchet
│   ├── core/                   # send.js, receive.js — full pipeline
│   ├── crypto/                 # keyExchange, encrypt, shard, integrity
│   ├── stego/                  # lsb.js, whitespace.js
│   ├── rendezvous/             # hkdf.js — hourly ID derivation
│   ├── channels/               # imgur.js, gist.js — dead-drop APIs
│   └── routing/                # aiRouter.js (CSPRNG), coverTraffic.js
├── frontend/                   # React + Vite
│   └── src/
│       ├── components/
│       │   ├── kryptos/        # TopBar, LeftPanel, CenterPanel, RightPanel
│       │   │                   # ComposeArea, MessageCard, PairingModal
│       │   ├── meme/           # MemeBrowser cover UI
│       │   ├── onboarding/     # 4-step setup flow
│       │   └── shared/         # GlitchTransition, ThreatModelBadge
│       ├── pages/              # KryptosInterface, MemeBrowser
│       └── api/                # backend.js — Axios client
├── tests/                      # Jest (backend) + Vitest (frontend)
│   └── frontend/               # PairingModal, TopBar, LeftPanel, RightPanel
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── .env.example
```

---

## Quick Start

### Docker (recommended)

```bash
cp .env.example .env
# Edit .env — add IMGUR_CLIENT_ID and GITHUB_TOKEN
docker compose up --build
# Open http://localhost:3000
# Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
```

### Local dev

```bash
# Prerequisites: Node.js 20+, Redis running locally
npm install
cd frontend && npm install && cd ..
cp .env.example .env

# Terminal 1 — Redis
redis-server

# Terminal 2 — Backend
npm run dev       # :4000

# Terminal 3 — Frontend
cd frontend && npm run dev   # :5173
```

### Tests

```bash
# Backend (Jest)
npm test

# Frontend (Vitest)
cd frontend && npm test
```

---

## Environment Variables

```bash
# Required for covert channels
IMGUR_CLIENT_ID=        # Imgur API client ID
GITHUB_TOKEN=           # GitHub personal access token
GITHUB_USER=            # GitHub username (for Gist polling)

# Optional
PORT=4000
REDIS_URL=redis://localhost:6379
NODE_HANDLE=Node        # Display name in the UI
```

---

## API

All `/api/*` routes require `Authorization: Bearer <node-token>` (see startup logs on first run). `GET /health` is unauthenticated.

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Service health + uptime |
| GET | /api/identity | Node public key + fingerprint |
| GET | /api/contacts | All paired contacts |
| POST | /api/contacts | Add a contact (pairing) |
| DELETE | /api/contacts/:id | Remove a contact |
| GET | /api/messages/:id | Message thread (triggers covert receive) |
| POST | /api/messages | Send message (triggers covert send) |
| GET | /api/stats/:id | Per-contact session statistics |
| GET | /api/channels/status | Imgur/Gist/Redis reachability |

---

## Threat Model

### Protected against

- Passive interception in transit — only HTTPS to public platforms is visible
- Platform content scanning — carriers are structurally normal files
- Casual discovery — no visible messaging pattern without the seed
- Central server subpoena — no central server exists

### Not protected against

- Active steganalysis — LSB modification is statistically detectable
- Traffic timing correlation — upload/poll timing patterns are observable
- Endpoint compromise — device access voids all guarantees
- Seed compromise — rendezvous ID is predictable if seed is known
- Platform-level adversaries with database access

---

## Limitations

- LSB steganography is detectable by chi-square or RS analysis
- Two-party only — no group messaging
- Imgur and GitHub Gist API rate limits constrain throughput
- Ratchet is one-way BLAKE2b (not Signal double ratchet — no healing after key compromise)
- Polling window (±2h) means message delivery can lag up to 4 hours in the worst case

---

## Acknowledgements

- **Adi Shamir** — Shamir's Secret Sharing (1979)
- **Daniel J. Bernstein** — XSalsa20, Poly1305, Curve25519
- **libsodium / NaCl** — Cryptographic API
- **secrets.js, sharp** — JavaScript implementations used in this project
