# Kryptos — The Complete Technical Explanation

*Using the Feynman technique: explain every concept as if you're teaching it to someone smart who has never seen it before. No jargon without a plain-English definition first.*

---

## What Is This Project?

Kryptos is a **covert messaging system**. Alice wants to send Bob a message. But Alice doesn't just want the message to be unreadable — she wants no one to even know that Alice and Bob are communicating at all. That's a harder problem, and it's what this project solves.

The way it works: Alice takes her message, scrambles it with math so only Bob can unscramble it, then breaks the scrambled message into pieces, hides each piece inside an innocuous-looking meme image or a boring code snippet, and uploads those to public websites (Imgur, GitHub Gist). Bob, who knows where to look and when, downloads those files, extracts the hidden pieces, reassembles them, and reads the message. Anyone watching sees nothing but meme images and GitHub code snippets.

The front-end of the app looks like a meme browser. That's intentional — it's cover. Hidden behind it, accessible only by typing a specific sequence of keys (the Konami code), is the real interface.

---

## The Big Picture: Six Layers

Think of it like an onion. Each layer has one job. The message passes through all of them on the way out, and through all of them in reverse on the way back in.

```
Your message
    ↓
L1: Cryptography      ← scramble it so only Bob can read it
    ↓
L1: Shamir Sharding   ← break it into 5 pieces (any 3 can rebuild it)
    ↓
L3: Cover Traffic     ← add 15 fake pieces so observers can't count
    ↓
L3: AI Routing        ← randomly decide which channel gets which piece
    ↓
L4: Rendezvous        ← agree on a secret "where to look" without talking
    ↓
L2: Steganography     ← hide each piece inside an image or a code file
    ↓
L0: Dead-Drop Upload  ← post to Imgur or GitHub as if it's just a meme
```

Bob does this in reverse: downloads → extracts → reassembles → decrypts → reads.

---

## Layer 0: Dead-Drop Channels

### What is a dead drop?

In spy tradecraft, a "dead drop" is a physical location (a hollow tree, a chalk mark on a mailbox) where spies leave messages for each other without ever meeting in person. They can't be seen together. Kryptos uses the internet as the dead drop: Imgur (an image hosting site) and GitHub Gist (a site for sharing code snippets).

### Why public websites?

Because the goal is deniability. If you upload to a private server, the server itself is evidence that something covert is happening. If you upload to Imgur, you're just one of 100 million people posting memes. You blend in.

### How does Bob know which images to look at?

That's the rendezvous problem, solved in Layer 4. For now, just know that each uploaded file is "tagged" with a secret code that only Alice and Bob know. When Bob searches for images with that tag, only Alice's uploads come up.

**Files:** `src/channels/imgur.js`, `src/channels/gist.js`

---

## Layer 1: Cryptography

This is the heart of the system. Three separate crypto tools work together.

---

### 1a. Key Exchange — X25519 Diffie-Hellman

#### The problem it solves

Alice wants to encrypt a message for Bob. To encrypt, she needs a "key" — a secret number only she and Bob know. But how do they agree on that secret number without anyone intercepting it? If they send the number over the internet, an eavesdropper captures it.

#### The clever solution: Diffie-Hellman

Here's the classic analogy. Imagine paint mixing:

1. Alice and Bob both agree publicly on a base color (say, yellow). This is public — anyone can see it.
2. Alice picks a secret color (red) and mixes it with yellow → she gets orange. She sends orange to Bob.
3. Bob picks a secret color (blue) and mixes it with yellow → he gets green. He sends green to Alice.
4. Alice takes the green she received and mixes in her secret red → she gets a specific brown.
5. Bob takes the orange he received and mixes in his secret blue → he gets the exact same brown.
6. The final brown is their shared secret. An eavesdropper saw yellow, orange, and green — but can't figure out red or blue from those, so they can't get the brown.

Kryptos uses the mathematical version of this called **X25519**, which does the same trick using points on a mathematical curve called **Curve25519** instead of paint colors. The "scalar multiplication" (multiplying a private number by a public point on the curve) is the equivalent of mixing paint — easy to do in one direction, essentially impossible to reverse.

**What "ephemeral keypair" means:** For every single message Alice sends, she generates a brand new random key pair. This means even if someone cracks today's key, they can't read yesterday's messages — each message used a different key. This property is called **forward secrecy**.

**File:** `src/crypto/keyExchange.js`

---

### 1b. Encryption — XSalsa20-Poly1305

#### What is encryption?

Taking your message and scrambling it using a key so that the output looks like random noise. Only someone with the key can unscramble it.

#### What is XSalsa20?

A **stream cipher**. Think of it as a key-operated random number generator. Alice and Bob both run the same generator with the same key — they both produce the exact same "random" stream of bytes. Alice XORs her message with the stream (XOR flips bits: 1 becomes 0, 0 becomes 1) to get ciphertext. Bob XORs the ciphertext with the same stream — the flips cancel out — and gets the original message back.

**What is a nonce?** "Number used once." Before encrypting, Alice generates a random 24-byte number and prepends it to the ciphertext. This ensures that even if Alice sends the same message twice, the ciphertext looks completely different both times. Without this, an attacker could detect repeated messages.

**What is Poly1305?** The "-Poly1305" part is a **Message Authentication Code (MAC)**. Think of it as a tamper-evident seal. It produces a 16-byte fingerprint of the ciphertext using the key. When Bob decrypts, he recomputes the fingerprint and checks it matches. If anything in the ciphertext was changed in transit — even one bit flipped — the fingerprint won't match and decryption fails with an error. This catches both accidental corruption and deliberate tampering.

**The full format of the ciphertext blob:**
```
[24 bytes: nonce] [16 bytes: MAC] [N bytes: actual ciphertext]
```

**File:** `src/crypto/encrypt.js`

---

### 1c. Shamir's Secret Sharing — 3-of-5 Sharding

#### What is secret sharing?

Alice wants to split her encrypted message into 5 pieces such that any 3 pieces can reconstruct it, but any 2 pieces reveal absolutely nothing. This is called a **threshold secret sharing scheme**.

#### The math behind it: polynomial interpolation

Remember from high school: two points uniquely define a straight line (degree-1 polynomial). Three points uniquely define a parabola (degree-2 polynomial). You need exactly N points to reconstruct a degree-(N-1) polynomial.

Shamir's trick: encode the secret as the Y-intercept of a random parabola (degree-2 polynomial). Generate 5 random points on that parabola. Give each party one point. Any 3 parties can reconstruct the unique parabola that passes through their 3 points — and read off the Y-intercept (the secret). Only 2 parties? Infinitely many parabolas pass through 2 points, so you learn nothing.

**In practice (this code):** The polynomial arithmetic happens in a finite field (modular arithmetic) to keep numbers bounded. The 5 resulting "shares" are hex-encoded strings. To detect fake or corrupted shares, each share includes a CRC32 checksum of the original payload — if Shamir reconstruction succeeds but the checksum doesn't match, those shares were fakes.

**Why 3-of-5?** If 2 of the 5 uploads go down (Imgur deletes them, GitHub rate-limits, whatever), Bob can still reconstruct from the surviving 3. Resilience against partial failure.

**File:** `src/crypto/shard.js`

---

### 1d. Integrity Hashing — BLAKE2b-256

#### What is a hash function?

A hash function takes any input (no matter the size) and produces a fixed-length "fingerprint" (digest) of it. The same input always gives the same fingerprint. Changing even one bit of the input gives a completely different fingerprint. And you cannot reverse it — given only the fingerprint, you cannot reconstruct the input.

**BLAKE2b** is a specific hash algorithm. The "256" means the output is 256 bits (32 bytes), represented as a 64-character hex string.

**How it's used here:** After Shamir splitting, Alice computes `BLAKE2b-256(shard)` for each of the 5 real shards. She bundles each shard with its hash as `shard|hash`. When Bob receives a file and extracts the hidden data, he re-computes the hash and checks it matches — this lets him detect corrupted data and, crucially, distinguish real shards from fake ones. (Fake shards have random-looking hashes that won't match the actual content.)

**File:** `src/crypto/integrity.js`

---

## Layer 2: Steganography

### What is steganography?

**Cryptography** hides the *content* of a message (the message exists but is scrambled). **Steganography** hides the *existence* of a message (there's no visible message at all). Kryptos uses both. Encryption protects if the message is found; steganography prevents it from being found.

---

### 2a. LSB Image Steganography

#### How images work

A PNG image is a grid of pixels. Each pixel has a Red, Green, and Blue channel — each an 8-bit number (0–255). A 100×100 image has 10,000 pixels × 3 channels = 30,000 bytes of color data.

#### Hiding data in the least significant bit

The **least significant bit (LSB)** is the rightmost bit of a number. Changing it changes the value by at most 1. For a pixel with Red=200 (binary: `11001000`), flipping the last bit to 1 gives Red=201 (`11001001`). The color change is invisible to the human eye — you'd need precise measurement equipment to detect it.

By replacing the LSB of each R, G, B channel with one bit of our secret data (3 bits per pixel), we can hide data in the image with no visible change. A 100×100 image can hide (30,000 bits / 8 bits per byte) = 3,750 bytes. The first 32 bits encode how long the hidden payload is; the rest is the payload.

An outsider sees a normal meme image. They have no reason to believe it contains anything. Even if they suspect steganography, detecting it statistically requires the original un-modified image for comparison — which they don't have.

**File:** `src/stego/lsb.js`

---

### 2b. Whitespace Steganography

#### The idea

Text files also have an invisible dimension: trailing whitespace. Most editors and viewers strip or ignore trailing spaces and tabs at the end of a line. A space character (0x20) is a 0-bit; a tab character (0x09) is a 1-bit.

Alice takes a code snippet (a GitHub Gist that looks like a normal JavaScript file), and adds a trailing space or tab to each line to encode one bit of data. The file still looks like ordinary code when viewed on GitHub. But after reading the trailing whitespace of each line, you can reconstruct the hidden binary payload.

Same format as LSB: the first 32 bits (32 lines) encode the length of the hidden data; the rest encode the payload.

**File:** `src/stego/whitespace.js`

---

## Layer 3: Routing and Cover Traffic

### Cover traffic: the fake shard problem

Imagine Bob knows that Alice sends exactly 5 files when she sends a message. An adversary watching network traffic sees a burst of exactly 5 uploads and knows to look for them. The solution: Alice always uploads 20 files (5 real + 15 fake). The fakes are structurally identical — same format, same length, random content. The adversary can't tell which 5 are real.

**3:1 ratio:** For every 1 real shard, generate 3 fake shards. 5 real → 15 fake → 20 total uploads.

**How Bob distinguishes real from fake:** He can't tell by looking. But when he tries to do Shamir reconstruction with 3 random shards, if any of them are fake, the CRC32 checksum won't match and the reconstruction throws an error. He just tries all combinations of 3 until one works. The combinatorics are manageable — with 20 items, there are C(20,3) = 1,140 combinations. In the worst case Bob tries all of them, finds the 5 real shards, and reconstructs.

**File:** `src/routing/coverTraffic.js`

### The router: random channel assignment with jitter

Once we have 20 shard packets, we need to decide: which ones go to Imgur, which to GitHub Gist? And when?

Previously this was delegated to an external LLM API (OpenRouter/Gemini), which leaked metadata to a third party. Now it's done locally using Node's `crypto.randomBytes` — a cryptographically secure random number generator built into the OS. Each shard gets a random channel (Imgur or Gist) and a random delay between 500ms and 8,000ms.

**Why the delay?** Without it, all 20 uploads would happen nearly simultaneously — a burst of 20 uploads at 14:35:00 is very different from the background noise of random uploads. Spreading them over up to 8 seconds makes the pattern less distinctive.

**File:** `src/routing/aiRouter.js`

---

## Layer 4: The Rendezvous Protocol

### The coordination problem

Alice uploads 20 files to Imgur and GitHub. Bob needs to know which files are Alice's. He can't search by Alice's name (that links them). He can't use a fixed tag (that's a permanent identifier anyone can monitor).

### The solution: HKDF-style time-based rendezvous

Alice and Bob both know a shared seed (exchanged once, out-of-band, via QR code). From that seed and the current date/hour, they both independently compute the same 32-character hex string called the **rendezvous ID** using this process:

```
prk = BLAKE2b-256(seed)                        ← "extract" phase
rendezvous_id = BLAKE2b-128(date|hour|contactId, key=prk)  ← "expand" phase
```

**HKDF** stands for HMAC-based Key Derivation Function — a standard way to derive cryptographic keys from shared secrets. This is a simplified version using BLAKE2b as the underlying hash.

Alice uploads images with the rendezvous ID as the title. When Bob searches for images with that title, he finds exactly Alice's uploads. An hour later, the rendezvous ID changes (because the hour changed), so old uploads can't be replayed against a new session.

Bob polls not just the current hour's ID, but a ±2-hour window — in case Alice sent a message slightly before or after an hour boundary.

**Per-contact isolation:** The `contactId` is baked into the rendezvous ID derivation. This means Alice's channel with Bob and Alice's channel with Charlie are completely separate. Charlie can't accidentally read Bob's messages even if he knows the seed.

**Files:** `src/rendezvous/hkdf.js`, `src/rendezvous/index.js`

---

## Layer 5: The Frontend — Plausible Deniability

### The cover UI

The app opens as a meme browser. It fetches real memes from meme-api.com and displays them in a grid. This is the "innocent" face of the app — if someone looks over your shoulder or seizes your device, they see a meme browser.

### The Konami code

The Konami code is a cheat code from old video games: ↑ ↑ ↓ ↓ ← → ← → B A. The app listens for this exact sequence of keyboard presses. When detected, it triggers a "glitch" animation and reveals the real Kryptos interface beneath.

**Why this specifically?** It's memorable, it's not discoverable by casual tapping, and it has cultural resonance. Most importantly, it leaves no visible toggle or button that would hint at the hidden interface.

### The real interface

Three panels:
- **Left panel:** Your contacts, rendezvous window countdown, channel status (are Imgur and Gist reachable?)
- **Center panel:** Message thread with the selected contact
- **Right panel:** Contact's cryptographic details — their public key fingerprint, ratchet state, threat model

### Onboarding

First time you open the real interface, a 4-step flow runs:
1. Generate your keypair (or import one)
2. Add a contact (via their public key QR code)
3. Configure your channel credentials (Imgur client ID, GitHub token)
4. You're live

---

## Layer 6: The Full Pipeline — Orchestration

### Send pipeline (`src/core/send.js`)

This is the conductor. When you hit send, here's every step in order:

```
1. Derive static keypair      ← from your seed (deterministic)
2. Generate ephemeral keypair ← fresh random, unique to this message
3. Compute shared secret      ← X25519(ephemeral_priv, bob_static_pub)
4. Encrypt                    ← XSalsa20-Poly1305(message, shared_secret)
5. Prepend ephemeral pub key  ← [32 bytes: ephemeral_pub] + ciphertext
   (Bob needs this to recompute the same shared secret)
6. Shamir split               ← 5 hex shares, any 3 can reconstruct
7. Hash each shard            ← BLAKE2b-256(shard) appended as shard|hash
8. Rendezvous tag             ← getCurrentRendezvousId(seed, contactId)
9. Cover traffic              ← 15 fake shards, same format as real
10. Route + jitter            ← random channel + 500-8000ms delay each
11. Embed + upload            ← LSB into image (Imgur) or whitespace into
                                 code snippet (Gist), then upload
```

Output: a list of upload receipts — which shards went where.

### Receive pipeline (`src/core/receive.js`)

Bob runs this and it's the reverse:

```
1. Generate rendezvous windows  ← current UTC hour ± 2 hours = 5 IDs
2. Poll all channels            ← search Imgur + Gist for each ID
3. Extract stego data           ← LSB extract from images, whitespace
                                   decode from Gist text
4. Parse + integrity check      ← split "shard|hash", verify BLAKE2b
5. Dedup                        ← skip any shard already seen (seenHashes)
6. Brute-force reconstruct      ← try combinations of 3 valid shards until
                                   Shamir succeeds + CRC32 matches
7. Extract ephemeral pub key    ← first 32 bytes of reconstructed payload
8. Derive shared secret         ← X25519(bob_static_priv, ephemeral_pub)
9. Decrypt                      ← XSalsa20-Poly1305 verify + decrypt
10. Advance ratchet             ← derive next session key, save it
```

Output: the plaintext message, or null if nothing valid was found.

---

## The Ratchet — Key Advancement

### The problem

After Bob decrypts a message, both Alice and Bob know the shared secret that was used. If an attacker captures Bob's device tomorrow, they might extract that key and use it to decrypt today's messages that were logged somewhere.

### The solution: one-way key advancement

After each successful decryption, the session key is "advanced" using a one-way hash:

```
next_key = BLAKE2b-256(current_key || "ratchet")
```

The word `"ratchet"` is a **domain separator** — it ensures the output of this operation is different from every other BLAKE2b computation in the system (like the rendezvous ID derivation), even if they share the same input key.

A ratchet in mechanics is a gear that can only turn in one direction. That's exactly what this does to the key: you can go from key N to key N+1, but you cannot go backwards from N+1 to N. BLAKE2b is a one-way function — given the output, you cannot recover the input. So even if an attacker gets key N+1, they can't figure out key N, and can't decrypt older messages that were encrypted with key N.

**File:** `src/ratchet.js`

---

## The Keystore — Identity Persistence

### The old (broken) model

Both Alice and Bob called `deriveKeypairFromSeed(seed)`. Since they share the same seed, they derived **identical** key pairs — including the same private key. This is like a lock and key where the key and the lock are the same object. Anyone with the seed could impersonate either party.

### The new model

Each node generates its keypair **once**, randomly, and stores it. The public key is shared with contacts (out-of-band). The private key never leaves the device.

**Persistence hierarchy:**
1. Check in-process memory cache (fast, survives within a session)
2. Check Redis (survives across restarts)
3. Generate fresh (first run only)

The seed is now only used for the rendezvous ID derivation — it's a shared rendezvous token, not a shared identity token. Your private key is yours alone.

**File:** `src/keystore.js`

---

## The Healthcheck — Knowing If Channels Are Up

### What it does

Before sending, it's useful to know if Imgur and GitHub are reachable. The healthcheck pings both APIs and returns their status.

### The bug that was there (now fixed)

The original code had this catch block:

```js
} catch (_e) {
  // Even a 401 means the service is up
  imgurStatus = 'reachable';   // ← ran on ALL errors, including no internet
}
```

The comment correctly explains that a 401 (Unauthorized) means the server is up — it responded, just refused the request. But the code ran this line even for `ECONNREFUSED` (no server at that address) or timeouts (no internet). So the status would say "reachable" when you had no internet at all.

### The fix

```js
} catch (err) {
  if (err.response) return 'reachable';  // got HTTP response = server is up
  return 'unreachable';                  // no response = server is down
}
```

`err.response` is only set when the server actually responded (even with an error code). Network failures (ECONNREFUSED, ETIMEDOUT, ENOTFOUND) have no response object. Now the distinction is correct.

**File:** `src/healthcheck.js`

---

## Message Deduplication

### The problem

Bob polls for messages every 10 seconds. The rendezvous window covers ±2 hours. Every poll, he downloads all shards in that window and tries to reconstruct. Without deduplication, he'd reconstruct and deliver the same message every 10 seconds, forever.

### The fix: `seenHashes` Set

The caller (the frontend polling loop or the HTTP handler) maintains a `Set` of hash fingerprints of every shard packet it has already processed. On each receive call, after integrity verification passes, the system checks:

```js
const packetHash = BLAKE2b-16(shardStr);
if (seenHashes.has(packetHash)) continue;  // already saw this, skip
seenHashes.add(packetHash);                // new, process it
```

This is passed in as a parameter rather than stored inside `receive.js` because the caller decides the scope — in-memory per session, or persisted to Redis for dedup across restarts.

**File:** `src/core/receive.js`

---

## The Threat Model — What This Protects Against (and What It Doesn't)

### What it protects against

| Threat | Defense |
|---|---|
| Someone reads Alice's messages in transit | XSalsa20-Poly1305 encryption — unreadable without the shared secret |
| Someone replays old messages | Rendezvous ID rotates hourly — old IDs no longer valid |
| Someone captures Bob's device later | Forward secrecy (ephemeral keys) + ratchet — past sessions used different keys |
| Someone monitors Imgur/Gist for patterns | Cover traffic (15 fake shards per 5 real) — can't distinguish real from fake by looking |
| Multiple messages correlated as a conversation | Per-contact rendezvous IDs — each pair has a different channel |
| Someone flips bits in transit | BLAKE2b integrity check — tampered shards are detected and discarded |
| Someone asks "are you using Kryptos?" | Cover UI (meme browser) — deniability; the app looks like something else |

### What it does NOT protect against

| Threat | Why not covered |
|---|---|
| Someone physically watching your screen | That's not a software problem |
| Imgur/GitHub banning your account | Operational security problem, not a crypto problem |
| Someone compromising Alice's device | If the device is owned, the keys are extracted — game over |
| Correlation of upload bursts with known events | The jitter helps, but isn't perfect; multi-session send would help more |
| A sufficiently motivated adversary with access to Imgur's internal databases | They could search all images uploaded in a specific hour, but still can't decrypt |

---

## The Tech Stack at a Glance

| Concern | Tool | Why |
|---|---|---|
| Symmetric encryption | XSalsa20-Poly1305 via libsodium | Battle-tested, provides authentication |
| Key exchange | X25519 via libsodium | Modern elliptic curve, fast, secure |
| Hashing | BLAKE2b via libsodium | Faster than SHA-256, same security |
| Secret sharing | Shamir SSS via secrets.js | Proven library, threshold reconstruction |
| Image steganography | Sharp (image processing) | Fast, supports PNG raw pixel access |
| Routing randomness | Node.js `crypto.randomBytes` | OS-level CSPRNG, no external dependency |
| State persistence | Redis | Fast key-value store, TTL support |
| Backend server | Express.js | Thin HTTP layer, no magic |
| Frontend state | Zustand | Minimal React state manager |
| Frontend build | Vite + React | Fast development iteration |
| Deployment | Docker + Nginx | Isolated containers, production-ready |

---

## Why Each Design Decision Was Made

**"Why Imgur and GitHub Gist specifically?"**
They're massively popular public platforms with open APIs. Your uploads look like normal user activity. They're not your servers — you have no infrastructure to seize or subpoena.

**"Why 3-of-5 Shamir instead of just sending the whole thing?"**
Two reasons. First, resilience: even if 2 of 5 uploads disappear (deleted, rate-limited), Bob can still reconstruct. Second, fragmentation: no single channel ever sees the full message, even in encrypted form.

**"Why fake traffic at 3:1 ratio?"**
A simple statistical calculation: with 5 real and 15 fake, the probability that a random selection of any 3 uploads are all real is C(5,3)/C(20,3) = 10/1140 ≈ 0.9%. An adversary trying random 3-combos is almost certainly trying fake shards.

**"Why rotate rendezvous IDs hourly?"**
Hourly is a balance. Too frequent (per-message) and Bob misses uploads if his clock drifts. Too infrequent (daily) and an old ID is useful to an adversary for longer. One hour with a ±2-hour polling window gives a 5-hour delivery window with automatic key rotation.

**"Why domain-separate the ratchet as `key || 'ratchet'`?"**
BLAKE2b is used in multiple places in this system (rendezvous IDs, integrity hashes, ratchet). If the same input produced the same output in all contexts, an attacker who observed one output might be able to cross-reference contexts. The suffix `'ratchet'` makes the ratchet BLAKE2b output a completely separate domain — even if the input key happened to be used somewhere else, the outputs won't collide.

---

## Glossary

| Term | Plain English definition |
|---|---|
| **Ciphertext** | The scrambled, unreadable version of your message after encryption |
| **Plaintext** | The original readable message, before encryption or after decryption |
| **Key** | A secret number used by an encryption algorithm — like a password for math |
| **Nonce** | "Number used once" — a random value prepended to ciphertext so identical messages encrypt differently |
| **MAC** | Message Authentication Code — a tamper-evident fingerprint that proves data wasn't altered |
| **Shared secret** | A number both Alice and Bob computed independently (via Diffie-Hellman) that no one else knows |
| **Ephemeral** | Something generated fresh for a single use and then discarded |
| **Forward secrecy** | Property where compromising today's key doesn't compromise yesterday's messages |
| **Hash** | A one-way fingerprint of data — deterministic, fixed-length, not reversible |
| **Entropy** | Randomness — high entropy means hard to predict |
| **CSPRNG** | Cryptographically Secure Pseudo-Random Number Generator — random enough for crypto |
| **Steganography** | Hiding the existence of data inside innocent-looking files |
| **Dead drop** | A location where messages are left for pick-up without the parties meeting |
| **Rendezvous** | A pre-agreed meeting point — in this case, a secret tag computed from time and seed |
| **HKDF** | Key Derivation Function — a standard way to derive cryptographic keys from a shared secret |
| **Shamir** | A mathematician (Adi Shamir) who invented the secret-sharing scheme used here |
| **Threshold scheme** | A system where K-of-N participants (any K out of N) can reconstruct the secret |
| **Ratchet** | A one-way key advancement: derive the next key from the current one; can't go backwards |
| **Domain separation** | Adding a context label (like `"ratchet"`) to a hash input to prevent cross-context collisions |
| **Plausible deniability** | The ability to credibly claim the app is something innocent (a meme browser) |
| **CRC32** | A fast checksum (not cryptographically secure, but enough to detect accidental bit-flips and fake shards in Shamir reconstruction) |
| **LSB** | Least Significant Bit — the smallest bit in a number; changing it causes minimal visible change in an image |
| **Finite field** | A set of numbers with defined arithmetic (like a clock — after 12 comes 1) — used in Shamir's polynomial math |
| **Scalar multiplication** | Multiplying a number by a curve point in Diffie-Hellman — easy to compute, essentially impossible to reverse |
