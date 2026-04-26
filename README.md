# KRYPTOS

A research prototype that hides encrypted messages inside ordinary public internet content — no dedicated servers, no direct connections between parties, no observable communication pattern.

---

## The Problem

End-to-end encryption has become mainstream. Signal, WhatsApp, and iMessage all guarantee that no one can read your messages in transit. But encryption addresses only half of the surveillance problem.

The other half is metadata. When you send a message on any encrypted platform, the platform still knows you sent it. It knows who you sent it to, when, how often, and from where. Governments have compelled platforms for this metadata. Researchers have demonstrated that metadata alone — conversation patterns, timing, frequency — can reveal relationships, affiliations, and intent with striking accuracy. The content of the message becomes secondary.

What would it look like if two people could exchange information with no observable communication event at all? Not just encrypted communication, but *invisible* communication — where no observer, including the platforms involved, can detect that a conversation is occurring?

This question has preoccupied intelligence agencies for decades. Dead drop tradecraft, brush passes, and shortwave number stations all represent analog solutions to the same problem. Kryptos is a working prototype that applies this thinking to the modern internet, using contemporary cryptographic primitives and the vast noise floor of public web platforms as cover.

---

## How It Works (For Everyone)

### The Dead Drop

In Cold War tradecraft, a dead drop was a physical location — a hollow tree, a taped envelope under a park bench — where one agent left information for another. Neither party had to meet. Neither party had to communicate directly. The location itself was the channel.

Kryptos uses Imgur (a public image hosting platform) and GitHub Gist (a public code snippet service) as digital dead drops. Alice uploads content to these platforms. Bob retrieves it later. They never contact each other directly. The platforms see nothing unusual — just ordinary uploads and downloads from ordinary users.

### The Hidden Message

Invisible ink hides a message by making it physically present but visually undetectable. Steganography — the science of hidden writing — does the same thing digitally.

Kryptos hides encrypted messages inside the pixel data of meme images and inside the whitespace of code snippets. The image looks completely normal to anyone who sees it. The code snippet reads like legitimate text. The hidden data is imperceptible to the human eye and requires specialized analysis tools to detect, even then only probabilistically.

### Finding Each Other

If Alice hides a message inside a random image on Imgur, how does Bob know which of millions of images to look at? This is the rendezvous problem.

When Alice and Bob first pair their devices, they exchange a shared secret phrase — established once, out-of-band, face-to-face or via a separate secure channel. From this shared secret, both parties independently compute a unique identifier for each hour of each day. Alice tags her uploaded content with this identifier. Bob searches for content with the same tag. They arrive at the same location without ever coordinating in the moment, the same way two people can agree to meet at a specific café at noon without sending a calendar invite.

### The Disguise

Kryptos looks exactly like a meme browser. The interface shows trending memes, lets you upvote and downvote, and behaves in every respect like a content aggregator. There is no sign of its real function.

The full messaging interface is unlocked exclusively by the Konami code: `↑ ↑ ↓ ↓ ← → ← → B A`. This is not an easter egg. It is a deliberate design decision: if someone else is looking at your screen, they see a meme browser. This property is called plausible deniability.

---

## How It Works (Technical Deep Dive)

### Cryptographic Primitives

**X25519 Diffie-Hellman Key Exchange** — Initial pairing uses X25519 elliptic curve Diffie-Hellman to establish a shared secret over an untrusted channel. X25519 was chosen for its resistance to invalid-curve attacks, its performance characteristics, and its immunity to the implementation pitfalls common to NIST curves. It produces the root shared secret from which all session keys derive.

**XSalsa20-Poly1305 Authenticated Encryption** — All message content is encrypted with XSalsa20-Poly1305 via libsodium's `secretbox`. XSalsa20 extends Salsa20 with a 192-bit nonce, eliminating nonce-reuse risk in practice. Poly1305 provides authentication — any tampering with the ciphertext is detected before decryption. This construction guarantees both confidentiality and integrity.

**Shamir's Secret Sharing (2-of-3)** — Each encrypted message is split into three mathematical shares using Shamir's scheme. Any two shares reconstruct the original. One share travels via Imgur; one via GitHub Gist; one is held locally as a redundancy shard. This means no single channel compromise exposes the message, and Bob can recover the message if either channel is unavailable.

**BLAKE2b** — Used for two distinct purposes: integrity verification of reassembled shards, and daily seed ratcheting. BLAKE2b was chosen over SHA-256 for its speed and its resistance to length extension attacks. The daily ratchet (`next_seed = BLAKE2b(current_seed)`) advances the key material forward — limiting the blast radius of a seed compromise to the past only.

**HKDF for Rendezvous Derivation** — The rendezvous identifier for any given hour is derived via HKDF: `HKDF(seed ∥ date ∥ hour) → rendezvous_id`. Both parties compute this independently. No communication is required to synchronize — only clock agreement, which UTC provides.

### Steganographic Transport

**LSB Steganography** — Images transmitted via Imgur carry hidden data in the least-significant bits of pixel channels. Modifying the LSB of each pixel produces a color shift of at most 1/255 — invisible to the human visual system. For a 1024×768 image, capacity is approximately 294KB using all three channels at 1 bit per channel. Kryptos uses a more conservative embedding rate to reduce statistical footprint.

Detectability is a known and documented limitation. Chi-square analysis, RS (Regular-Singular) analysis, and Sample Pair analysis can all detect systematic LSB modifications in image populations. Against a passive observer visually browsing content, LSB stego is robust. Against automated steganalysis tools running at platform scale, it is not.

**Whitespace Steganography** — GitHub Gist carriers encode data in the whitespace structure of code snippets — tabs versus spaces, and zero-width Unicode characters inserted between visible tokens. Text-channel steganography is statistically independent from image-channel steganography. The two channels complement each other: an adversary who has defeated image steganalysis has not automatically defeated whitespace steganalysis.

### Rendezvous Protocol

The protocol proceeds as follows:

1. Alice and Bob establish a shared seed phrase out-of-band — once, at pairing time.
2. Each hour, both parties independently compute: `rendezvous_id = HKDF(seed ∥ ISO_date ∥ hour_UTC)`
3. Alice tags each uploaded shard with this `rendezvous_id` in a metadata field that appears, in context, like an ordinary caption or description string.
4. Bob polls Imgur and GitHub Gist for content tagged with the same `rendezvous_id`. When found, he extracts and reassembles the shards.
5. At midnight UTC, both parties ratchet: `seed = BLAKE2b(seed)`. Neither party sends anything to perform this step.

The rendezvous window rotates hourly. Forward secrecy is partial — daily ratcheting limits historical exposure, but the ratchet is deterministic, not ephemeral. A full double-ratchet protocol would be required for Signal-equivalent forward secrecy.

### Dead Drop Channels

Imgur and GitHub Gist were selected for three reasons: they are high-volume public platforms (hiding in a large noise floor), they allow unauthenticated or lightly authenticated reads (Bob needs no account to poll), and their content APIs return metadata searchable by description or tag.

Alice uploads with a randomized jitter of 0–120 seconds applied after the compose action. Bob's polling scheduler, managed via BullMQ, fires on a randomized interval of 25–35 minutes — never a fixed cadence that could produce a detectable fingerprint. Neither party ever contacts the other directly; every network request goes to a public platform endpoint.

### Traffic Mitigation

Two cover shards are uploaded for every real shard. These are valid steganographic carriers with random payloads — indistinguishable from real traffic to an outside observer counting upload events. Upload timing is additionally jittered. Dummy poll requests are injected into the poll schedule at random intervals to blur the ratio of poll events to real retrievals.

This approach raises the cost of traffic analysis. It does not eliminate it. A sufficiently resourced observer correlating upload events on Imgur with retrieval events on GitHub Gist, controlling for timing, could still infer a communication relationship. This is documented explicitly in the threat model below.

### Redis Architecture

Redis runs locally on each user's machine. It is never exposed to the network. It serves four functions:

- **Shard cache**: Incoming shards are stored with a TTL matching the current rendezvous window. Expired shards are evicted automatically.
- **BullMQ job queue**: The polling scheduler persists across application restarts. Jobs are not lost if the application closes mid-cycle.
- **Message inbox**: Fully reassembled and decrypted messages are stored in an inbox queue, decoupled from the polling loop. The UI reads from this queue, not from the channels directly.
- **Rate limit and statistics tracking**: Per-channel, per-hour upload and download counts feed the cover traffic calibration algorithm, ensuring the ratio of real to fake shards stays consistent.

Redis is a local implementation detail, not a server dependency. It satisfies the zero-trust constraint: no message content or key material transits any infrastructure outside the user's device.

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

Honest threat modeling is not a weakness. It is a prerequisite for meaningful security claims.

### What Kryptos Protects Against

- **Passive interception**: A third party intercepting network traffic sees only HTTPS requests to Imgur and GitHub. Message content is encrypted before it leaves the device.
- **Platform content scanning**: Imgur and GitHub scanning their own content for messages will find images and code snippets that appear completely ordinary. Neither platform has the context of the shared seed required to identify rendezvous-tagged content.
- **Casual discovery**: Someone who stumbles upon a carrier image or Gist cannot detect hidden content without steganalysis tools and will find nothing that looks like a communication artifact.
- **Server subpoena**: There is no central server. There is no database of messages, users, or relationships to compel.

### What Kryptos Explicitly Does NOT Protect Against

- **Active steganalysis**: Chi-square, RS, and Sample Pair analysis can detect LSB modifications in image populations at scale. A platform running automated steganalysis across all uploads would flag Kryptos-embedded images at a non-trivial rate. This is a fundamental limitation of first-generation LSB steganography.
- **Behavioral traffic correlation**: Alice uploading to Imgur and Bob polling Imgur at correlated times, observed over multiple rendezvous windows, is detectable by a sufficiently resourced adversary. Timing jitter raises the cost; it does not eliminate the signal.
- **Compromised endpoints**: If Alice's or Bob's device is compromised, all cryptographic guarantees are void. Kryptos provides no runtime protection against an adversary with device access.
- **Seed compromise**: If the shared seed is obtained, all future rendezvous identifiers are predictable until a manual re-key is performed. Daily ratcheting limits historical exposure but does not provide forward secrecy in the formal sense.
- **Nation-state adversaries with platform access**: An adversary with API-level or database-level access to Imgur or GitHub can operate outside the assumptions this system was designed under.

### Why We Document This

Signal publishes a detailed threat model. Tor publishes a detailed threat model. Every serious security system does. A system that cannot articulate its own limits is not more secure for the omission — it is less trustworthy. Kryptos is a research prototype. Understanding where it holds and where it breaks is the point of building it.

---

## Limitations and Future Work

### Known Limitations

- LSB steganography is detectable by statistical steganalysis tools at sufficient scale.
- Polling creates a behavioral fingerprint that timing jitter only partially obscures.
- Daily ratcheting provides limited forward secrecy — a seed compromise exposes all future windows until manual re-key.
- Carrier content (images, Gists) persists on Imgur and GitHub indefinitely. There is no deletion mechanism.
- Group messaging is not supported. The rendezvous protocol is designed for two-party communication.
- Imgur and GitHub API rate limits constrain practical message throughput to a few messages per hour.

### Future Work

A production-grade v2 would address these limitations:

- **DCT-domain image steganography**: Hiding data in JPEG frequency coefficients rather than pixel LSBs is statistically robust against chi-square and RS analysis.
- **Double ratchet protocol**: Implementing a Signal-style double ratchet would provide cryptographic forward secrecy, not ratchet-based approximations.
- **Expanded covert channels**: DNS TXT record queries, HTTP timing channels, and blockchain transaction metadata are all plausible carrier channels with distinct traffic profiles.
- **Formal rendezvous proof**: The security of the HKDF-based rendezvous derivation warrants a formal reduction to a standard cryptographic assumption.
- **Tor transport**: Routing uploads and downloads through Tor would eliminate IP-level correlation between Alice and Bob.

---

## Project Structure

```
kryptos/
├── .env.example                    # Required environment variables template
├── package.json                    # Backend dependencies and test scripts
│
├── src/                            # Backend source
│   ├── core/
│   │   ├── send.js                 # End-to-end send pipeline (encrypt → shard → embed → upload)
│   │   └── receive.js              # End-to-end receive pipeline (poll → extract → reconstruct → decrypt)
│   ├── crypto/
│   │   ├── keyExchange.js          # X25519 key pair generation and ECDH
│   │   ├── encrypt.js              # XSalsa20-Poly1305 encrypt/decrypt via libsodium
│   │   ├── shard.js                # Shamir's Secret Sharing encode/decode via secrets.js
│   │   └── integrity.js            # BLAKE2b hash verification and seed ratcheting
│   ├── stego/
│   │   ├── lsb.js                  # LSB embed/extract for PNG images via sharp
│   │   └── whitespace.js           # Whitespace and zero-width character steganography
│   ├── rendezvous/
│   │   ├── hkdf.js                 # HKDF rendezvous_id derivation
│   │   └── index.js                # Rendezvous window management and rotation logic
│   ├── channels/
│   │   ├── imgur.js                # Imgur upload/poll API integration
│   │   └── gist.js                 # GitHub Gist upload/poll API integration
│   └── routing/
│       ├── aiRouter.js             # Intelligent shard-to-channel routing
│       └── coverTraffic.js         # Cover shard generation and injection
│
├── tests/                          # Jest test suite
│
└── frontend/                       # React frontend source
    ├── index.html                  # Vite HTML entry point
    ├── vite.config.js              # Vite configuration
    ├── tailwind.config.js          # Tailwind CSS configuration
    ├── postcss.config.js           # PostCSS configuration
    ├── .npmrc                      # Legacy peer deps flag for react-qr-reader
    └── src/
        ├── App.jsx                 # Mode state, Konami listener, glitch transition
        ├── main.jsx                # React entry point, global style imports
        ├── api/
        │   ├── memeApi.js          # meme-api.com integration for cover content
        │   └── backend.js          # Axios client for local backend API endpoints
        ├── components/
        │   ├── meme/
        │   │   ├── MemeNavbar.jsx  # Fixed navbar with tabs and search
        │   │   ├── MemeGrid.jsx    # Masonry grid with skeleton loading
        │   │   ├── MemeCard.jsx    # Individual meme card with vote interactions
        │   │   └── SearchBar.jsx   # Expanding search input
        │   ├── kryptos/
        │   │   ├── TopBar.jsx      # 48px top bar with contact info and exit
        │   │   ├── LeftPanel.jsx   # Node identity, rendezvous timer, contacts
        │   │   ├── CenterPanel.jsx # Message thread and empty state
        │   │   ├── RightPanel.jsx  # Contact details, seed health, session stats
        │   │   ├── MessageCard.jsx # Message card with technical detail drawer
        │   │   ├── ContactCard.jsx # Contact list entry with unread badge
        │   │   └── ComposeArea.jsx # Textarea, priority toggle, send button, pipeline
        │   ├── shared/
        │   │   ├── GlitchTransition.jsx  # CSS glitch animation wrapper
        │   │   └── ThreatModelBadge.jsx  # Permanent protection scope indicator
        │   └── onboarding/
        │       ├── OnboardingFlow.jsx    # 4-step onboarding orchestrator
        │       ├── KeyGenStep.jsx        # Animated keypair generation
        │       ├── AddContactStep.jsx    # QR scan or manual seed phrase entry
        │       └── ConfigureChannels.jsx # Imgur and GitHub token configuration
        ├── hooks/
        │   └── useKonamiCode.js    # Konami sequence detector
        ├── pages/
        │   ├── MemeBrowser.jsx     # MODE 1: the public-facing cover interface
        │   └── KryptosInterface.jsx # MODE 2: the covert communication interface
        ├── store/
        │   └── useAppStore.js      # Zustand global state (mode, glitch, onboarding)
        └── styles/
            ├── globals.css         # CSS variable design system and Tailwind base
            └── animations.css      # Keyframes: fadeIn, slideIn, pulse, shimmer, glitch
```

---

## Setup and Running

### Prerequisites

- **Node.js** — v20.x or later
- **npm** — v10.x or later
- **Redis** — v7.x or later, running locally on default port `6379`

### Environment Variables

```bash
# .env — copy from .env.example and fill in values

# Imgur API client ID
# Create an application at: https://api.imgur.com/oauth2/addclient
# Choose "Anonymous usage without user authorization"
IMGUR_CLIENT_ID=your_imgur_client_id_here

# GitHub Personal Access Token
# Create at: https://github.com/settings/tokens
# Required scopes: gist (read/write)
GITHUB_TOKEN=ghp_your_github_token_here
```

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourname/kryptos.git
   cd kryptos
   ```

2. Install backend dependencies:
   ```bash
   npm install
   ```

3. Copy and configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and fill in your Imgur Client ID and GitHub Token
   ```

4. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

### Running Locally

Start Redis (must be running before the backend):
```bash
redis-server
```

Start the backend (in a separate terminal):
```bash
node src/core/index.js
```

Start the frontend dev server (in a separate terminal):
```bash
cd frontend
npm run dev
```

Open your browser to: `http://localhost:5173`

You will see the meme browser. To access the KRYPTOS interface, type the Konami code while the browser window is focused:

```
↑  ↑  ↓  ↓  ←  →  ←  →  B  A
```

A brief glitch animation will fire, and the meme browser will dissolve into the covert communication interface.

### Running Tests

```bash
npm test
```

Expected passing output:
```
PASS  tests/crypto.test.js
PASS  tests/stego.test.js
PASS  tests/rendezvous.test.js

Test Suites: 3 passed, 3 total
Tests:       18 passed, 18 total
```

---

## Running with Docker (Recommended)

### Prerequisites

- Docker Desktop installed and running
- Git

### Steps

1. Clone the repository
2. `cp .env.example .env`
3. Fill in `IMGUR_CLIENT_ID` and `GITHUB_TOKEN` in `.env`
4. `./scripts/start.sh`
5. Open http://localhost:3000
6. Enter the Konami code: `↑ ↑ ↓ ↓ ← → ← → B A`

### Useful Commands

| Command | Description |
| --- | --- |
| View all logs | `docker compose logs -f` |
| View backend logs | `docker compose logs -f backend` |
| Check health | `./scripts/healthcheck.sh` |
| Stop | `./scripts/stop.sh` |
| Stop + wipe data | `docker compose down -v` |
| Rebuild | `docker compose up --build` |

### Development Mode

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

- Frontend hot reload at http://localhost:5173
- Backend hot reload at http://localhost:4000
- Redis exposed at localhost:6379

---

## The Research Contribution

Kryptos demonstrates that decentralized steganographic covert channels are practically implementable using nothing more than modern web APIs, standard cryptographic libraries, and existing public internet infrastructure. Prior work in covert channel research has often assumed either a shared physical medium or a dedicated covert server. Kryptos eliminates both assumptions — the dead drop infrastructure is borrowed entirely from existing public platforms, and coordination happens through shared cryptographic derivation, not communication.

The time-based HKDF rendezvous protocol is the system's most novel design element. By deriving a shared identifier from a seed and a clock, two parties can locate each other's content across millions of uploads without exchanging any message in the moment. This collapses the coordination problem to a single out-of-band event at pairing time — and makes the system architecturally serverless in the strongest sense.

Understanding what a system cannot do is as valuable as understanding what it can. Kryptos was built with explicit threat modeling not as a disclaimer, but as a contribution. The specific failure modes — LSB steganalysis detectability, behavioral traffic correlation, seed compromise propagation — are the right open problems for a v2 to address. A prototype that knows its limits is a platform for future work. One that does not is a liability.

> Kryptos is a prototype exploring decentralized steganographic covert channels. It demonstrates that two parties can exchange messages through public internet artifacts with zero direct connectivity, using cryptographic rendezvous to coordinate without communication. The system is designed to resist casual inspection and platform-level observers. It explicitly does not claim resistance to active steganalysis or behavioral traffic correlation at scale — these known limitations are documented above and represent open research problems in the field.

---

## Acknowledgements

- **Adi Shamir** — for the secret sharing construction (1979) that makes resilient multi-channel distribution possible.
- **Daniel J. Bernstein** — for XSalsa20, Poly1305, and Curve25519, whose design decisions have made high-assurance cryptography accessible to practitioners.
- **The Tor Project** — for formalizing the threat model of traffic analysis and demonstrating that honest adversarial modeling can coexist with practical deployment.
- **libsodium** and the NaCl team — for wrapping these primitives in an API that is difficult to misuse.
- **secrets.js** — for the JavaScript implementation of Shamir's Secret Sharing.
- **sharp** — for the high-performance image processing that makes LSB embedding practical in a Node.js environment.
