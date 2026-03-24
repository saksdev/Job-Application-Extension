/**
 * AI Engine — Cloudflare Workers AI backend.
 *
 * The Cloudflare Worker (worker/index.js) runs Llama 3.1 on Cloudflare's
 * servers for free. Deploy once → all users benefit, no token required.
 *
 * Configure: Options page → 🤖 AI Brain → paste your Worker URL.
 */

/**
 * Call the Cloudflare Worker.
 * @param {string} workerUrl  - e.g. https://job-ai.yourname.workers.dev
 * @param {'classify'|'essay'|'ping'} type
 * @param {object} payload
 * @param {string} [secretKey] - optional x-api-secret header
 */
async function callWorker(workerUrl, type, payload, secretKey) {
  if (!workerUrl) return null
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (secretKey) headers['x-api-secret'] = secretKey
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, payload }),
    })
    if (!res.ok) {
      console.warn(`[AI] Worker error ${res.status}`)
      return null
    }
    const data = await res.json()
    // classify → data.key  |  essay → data.answer  |  ping → data.ok
    return data?.key ?? data?.answer ?? data?.ok ?? null
  } catch (e) {
    console.warn('[AI] Worker request failed:', e?.message)
    return null
  }
}

/** Build a minimal profile safe to send (no resume, no raw answers). */
function safeProfile(profile) {
  const { resumeDataUrl, customFormAnswers, id, ...rest } = profile || {}
  return rest
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ask the AI to classify an unknown form field label.
 * Returns a profile key string (e.g. 'phone') or '' if uncertain.
 */
export async function classifyFieldWithAI(fieldDescriptor, settings) {
  if (!settings?.aiWorkerUrl) return ''
  const hint = [
    fieldDescriptor?.labelText,
    fieldDescriptor?.placeholder,
    fieldDescriptor?.ariaLabel,
    fieldDescriptor?.name,
  ].filter(Boolean).join(' | ').slice(0, 300)
  if (!hint) return ''
  const key = await callWorker(settings.aiWorkerUrl, 'classify', { hint }, settings.aiSecretKey)
  return typeof key === 'string' ? key.trim().split(/\s/)[0] : ''
}

/**
 * Ask the AI to write a personalized essay answer.
 * Returns the answer string or '' on failure.
 */
export async function generateEssayWithAI(questionText, profile, settings) {
  if (!settings?.aiWorkerUrl || !questionText) return ''
  const answer = await callWorker(
    settings.aiWorkerUrl,
    'essay',
    { question: String(questionText).slice(0, 400), profile: safeProfile(profile) },
    settings.aiSecretKey,
  )
  return typeof answer === 'string' ? answer.trim() : ''
}

/**
 * Ping the worker to verify it's online.
 * Returns { ok: boolean, message: string }
 */
export async function testAIConnection(settings) {
  if (!settings?.aiWorkerUrl) {
    return { ok: false, message: 'No Worker URL set. Paste your Cloudflare Worker URL above.' }
  }
  const result = await callWorker(settings.aiWorkerUrl, 'ping', {}, settings.aiSecretKey)
  if (result === true || result === 'true') {
    return { ok: true, message: '✅ Worker is online! AI is ready.' }
  }
  return { ok: false, message: '❌ Worker did not respond. Check the URL and try again.' }
}
