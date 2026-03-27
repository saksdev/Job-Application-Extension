import {
  matchProfileKey,
  isLikelyEssayQuestion,
  getFieldStorageKey,
  getFieldDescriptor,
} from './fieldMatcher.js'
import { classifyFieldDescriptor, pickEssayTemplateForField } from './fieldUnderstandingModel.js'
import { classifyFieldWithAI, generateEssayWithAI } from './aiEngine.js'

const EXT_MARK = 'data-af-ext'

function flashField(el) {
  const originalTransition = el.style.transition || ''
  const originalBoxShadow = el.style.boxShadow || ''
  
  el.style.transition = 'box-shadow 0.2s ease-in-out'
  el.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.4), inset 0 0 0 1px rgba(34, 197, 94, 0.5)'
  
  setTimeout(() => {
    el.style.boxShadow = originalBoxShadow
    setTimeout(() => {
      el.style.transition = originalTransition
    }, 200)
  }, 1200)
}

function markFilledByExtension(el) {
  el.setAttribute(EXT_MARK, '1')
  flashField(el)
}

export function clearExtensionFillMark(el) {
  el.removeAttribute(EXT_MARK)
}

function setNativeValue(el, value, fromExtension) {
  const proto =
    el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) {
    setter.call(el, value)
  } else {
    el.value = value
  }
  if (fromExtension) markFilledByExtension(el)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Advanced select fill — tries multiple strategies in order.
 * 1. Exact value/text match
 * 2. ISO country code (e.g. IN → India options)
 * 3. Case-insensitive substring (profile value is substring of option text)
 * 4. Reverse substring (option text is substring of profile value)
 */
function setSelectValue(select, value, profileKey, profile) {
  const v = (value || '').trim()
  if (!v) return false
  const opts = Array.from(select.options)

  // Strategy 1: exact match (value or visible text)
  let match = opts.find((o) => o.value === v || o.text.trim() === v)
  if (match) { select.value = match.value; markFilledByExtension(select); select.dispatchEvent(new Event('change', { bubbles: true })); return true }

  const vLower = v.toLowerCase()

  // Strategy 2: for country fields, also try the ISO 2-letter code stored in profile.countryCode
  if ((profileKey === 'country' || profileKey === 'countryCode') && profile?.countryCode) {
    const iso = profile.countryCode.toUpperCase()
    match = opts.find((o) => o.value.toUpperCase() === iso || o.text.trim().toUpperCase() === iso)
    if (match) { select.value = match.value; markFilledByExtension(select); select.dispatchEvent(new Event('change', { bubbles: true })); return true }
  }

  // Strategy 3: for phone country code dropdowns (dial-code selects), match "+91", "91", "India"
  if (profileKey === 'phoneCountryCode' && profile?.phoneCountryCode) {
    const code = profile.phoneCountryCode.replace('+', '').trim()  // e.g. '91'
    match = opts.find((o) =>
      o.value.replace('+', '').trim() === code ||
      o.text.replace('+', '').trim().startsWith(code) ||
      o.text.toLowerCase().includes(vLower)
    )
    if (match) { select.value = match.value; markFilledByExtension(select); select.dispatchEvent(new Event('change', { bubbles: true })); return true }
  }

  // Strategy 4: case-insensitive substring
  match = opts.find((o) => o.text.trim().toLowerCase().includes(vLower))
  if (match) { select.value = match.value; markFilledByExtension(select); select.dispatchEvent(new Event('change', { bubbles: true })); return true }

  // Strategy 5: reverse — option text is a substring of our value (e.g. "US" in "United States")
  match = opts.find((o) => vLower.includes(o.text.trim().toLowerCase()) && o.text.trim().length > 1)
  if (match) { select.value = match.value; markFilledByExtension(select); select.dispatchEvent(new Event('change', { bubbles: true })); return true }

  return false
}

function getInputValue(el) {
  if (el.tagName === 'SELECT') return (el.value || '').trim()
  const type = (el.type || '').toLowerCase()
  if (type === 'checkbox' || type === 'radio') return ''
  return (el.value || '').trim()
}

function resolveProfileKey(el, useAdvancedClassify) {
  let key = matchProfileKey(el)
  if (!key && useAdvancedClassify) {
    key = classifyFieldDescriptor(getFieldDescriptor(el))
  }
  return key
}

/** Quick text blob from an input element for heuristic detection. */
function collectFieldHints(el) {
  const parts = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.getAttribute('autocomplete')]
  const label = el.closest('label') || document.querySelector(`label[for="${el.id}"]`)
  if (label) parts.push(label.textContent)
  return parts.filter(Boolean).join(' ').toLowerCase()
}

/**
 * @param {object} profile
 * @param {object} [options]
 * @param {boolean} [options.useAdvancedClassify] - use built-in Field Understanding Model when rules miss
 * @param {object} [options.aiSettings] - { aiProvider, aiApiKey, aiModel } for AI fallback
 */
export async function fillVisibleFields(profile, options = {}) {
  const useAdvancedClassify = options.useAdvancedClassify !== false
  const aiSettings = options.aiSettings || null

  const filled = []
  const skipped = []

  let currentPass = 0

  while (currentPass < 4) {
    currentPass++
    const filledBeforePass = filled.length

    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select',
    )

    // Smart detection: check if there's a dedicated country code field on the page
    const hasSeparateCountryCodeField = Array.from(inputs).some(
      (el) => resolveProfileKey(el, false) === 'phoneCountryCode' || /dial|calling code|country code|international code/.test(collectFieldHints(el))
    )

    for (const el of inputs) {
      if (el.disabled || el.readOnly) continue
      if (el.getAttribute(EXT_MARK) === '1') continue // Skip already filled inputs
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue

    if (el.tagName === 'SELECT') {
      const key = resolveProfileKey(el, useAdvancedClassify)
      if (key && (profile[key] || (key === 'country' && profile.countryCode))) {
        const val = profile[key] || profile.countryCode
        if (setSelectValue(el, String(val), key, profile)) filled.push({ tag: 'select', key })
      }
      continue
    }

    const type = (el.type || '').toLowerCase()
    if (type === 'file') {
      skipped.push({ reason: 'file', id: el.id || el.name })
      continue
    }

    const key = resolveProfileKey(el, useAdvancedClassify)
    if (key) {
      let valueToFill = profile[key] ? String(profile[key]) : null

      if (key === 'phone') {
        const blob = collectFieldHints(el)
        const isDialCodeOnly = /dial|calling code|country code|international code/.test(blob)
        const isSplitNumberField = /without.{0,12}code|number only|local number|exclude.{0,12}code/.test(blob)

        if (isDialCodeOnly && profile.phoneCountryCode) {
          // This field only wants the +XX code
          valueToFill = profile.phoneCountryCode
        } else if ((isSplitNumberField || hasSeparateCountryCodeField) && profile.phone) {
          // This field explicitly wants number WITHOUT code
          valueToFill = profile.phone
        } else if (!isSplitNumberField && !hasSeparateCountryCodeField && profile.phoneCountryCode && profile.phone) {
          // Regular single phone field → combine code + number
          valueToFill = profile.phoneCountryCode + profile.phone
        } else {
          valueToFill = profile.phone || null
        }
      }

      if (key === 'phoneCountryCode' && profile.phoneCountryCode) {
        valueToFill = profile.phoneCountryCode
      }

      if (valueToFill) {
        setNativeValue(el, valueToFill, true)
        filled.push({ tag: el.tagName, type, key })
        continue
      }
    }

    if (isLikelyEssayQuestion(el)) {
      const descriptor = getFieldDescriptor(el)
      const customKey = getFieldStorageKey(el)
      const saved = profile.customFormAnswers?.[customKey]
      if (saved) {
        setNativeValue(el, String(saved), true)
        filled.push({ tag: el.tagName, type, key: 'custom' })
        continue
      }

      const template = pickEssayTemplateForField(descriptor, profile)
      if (template) {
        setNativeValue(el, template, true)
        filled.push({ tag: el.tagName, type, key: 'template' })
        continue
      }

      // 🤖 AI fallback: ask the AI to write a personalized answer
      if (aiSettings && aiSettings.aiWorkerUrl) {
        const questionText = descriptor.labelText || descriptor.placeholder || descriptor.ariaLabel || ''
        if (questionText) {
          const aiAnswer = await generateEssayWithAI(questionText, profile, aiSettings)
          if (aiAnswer) {
            setNativeValue(el, aiAnswer, true)
            filled.push({ tag: el.tagName, type, key: 'ai-essay' })
            continue
          }
        }
      }

      skipped.push({ reason: 'no_template', hint: customKey.slice(0, 80) })
      continue
    }

    // 🤖 AI fallback for completely unrecognized non-essay fields
    if (!isLikelyEssayQuestion(el) && aiSettings && aiSettings.aiWorkerUrl) {
      const descriptor = getFieldDescriptor(el)
      const aiKey = await classifyFieldWithAI(descriptor, aiSettings)
      if (aiKey && profile[aiKey]) {
        setNativeValue(el, String(profile[aiKey]), true)
        filled.push({ tag: el.tagName, type, key: `ai:${aiKey}` })
      }
    }
  } // end for

  const newlyFilledThisPass = filled.length - filledBeforePass
  if (newlyFilledThisPass > 0 && currentPass < 4) {
    // Wait for cascading dropdowns to fetch and render (e.g. Country -> State -> City)
    await new Promise((resolve) => setTimeout(resolve, 800))
  } else {
    break
  }
} // end while

  return { filled, skipped }
}

/**
 * Read visible form controls and resolve profile keys (rules + built-in model).
 */
export async function collectFormSnapshot(options = {}) {
  const useAdvancedClassify = options.useAdvancedClassify !== false

  const rows = []
  const inputs = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select',
  )

  for (const el of inputs) {
    if (el.disabled || el.readOnly) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue

    const type = (el.type || '').toLowerCase()
    if (type === 'file' || type === 'password') continue

    const val = getInputValue(el)
    if (!val) continue

    const profileKey = resolveProfileKey(el, useAdvancedClassify)
    const storageKey = getFieldStorageKey(el)
    rows.push({ el, value: val, profileKey, storageKey })
  }

  return rows
}

/**
 * Programmatically set file input using DataTransfer (Chromium).
 */
export function tryFillResumeFileInput(profile) {
  const dataUrl = profile.resumeDataUrl
  if (!dataUrl || !dataUrl.startsWith('data:')) return { ok: false, reason: 'no_resume' }

  const inputs = document.querySelectorAll('input[type="file"]')
  let count = 0
  for (const input of inputs) {
    if (input.disabled) continue
    const accept = (input.accept || '').toLowerCase()
    if (accept && !accept.includes('pdf') && !accept.includes('application')) continue

    const mime = 'application/pdf'
    const name = profile.resumeFileName || 'resume.pdf'
    try {
      const res = dataURLtoBlob(dataUrl)
      const file = new File([res.blob], name, { type: res.mime || mime })
      const dt = new DataTransfer()
      dt.items.add(file)
      input.files = dt.files
      markFilledByExtension(input)
      input.dispatchEvent(new Event('change', { bubbles: true }))
      input.dispatchEvent(new Event('input', { bubbles: true }))
      count++
    } catch {
      // ignore per input
    }
  }
  return { ok: count > 0, count }
}

function dataURLtoBlob(dataUrl) {
  const parts = dataUrl.split(',')
  const header = parts[0]
  const base64 = parts.slice(1).join(',')
  const mimeMatch = /data:([^;]+)/.exec(header)
  const mime = mimeMatch ? mimeMatch[1] : 'application/pdf'
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return { blob: new Blob([bytes], { type: mime }), mime }
}
