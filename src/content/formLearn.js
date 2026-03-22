import { mergeIntoActiveProfile, getExtensionSettings } from '../lib/storage.js'
import { matchProfileKey, getFieldDescriptor, getFieldStorageKey } from '../lib/fieldMatcher.js'
import { classifyFieldDescriptor } from '../lib/fieldUnderstandingModel.js'
import { clearExtensionFillMark } from '../lib/fillForm.js'

let behaviorCache = null
let behaviorCacheAt = 0
const CACHE_MS = 2000

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.extensionSettings) {
    behaviorCache = null
  }
})

async function getBehaviorCached() {
  const now = Date.now()
  if (behaviorCache && now - behaviorCacheAt < CACHE_MS) return behaviorCache
  behaviorCache = await getExtensionSettings()
  behaviorCacheAt = now
  return behaviorCache
}

/**
 * Saves a single field value into the active profile after the user edits the page.
 */
async function learnFromElement(el) {
  const behavior = await getBehaviorCached()
  if (!behavior.autoLearnFromForms) return

  if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return

  const type = (el.type || '').toLowerCase()
  if (
    type === 'checkbox' ||
    type === 'radio' ||
    type === 'file' ||
    type === 'password' ||
    type === 'hidden' ||
    type === 'submit' ||
    type === 'button'
  ) {
    return
  }

  if (el.disabled || el.readOnly) return

  if (el.hasAttribute('data-af-ext')) {
    clearExtensionFillMark(el)
    return
  }

  const value = (el.value || '').trim()
  if (!value) return

  let key = matchProfileKey(el)
  if (!key && behavior.useAdvancedFieldModel) {
    key = classifyFieldDescriptor(getFieldDescriptor(el))
  }

  if (key) {
    await mergeIntoActiveProfile({ [key]: value })
    return
  }

  const labelKey = getFieldStorageKey(el)
  await mergeIntoActiveProfile({
    customFormAnswers: { [labelKey]: value },
  })
}

let blurTimer = null

export function attachFormLearning() {
  document.addEventListener(
    'focusout',
    (ev) => {
      const el = ev.target
      if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT')) return

      if (blurTimer) clearTimeout(blurTimer)
      blurTimer = setTimeout(() => {
        blurTimer = null
        learnFromElement(el).catch(() => {})
      }, 400)
    },
    true,
  )
}
