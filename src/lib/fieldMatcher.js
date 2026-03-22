/**
 * Maps normalized field hints to profile keys for autofill.
 */

const FIELD_RULES = [
  { keys: ['email', 'e-mail', 'mail'], profileKey: 'email' },
  { keys: ['phone', 'tel', 'mobile', 'cell'], profileKey: 'phone' },
  { keys: ['firstname', 'first_name', 'given'], profileKey: 'firstName' },
  { keys: ['lastname', 'last_name', 'family', 'surname'], profileKey: 'lastName' },
  { keys: ['full name', 'fullname', 'name'], profileKey: 'fullName' },
  { keys: ['linkedin'], profileKey: 'linkedin' },
  { keys: ['github', 'git hub'], profileKey: 'github' },
  { keys: ['portfolio', 'website', 'personal site', 'url'], profileKey: 'portfolio' },
  { keys: ['address', 'street', 'location'], profileKey: 'address' },
  { keys: ['city', 'town'], profileKey: 'city' },
  { keys: ['country'], profileKey: 'country' },
  { keys: ['state', 'province', 'region'], profileKey: 'state' },
  { keys: ['zip', 'postal', 'postcode'], profileKey: 'zip' },
  { keys: ['company', 'employer', 'current company'], profileKey: 'currentCompany' },
  { keys: ['title', 'job title', 'position'], profileKey: 'jobTitle' },
]

function normalizeText(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[_\-[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectFieldText(el) {
  const parts = []
  if (el.name) parts.push(el.name)
  if (el.id) parts.push(el.id)
  if (el.placeholder) parts.push(el.placeholder)
  if (el.getAttribute('aria-label')) parts.push(el.getAttribute('aria-label'))
  if (el.getAttribute('autocomplete')) parts.push(el.getAttribute('autocomplete'))

  const label = findLabelFor(el)
  if (label) parts.push(label.textContent || '')

  return normalizeText(parts.join(' '))
}

function findLabelFor(el) {
  if (el.id && typeof CSS !== 'undefined' && CSS.escape) {
    try {
      const byFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (byFor) return byFor
    } catch {
      /* ignore */
    }
  }
  let parent = el.parentElement
  for (let i = 0; i < 6 && parent; i++, parent = parent.parentElement) {
    if (parent.tagName === 'LABEL') return parent
    const lab = parent.querySelector?.(':scope > label')
    if (lab) return lab
  }
  return null
}

/** Profile keys we can autofill / learn (excluding id, label, resume). */
export const KNOWN_PROFILE_KEYS = [
  'firstName',
  'lastName',
  'fullName',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'zip',
  'country',
  'linkedin',
  'github',
  'portfolio',
  'currentCompany',
  'jobTitle',
]

export function matchProfileKey(el) {
  const blob = collectFieldText(el)
  if (!blob) return null

  for (const rule of FIELD_RULES) {
    for (const key of rule.keys) {
      if (blob.includes(key)) return rule.profileKey
    }
  }
  return null
}

/**
 * Stable label blob for storing unmapped field answers (customFormAnswers).
 */
export function getFieldStorageKey(el) {
  const blob = collectFieldText(el)
  return blob ? blob.slice(0, 220) : el.name || el.id || 'field'
}

/**
 * Structured metadata for heuristics + Field Understanding Model.
 */
export function getFieldDescriptor(el) {
  const label = findLabelFor(el)
  return {
    tag: el.tagName,
    type: (el.type || '').toLowerCase(),
    name: el.name || '',
    id: el.id || '',
    placeholder: el.placeholder || '',
    ariaLabel: el.getAttribute('aria-label') || '',
    autocomplete: el.getAttribute('autocomplete') || '',
    labelText: (label?.textContent || '').trim().slice(0, 500),
  }
}

/**
 * Heuristic: long text / textarea that looks like an essay question.
 */
export function isLikelyEssayQuestion(el) {
  if (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT') return false
  const type = (el.type || '').toLowerCase()
  if (el.tagName === 'INPUT' && type !== 'text' && type !== 'search') return false

  const blob = collectFieldText(el)
  const essayHints = [
    'why',
    'describe',
    'tell us',
    'cover letter',
    'experience',
    'motivation',
    'yourself',
    'hire you',
    'join',
    'company',
    'additional',
  ]
  return essayHints.some((h) => blob.includes(h)) && blob.length > 15
}
