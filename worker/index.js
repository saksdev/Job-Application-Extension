/**
 * Cloudflare Workers AI — Job Autofill Backend
 *
 * Deploy this worker for FREE on Cloudflare:
 *   https://workers.cloudflare.com (free: 100k requests/day + 10k AI/day)
 *
 * Models available (free):
 *   @cf/meta/llama-3.1-8b-instruct  ← fast, great quality
 *   @cf/mistral/mistral-7b-instruct  ← alternative
 *
 * Once deployed you get a URL like:
 *   https://job-autofill-ai.YOUR-NAME.workers.dev
 * Paste that URL in extension Options → AI Settings.
 */

const MODEL = '@cf/meta/llama-3.1-8b-instruct'

// Optional: set a secret key so only your extension can call this worker.
// Set it in Cloudflare dashboard → Worker → Settings → Variables → SECRET_KEY
// Leave blank to allow all requests (fine for personal use).
const REQUIRE_SECRET = false

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse('', 204)
    }

    if (request.method !== 'POST') {
      return corsResponse(JSON.stringify({ error: 'POST only' }), 405)
    }

    // Optional secret check
    if (REQUIRE_SECRET && env.SECRET_KEY) {
      const auth = request.headers.get('x-api-secret') || ''
      if (auth !== env.SECRET_KEY) {
        return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401)
      }
    }

    let body
    try {
      body = await request.json()
    } catch {
      return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400)
    }

    const { type, payload } = body || {}

    // ── Route: classify a form field ──────────────────────────────
    if (type === 'classify') {
      const { hint } = payload || {}
      if (!hint) return corsResponse(JSON.stringify({ key: '' }), 200)

      const messages = [
        {
          role: 'system',
          content: `You are a job application form parser. Given a form field label/hint, output ONLY the matching profile key from this list, or UNKNOWN:
firstName, lastName, fullName, email, phone, phoneCountryCode, address, city, state, zip, country,
linkedin, github, portfolio, currentCompany, jobTitle, yearsOfExperience, noticePeriod,
currentSalary, expectedSalary, educationLevel, fieldOfStudy, university, graduationYear, gpa,
authorizedToWork, requireSponsorship, visaStatus, willingToRelocate, workPreference,
gender, ethnicity, veteranStatus, disabilityStatus, hearAboutUs.
Output ONLY the key name, nothing else. No explanation.`,
        },
        { role: 'user', content: `Field hint: "${String(hint).slice(0, 300)}"` },
      ]

      const ai = await env.AI.run(MODEL, { messages, max_tokens: 30 })
      const key = (ai?.response || '').trim().split(/\s/)[0]
      return corsResponse(JSON.stringify({ key: key === 'UNKNOWN' ? '' : key }), 200)
    }

    // ── Route: generate essay answer ──────────────────────────────
    if (type === 'essay') {
      const { question, profile } = payload || {}
      if (!question) return corsResponse(JSON.stringify({ answer: '' }), 200)

      const profileSummary = [
        (profile?.fullName || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()),
        profile?.jobTitle && `Role: ${profile.jobTitle}`,
        profile?.currentCompany && `Company: ${profile.currentCompany}`,
        profile?.yearsOfExperience && `${profile.yearsOfExperience} years experience`,
        profile?.fieldOfStudy && `Studied: ${profile.fieldOfStudy}`,
        profile?.bio && `Bio: ${String(profile.bio).slice(0, 300)}`,
        profile?.whyRole && `Motivation: ${String(profile.whyRole).slice(0, 200)}`,
      ].filter(Boolean).join('. ')

      const messages = [
        {
          role: 'system',
          content: `You help job applicants fill out application forms. 
Write a professional, concise answer (2-4 sentences, max 120 words) to the question below, 
personalized using the applicant's profile. Be specific, positive, and natural. 
Do NOT add greetings or sign-offs.`,
        },
        {
          role: 'user',
          content: `Applicant: ${profileSummary}\n\nQuestion: "${String(question).slice(0, 400)}"`,
        },
      ]

      const ai = await env.AI.run(MODEL, { messages, max_tokens: 200 })
      return corsResponse(JSON.stringify({ answer: ai?.response?.trim() || '' }), 200)
    }

    // ── Route: health check ───────────────────────────────────────
    if (type === 'ping') {
      return corsResponse(JSON.stringify({ ok: true, model: MODEL }), 200)
    }

    return corsResponse(JSON.stringify({ error: 'Unknown type' }), 400)
  },
}

function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-secret',
    },
  })
}
