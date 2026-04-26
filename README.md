# KRYPTOS

A research prototype for invisible communication — encrypted messages hidden in plain sight using steganography, with no direct connections between parties and no observable communication pattern.

**Core idea:** Exchange information through public internet artifacts (images on Imgur, code on GitHub Gist) with zero direct connectivity, using cryptographic rendezvous to coordinate without communication.

---

## How It Works

### The Concept

- **Dead Drops:** Uses Imgur and GitHub Gist as digital dead drops. Alice uploads, Bob retrieves — never contacting each other directly.
- **Steganography:** Hides encrypted messages in image pixels (LSB) and code whitespace. Visually undetectable.
- **Rendezvous:** Both parties compute `rendezvous_id = HKDF(seed ∥ date ∥ hour)` from a shared secret — synchronized without communication.

### Plausible Deniability

The interface looks like a meme browser. The covert messaging interface unlocks via Konami code: `↑ ↑ ↓ ↓ ← → ← → B A`.

---

## Technical Architecture

### Cryptographic Primitives

| Primitive | Purpose |
|-----------|---------|
| **X25519** | ECDH key exchange for initial pairing |
| **XSalsa20-Poly1305** | Authenticated encryption via libsodium secretbox |
| **Shamir 2-of-3** | Message sharding across channels with redundancy |
| **BLAKE2b** | Shard integrity + daily seed ratcheting |
| **HKDF** | Hourly rendezvous ID derivation |

### Steganographic Transport

- **LSB Steganography:** Embeds data in PNG pixel LSBs (Imgur channel)
- **Whitespace Steganography:** Encodes data in code whitespace (Gist channel)

*Note: LSB steganography is detectable by statistical analysis. This is a known limitation.*

### Rendezvous Protocol

1. Exchange shared seed out-of-band (once, at pairing)
2. Both parties independently compute: `rendezvous_id = HKDF(seed ∥ date ∥ hour_UTC)`
3. Alice uploads to Imgur/Gist tagged with `rendezvous_id`
4. Bob polls for matching tags, extracts and reassembles shards
5. Daily ratchet: `seed = BLAKE2b(seed)` at midnight UTC

### Traffic Mitigation

- 2 cover shards per real shard (statistical camouflage)
- Upload jitter: 0-120 seconds
- Poll interval: randomized 25-35 minutes
- Cover traffic generation to blur patterns

### Redis (Local Only)

- Shard cache (TTL = rendezvous window)
- BullMQ job queue for persistence
- Message inbox for UI decoupling
- Rate limit tracking per channel

---

## Architecture Diagram

```
ALICE                                                           BOB
─────                                                           ───

[Shared seed established out-of-band at pairing time]

HKDF(seed ∥ date ∥ hour)                   HKDF(seed ∥ date ∥ hour)
        │                                               │
        ▼                                               ▼
  rendezvous_id  ──── (same value, computed independently) ────  rendezvous_id

Compose plaintext
        │
        ▼
Encrypt: XSalsa20-Poly1305
        │
        ▼
Shard: Shamir 2-of-3 → [Shard A] [Shard B] [Shard C]
        │                  │         │
        ▼                  ▼         ▼
Tag each shard     Embed in image  Embed in Gist
with rendezvous_id  (LSB stego)   (whitespace stego)
        │                  │         │
        ▼                  ▼         ▼
Upload (jittered)  ──▶  [Imgur]  [GitHub Gist]  ◀──  Poll (randomized, 25-35min)
+ cover shards                                              │
                                                            ▼
                                               Find tags matching rendezvous_id
                                                            │
                                                            ▼
                                               Extract steganographic payload
                                                            │
                                                            ▼
                                               Verify BLAKE2b shard integrity
                                                            │
                                                            ▼
                                               Reconstruct: Shamir 2-of-3
                                                            │
                                                            ▼
                                               Decrypt: XSalsa20-Poly1305
                                                            │
                                                            ▼
                                                     Read plaintext

─────────────────────────────────────────────────────────────────
LOCAL REDIS (Alice)                       LOCAL REDIS (Bob)
────────────────────                      ────────────────
• Shard cache (TTL: 1hr window)           • Shard cache (TTL: 1hr window)
• BullMQ: upload job queue                • BullMQ: poll job queue
• Upload stats (cover calibration)        • Message inbox (decrypted)
• Rate limit counters per channel         • Rate limit counters per channel

[Never networked. Never exposed. Local only.]
─────────────────────────────────────────────────────────────────

Daily at midnight UTC — both sides independently:
  next_seed = BLAKE2b(current_seed)
  next rendezvous_id shifts — no communication required
```

---

## Threat Model

### What Kryptos Protects Against

- **Passive interception** — Only HTTPS requests to public platforms visible
- **Platform scanning** — Carriers appear ordinary without the shared seed context
- **Casual discovery** — Hidden content requires steganalysis tools to detect
- **Server subpoena** — No central server; no database to compel

### What It Does NOT Protect Against

- **Active steganalysis** — Statistical analysis can detect LSB modifications
- **Traffic correlation** — Upload/poll timing patterns observable by resourced adversaries
- **Compromised endpoints** — Device compromise voids all guarantees
- **Seed compromise** — Predictable rendezvous IDs until re-key
- **Platform-level adversaries** — API/database access defeats assumptions

*Honest threat modeling is a prerequisite for meaningful security. Kryptos is a research prototype — understanding its limits is the point.*

---

## Limitations & Future Work

**Known Limitations:**
- LSB steganography detectable by statistical analysis
- Polling creates observable behavioral fingerprints
- Limited forward secrecy (deterministic ratchet, not double-ratchet)
- Carrier content persists indefinitely on platforms
- Two-party only; no group messaging
- API rate limits constrain throughput

**Future Improvements:**
- DCT-domain steganography (JPEG coefficients) for statistical robustness
- Signal-style double ratchet for true forward secrecy
- Expanded channels: DNS TXT, HTTP timing, blockchain metadata
- Formal cryptographic proof of rendezvous security
- Tor transport for IP-level anonymity

---

## Project Structure

```
kryptos/
├── docker/                         # Docker configuration
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx.conf
├── scripts/                        # Helper scripts
│   ├── start.sh
│   ├── stop.sh
│   └── healthcheck.sh
├── src/                            # Backend (Node.js)
│   ├── core/                       # send.js, receive.js
│   ├── crypto/                     # X25519, XSalsa20-Poly1305, Shamir, BLAKE2b
│   ├── stego/                      # LSB image, whitespace text
│   ├── rendezvous/                 # HKDF-based ID derivation
│   ├── channels/                   # Imgur, GitHub Gist APIs
│   └── routing/                    # AI router, cover traffic
├── tests/                          # Jest test suite
└── frontend/                       # React + Vite frontend
    └── src/
        ├── components/
        │   ├── meme/               # MemeBrowser UI (cover)
        │   ├── kryptos/            # Messaging UI (covert)
        │   ├── onboarding/         # Setup flow
        │   └── shared/             # GlitchTransition, etc.
        ├── pages/                  # MemeBrowser, KryptosInterface
        └── api/                    # Backend API client
```

---

## Quick Start

### Option 1: Docker (Recommended)

```bash
cp .env.example .env
# Fill in IMGUR_CLIENT_ID and GITHUB_TOKEN
./scripts/start.sh
# Open http://localhost:3000
# Enter Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
```

### Option 2: Local Dev

```bash
# Prerequisites: Node.js 20+, Redis
npm install
cd frontend && npm install && cd ..
cp .env.example .env  # Fill in API keys

# Terminal 1
redis-server

# Terminal 2
npm run dev        # Backend on :4000

# Terminal 3
cd frontend && npm run dev  # Frontend on :5173

# Open http://localhost:5173
```

### Running Tests

```bash
npm test
```

---

## Testing Two-User Communication

Kryptos uses a **shared seed** for rendezvous — both parties must have the same seed to find each other's messages.

### Setup (Both Users)

1. Each user runs their own Kryptos instance (separate machines or separate browser profiles)
2. Both users configure the same `IMGUR_CLIENT_ID` and `GITHUB_TOKEN` in their `.env`
3. In the onboarding flow, both users enter the **same seed phrase** (e.g., `correct-horse-battery-staple-42`)

### Sending a Message (Alice)

1. Open the KryptOS interface (Konami code: `↑ ↑ ↓ ↓ ← → ← → B A`)
2. Select Bob from contacts (or add his node ID)
3. Type a message in the compose area
4. Click **Send**
5. The message pipeline runs: `Encrypt → Shard → Embed → Upload`
6. Shards upload to Imgur and GitHub Gist with the current rendezvous tag

### Receiving a Message (Bob)

1. The backend polls Imgur/GitHub every 25-35 minutes for rendezvous-tagged content
2. When Bob's instance finds matching shards:
   - Extracts steganographic payload from images/whitespace
   - Verifies shard integrity (BLAKE2b)
   - Reconstructs the message (Shamir 2-of-3)
   - Decrypts (XSalsa20-Poly1305)
   - Stores in local Redis inbox
3. Message appears in Bob's chat interface

### Manual Testing Without Wait

Force an immediate poll via API:
```bash
# Check health
curl http://localhost:3000/api/health

# View messages for a contact
curl http://localhost:3000/api/messages/contact-1

# Send a test message
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"contactId": "contact-1", "text": "Test message", "priority": false}'
```

### Verifying Message Delivery

1. Check container logs: `docker compose logs -f backend`
2. Look for: `shard uploaded`, `poll complete`, `message reconstructed`
3. Check health endpoint: `curl http://localhost:3000/api/health`
4. Verify channel status: `curl http://localhost:3000/api/channels/status`

**Note:** In the current prototype, messages use stub data for demonstration. Full end-to-end steganographic upload/poll requires valid Imgur/GitHub credentials and actual image carriers.

---

## Docker Commands

| Command | Description |
|---------|-------------|
| `./scripts/start.sh` | Build and start all services |
| `./scripts/stop.sh` | Stop services |
| `./scripts/healthcheck.sh` | Check container health |
| `docker compose logs -f` | View logs |
| `docker compose down -v` | Stop and wipe data |
| `docker compose up --build` | Rebuild and start |

**Development Mode:**
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
# Frontend: http://localhost:5173
# Backend: http://localhost:4000
# Redis: localhost:6379
```

---

## Research Contribution

Kryptos demonstrates that decentralized steganographic covert channels are practically implementable using only modern web APIs, standard cryptography, and existing public infrastructure. Prior work assumed dedicated covert servers or shared physical media. Kryptos eliminates both — using borrowed public platforms for dead drops and cryptographic derivation for coordination.

The time-based HKDF rendezvous protocol is the most novel element: two parties derive a shared identifier from a seed and clock, locating each other's content across millions of uploads without exchanging messages. This collapses coordination to a single out-of-band pairing event.

> *Kryptos is a research prototype. It does not claim resistance to active steganalysis or traffic correlation at scale — these documented limitations represent open problems in the field.*

---

## Acknowledgements

- **Adi Shamir** — Shamir's Secret Sharing (1979)
- **Daniel J. Bernstein** — XSalsa20, Poly1305, Curve25519
- **The Tor Project** — Traffic analysis threat modeling
- **libsodium/NaCl team** — Cryptographic API design
- **secrets.js, sharp** — JavaScript implementations
