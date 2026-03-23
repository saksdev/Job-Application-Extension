/**
 * Maps normalized field hints to profile keys for autofill.
 */

const FIELD_RULES = [
  { keys: ['email', 'e-mail', 'mail'], profileKey: 'email' },
  // Phone country code comes BEFORE generic phone to avoid false-matching.
  { keys: ['dial code', 'dialing code', 'calling code', 'country code', 'country dial', 'phone code', 'international code'], profileKey: 'phoneCountryCode' },
  { keys: ['phone', 'tel', 'mobile', 'cell', 'whatsapp', 'contact number'], profileKey: 'phone' },
  { keys: ['firstname', 'first_name', 'given name', 'given'], profileKey: 'firstName' },
  { keys: ['lastname', 'last_name', 'family name', 'surname'], profileKey: 'lastName' },
  { keys: ['full name', 'fullname', 'name'], profileKey: 'fullName' },
  { keys: ['linkedin'], profileKey: 'linkedin' },
  { keys: ['github', 'git hub'], profileKey: 'github' },
  { keys: ['portfolio', 'website', 'personal site', 'url'], profileKey: 'portfolio' },
  { keys: ['address', 'street', 'location'], profileKey: 'address' },
  { keys: ['city', 'town'], profileKey: 'city' },
  // country must come before state to avoid 'country' matching 'state'
  { keys: ['country'], profileKey: 'country' },
  { keys: ['state', 'province', 'region'], profileKey: 'state' },
  { keys: ['zip', 'postal', 'postcode', 'pin code'], profileKey: 'zip' },
  { keys: ['company', 'employer', 'organization', 'organisation'], profileKey: 'currentCompany' },
  { keys: ['title', 'job title', 'position', 'role'], profileKey: 'jobTitle' },

  // Work authorization
  { keys: ['authorized to work', 'eligible to work', 'legally authorized', 'work authorization', 'right to work'], profileKey: 'authorizedToWork' },
  { keys: ['require sponsorship', 'need sponsorship', 'visa sponsorship', 'work visa', 'sponsor'], profileKey: 'requireSponsorship' },
  { keys: ['visa type', 'visa status', 'work permit', 'immigration status'], profileKey: 'visaStatus' },

  // Experience & availability
  { keys: ['years of experience', 'total experience', 'years experience', 'work experience', 'experience in years'], profileKey: 'yearsOfExperience' },
  { keys: ['notice period', 'available to start', 'availability', 'when can you start'], profileKey: 'noticePeriod' },

  // Salary
  { keys: ['current salary', 'current ctc', 'current compensation', 'current package'], profileKey: 'currentSalary' },
  { keys: ['expected salary', 'desired salary', 'expected ctc', 'salary expectation', 'expected compensation'], profileKey: 'expectedSalary' },
  { keys: ['salary currency', 'currency'], profileKey: 'salaryCurrency' },

  // Education
  { keys: ['degree', 'education level', 'highest education', 'highest qualification', 'qualification'], profileKey: 'educationLevel' },
  { keys: ['field of study', 'major', 'specialization', 'area of study'], profileKey: 'fieldOfStudy' },
  { keys: ['university', 'college', 'school name', 'institution', 'alma mater'], profileKey: 'university' },
  { keys: ['graduation year', 'year of graduation', 'passing year', 'graduating year'], profileKey: 'graduationYear' },
  { keys: ['gpa', 'cgpa', 'grade point'], profileKey: 'gpa' },

  // Preferences
  { keys: ['willing to relocate', 'open to relocate', 'relocation', 'ready to relocate'], profileKey: 'willingToRelocate' },
  { keys: ['work preference', 'work type', 'work mode', 'work arrangement', 'remote or onsite'], profileKey: 'workPreference' },

  // EEOC / Demographics
  { keys: ['gender', 'sex'], profileKey: 'gender' },
  { keys: ['ethnicity', 'race', 'ethnic background'], profileKey: 'ethnicity' },
  { keys: ['veteran', 'military service', 'armed forces'], profileKey: 'veteranStatus' },
  { keys: ['disability', 'disabled', 'physical disability'], profileKey: 'disabilityStatus' },

  // Source
  { keys: ['how did you hear', 'how did you find', 'referral source', 'where did you hear', 'job source', 'heard about us'], profileKey: 'hearAboutUs' },
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
  'firstName', 'lastName', 'fullName', 'email',
  'phone', 'phoneCountryCode', 'countryCode',
  'address', 'city', 'state', 'zip', 'country',
  'linkedin', 'github', 'portfolio',
  'currentCompany', 'jobTitle',
  'authorizedToWork', 'requireSponsorship', 'visaStatus',
  'yearsOfExperience', 'noticePeriod',
  'currentSalary', 'expectedSalary', 'salaryCurrency',
  'educationLevel', 'fieldOfStudy', 'university', 'graduationYear', 'gpa',
  'willingToRelocate', 'workPreference',
  'gender', 'ethnicity', 'veteranStatus', 'disabilityStatus',
  'hearAboutUs',
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
