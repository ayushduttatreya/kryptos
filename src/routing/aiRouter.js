const axios = require('axios');

/**
 * @module aiRouter
 * @description OpenRouter-based AI shard routing engine (L3).
 * Delegates channel assignment to a lightweight LLM to maximise deniability.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-flash-1.5';

/**
 * Ask the AI router to assign each shard to the optimal dead-drop channel.
 *
 * System prompt enforces JSON-only output. The model receives:
 *   - an array of shard metadata (size, urgency)
 *   - channel status (load, latency, quota)
 *
 * @param {Array<Object>} shards        - Array of shard objects, each with { id, size, urgency }.
 * @param {Object} channelStatus        - { imgur: { load, latency }, gist: { load, latency } }.
 * @param {string} apiKey               - OpenRouter API key (from env).
 * @param {string} [model]              - Model identifier, defaults to google/gemini-flash-1.5.
 * @returns {Promise<Array<Object>>}      - [{ shardId, channel, delayMs }].
 * @throws {Error} If the AI returns unparseable JSON.
 */
async function route(shards, channelStatus, apiKey, model = DEFAULT_MODEL) {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required');
  }
  if (!Array.isArray(shards) || shards.length === 0) {
    throw new Error('Shards array must be non-empty');
  }

  const systemPrompt =
    'You are a covert shard routing engine. You will receive channel status and shard metadata. ' +
    'Your job is to assign each shard to the optimal dead drop channel to maximize deniability ' +
    'and minimize traffic correlation. Return ONLY a JSON array, no explanation, no markdown. ' +
    'Each element must have keys: shardId (string or number), channel ("imgur" or "gist"), delayMs (number).';

  const userContent = JSON.stringify({
    shards: shards.map((s) => ({
      shardId: s.id ?? s.shardId ?? 'unknown',
      size: s.size ?? 0,
      urgency: s.urgency ?? false,
    })),
    channels: channelStatus,
  });

  const resp = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }
  );

  const rawContent = resp.data?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('OpenRouter returned empty response');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    // Some models wrap JSON in markdown fences; strip them
    const cleaned = rawContent
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '');
    parsed = JSON.parse(cleaned);
  }

  // Normalise: OpenRouter may return either an array directly or { assignments: [...] }
  const assignments = Array.isArray(parsed) ? parsed : parsed.assignments ?? parsed.results ?? Object.values(parsed)[0];
  if (!Array.isArray(assignments)) {
    throw new Error('AI response did not contain a valid array');
  }

  return assignments.map((a) => ({
    shardId: String(a.shardId ?? a.id ?? a.shard_id ?? 'unknown'),
    channel: a.channel,
    delayMs: Number(a.delayMs ?? a.delay_ms ?? a.delay ?? 0),
  }));
}

module.exports = { route };
