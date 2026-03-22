import { DEFAULT_PROFILE_ID, STORAGE_KEYS } from './constants.js'

/** @typedef {{ autoLearnFromForms: boolean, useAdvancedFieldModel: boolean }} ExtensionSettings */

export function defaultExtensionSettings() {
  return {
    /** When on, typing in a field and leaving it updates the active profile. */
    autoLearnFromForms: false,
    /**
     * When on, use the built-in Field Understanding Model (scoring + autocomplete mapping)
     * if simple label rules do not match.
     */
    useAdvancedFieldModel: true,
    /** When on, automatically fills fields without clicking the extension. */
    autopilotEnabled: false,
  }
}

/**
 * @param {Record<string, unknown>} r
 * @returns {ExtensionSettings}
 */
export function mergeExtensionSettingsFromStorage(r) {
  const base = defaultExtensionSettings()
  const raw = r[STORAGE_KEYS.extensionSettings]
  if (raw && typeof raw === 'object') {
    const merged = { ...base, ...raw }
    if (raw.useAdvancedFieldModel === undefined && raw.useAiFieldClassification !== undefined) {
      merged.useAdvancedFieldModel = raw.useAiFieldClassification !== false
    }
    return merged
  }
  return base
}

export function createEmptyProfile(id, label) {
  return {
    id: id || DEFAULT_PROFILE_ID,
    label: label || 'Profile',
    firstName: '',
    lastName: '',
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    linkedin: '',
    github: '',
    portfolio: '',
    currentCompany: '',
    jobTitle: '',
    /** Saved paragraphs — used by the built-in model for essay-style questions. */
    bio: '',
    whyCompany: '',
    whyRole: '',
    coverLetter: '',
    /** Extra Q&A keyed by normalized field label (for unclassified fields). */
    customFormAnswers: {},
    /** Base64 data URL or empty — large; Chrome storage quota ~10MB */
    resumeDataUrl: '',
    resumeFileName: 'resume.pdf',
  }
}

function emptyProfile() {
  return createEmptyProfile(DEFAULT_PROFILE_ID, 'Default')
}

/**
 * @returns {Promise<ExtensionSettings>}
 */
export async function getExtensionSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.extensionSettings], (r) => {
      resolve(mergeExtensionSettingsFromStorage(r))
    })
  })
}

export async function saveExtensionSettings(/** @type {ExtensionSettings} */ settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.extensionSettings]: settings }, resolve)
  })
}

/**
 * Merge partial fields into the active profile (used when learning from forms).
 * @param {Record<string, unknown>} patch - known keys and/or customFormAnswers
 */
export async function mergeIntoActiveProfile(patch) {
  const { profiles, activeProfileId } = await getSettings()
  const current = profiles[activeProfileId] || createEmptyProfile(activeProfileId, '')
  const next = { ...current }

  for (const [k, v] of Object.entries(patch)) {
    if (k === 'customFormAnswers' && v && typeof v === 'object') {
      next.customFormAnswers = {
        ...(current.customFormAnswers || {}),
        ...v,
      }
    } else if (k !== 'id' && k !== 'resumeDataUrl' && k !== 'resumeFileName') {
      if (typeof v === 'string' && v.trim()) {
        next[k] = v
      }
    }
  }

  const newProfiles = { ...profiles, [activeProfileId]: next }
  await saveProfiles(newProfiles)
}

export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [STORAGE_KEYS.profiles, STORAGE_KEYS.activeProfileId, STORAGE_KEYS.extensionSettings],
      (r) => {
        const profiles = r[STORAGE_KEYS.profiles]
        const activeProfileId = r[STORAGE_KEYS.activeProfileId] || DEFAULT_PROFILE_ID
        const extensionSettings = mergeExtensionSettingsFromStorage(r)

        if (!profiles || typeof profiles !== 'object') {
          const def = emptyProfile()
          resolve({
            profiles: { [DEFAULT_PROFILE_ID]: def },
            activeProfileId: DEFAULT_PROFILE_ID,
            extensionSettings,
          })
          return
        }
        resolve({ profiles, activeProfileId, extensionSettings })
      },
    )
  })
}

export async function getActiveProfile() {
  const { profiles, activeProfileId } = await getSettings()
  const p = profiles[activeProfileId] || profiles[DEFAULT_PROFILE_ID] || emptyProfile()
  return { ...createEmptyProfile(), ...p, customFormAnswers: { ...(p.customFormAnswers || {}) } }
}

export async function saveProfiles(profiles) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.profiles]: profiles }, resolve)
  })
}

export async function setActiveProfileId(id) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.activeProfileId]: id }, resolve)
  })
}
