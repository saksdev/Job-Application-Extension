/**
 * Built-in "Field Understanding Model" — pure logic you own and can extend.
 * Analyzes field metadata (labels, name, id, autocomplete, type) and decides
 * which profile key fits, or which saved essay template to use.
 * No external AI / Ollama / OpenAI required.
 */

import { KNOWN_PROFILE_KEYS } from './fieldMatcher.js'

/** Minimum score to accept a structural field match (tune in one place). */
const STRUCT_THRESHOLD = 6

/** HTML autocomplete token → profile key (see MDN autocomplete). */
const AUTOCOMPLETE_TO_KEY = {
  email: 'email',
  tel: 'phone',
  'given-name': 'firstName',
  'family-name': 'lastName',
  name: 'fullName',
  'street-address': 'address',
  'address-line1': 'address',
  'address-line2': 'address',
  'address-level2': 'city',
  'address-level1': 'state',
  country: 'country',
  'country-name': 'country',
  'postal-code': 'zip',
  organization: 'currentCompany',
  'organization-title': 'jobTitle',
  url: 'portfolio',
  photo: 'portfolio',
}

/** Weighted substrings per profile key (blob is lowercased). */
const KEY_PATTERNS = {
  email: ['email', 'e-mail', 'e mail', 'mail address', 'work email', 'primary email'],
  phone: ['phone', 'telephone', 'mobile', 'cell', 'whatsapp', 'contact number'],
  firstName: ['first name', 'firstname', 'given name', 'forename'],
  lastName: ['last name', 'lastname', 'surname', 'family name'],
  fullName: ['full name', 'legal name', 'complete name', 'your name', 'candidate name', 'applicant name'],
  linkedin: ['linkedin', 'linked in'],
  github: ['github', 'git hub'],
  portfolio: ['portfolio', 'personal website', 'website url', 'your website', 'homepage'],
  address: ['street address', 'mailing address', 'address line', 'street', 'location'],
  city: ['city', 'town', 'municipality'],
  state: ['state', 'province', 'region', 'county'],
  zip: ['zip', 'postal', 'postcode', 'pin code'],
  country: ['country', 'nation'],
  currentCompany: ['current employer', 'current company', 'employer', 'company name', 'organization'],
  jobTitle: ['job title', 'position', 'role', 'current title'],
}

function normalizeBlob(d) {
  const parts = [
    d.name,
    d.id,
    d.placeholder,
    d.ariaLabel,
    d.labelText,
    d.autocomplete,
  ]
  return parts
    .join(' ')
    .toLowerCase()
    .replace(/[_\-[\]/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Score how well `descriptor` matches a single profile key.
 * @param {object} descriptor - output of getFieldDescriptor(el)
 */
function scoreKey(key, descriptor, blob) {
  let score = 0
  const type = (descriptor.type || '').toLowerCase()
  const acRaw = (descriptor.autocomplete || '').toLowerCase().trim()

  for (const token of acRaw.split(/\s+/).filter(Boolean)) {
    const mapped = AUTOCOMPLETE_TO_KEY[token]
    if (mapped === key) score += 14
  }
  if (acRaw && AUTOCOMPLETE_TO_KEY[acRaw] === key) score += 16

  if (type === 'email' && key === 'email') score += 18
  if (type === 'tel' && key === 'phone') score += 14
  if (type === 'url' && (key === 'portfolio' || key === 'linkedin' || key === 'github')) score += 6

  const patterns = KEY_PATTERNS[key] || []
  for (const p of patterns) {
    if (blob.includes(p)) score += Math.min(6, 2 + Math.floor(p.length / 4))
  }

  return score
}

/**
 * Best matching profile key for contact / structured fields, or null.
 * @param {object} descriptor - from getFieldDescriptor(el)
 * @returns {string | null}
 */
export function classifyFieldDescriptor(descriptor) {
  const blob = normalizeBlob(descriptor)
  if (!blob) return null

  let bestKey = null
  let best = 0

  for (const key of KNOWN_PROFILE_KEYS) {
    const s = scoreKey(key, descriptor, blob)
    if (s > best) {
      best = s
      bestKey = key
    }
  }

  if (best >= STRUCT_THRESHOLD && bestKey) return bestKey
  return null
}

/**
 * Essay / long-text templates (saved in profile). Order = most specific first.
 */
const ESSAY_TEMPLATE_RULES = [
  {
    profileKey: 'whyCompany',
    keywords: [
      'why do you want to join',
      'why this company',
      'why are you interested',
      'interest in our company',
      'why apply',
    ],
  },
  {
    profileKey: 'whyRole',
    keywords: [
      'why should we hire',
      'why you',
      'what makes you',
      'why are you a good fit',
      'relevant skills',
    ],
  },
  {
    profileKey: 'coverLetter',
    keywords: ['cover letter', 'letter of motivation', 'motivation letter'],
  },
  {
    profileKey: 'bio',
    keywords: [
      'describe your experience',
      'tell us about yourself',
      'about yourself',
      'relevant experience',
      'background',
      'professional summary',
      'additional comments',
      'anything else',
    ],
  },
]

/**
 * Pick saved paragraph text for an essay-like field using rules + fallbacks.
 * @param {object} descriptor
 * @param {object} profile
 * @returns {string}
 */
export function pickEssayTemplateForField(descriptor, profile) {
  const blob = normalizeBlob(descriptor)
  if (!blob) return ''

  for (const rule of ESSAY_TEMPLATE_RULES) {
    if (!rule.keywords.some((kw) => blob.includes(kw))) continue
    const v = profile[rule.profileKey]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }

  if (profile.bio?.trim()) return profile.bio.trim()
  if (profile.coverLetter?.trim()) return profile.coverLetter.trim()
  if (profile.whyCompany?.trim()) return profile.whyCompany.trim()
  if (profile.whyRole?.trim()) return profile.whyRole.trim()

  return ''
}

/**
 * Human-readable summary for debugging / future UI.
 */
export function explainFieldMatch(descriptor) {
  const key = classifyFieldDescriptor(descriptor)
  const blob = normalizeBlob(descriptor)
  return { key, blobPreview: blob.slice(0, 120) }
}
