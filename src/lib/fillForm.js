import {
  matchProfileKey,
  isLikelyEssayQuestion,
  getFieldStorageKey,
  getFieldDescriptor,
} from './fieldMatcher.js'
import { classifyFieldDescriptor, pickEssayTemplateForField } from './fieldUnderstandingModel.js'

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

function setSelectValue(select, value) {
  const v = (value || '').trim()
  if (!v) return false
  const opts = Array.from(select.options)
  const exact = opts.find((o) => o.value === v || o.text.trim() === v)
  if (exact) {
    select.value = exact.value
    markFilledByExtension(select)
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }
  const lower = v.toLowerCase()
  const fuzzy = opts.find((o) => o.text.toLowerCase().includes(lower) || lower.includes(o.text.toLowerCase()))
  if (fuzzy) {
    select.value = fuzzy.value
    markFilledByExtension(select)
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }
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

/**
 * @param {object} profile
 * @param {object} [options]
 * @param {boolean} [options.useAdvancedClassify] - use built-in Field Understanding Model when rules miss
 */
export async function fillVisibleFields(profile, options = {}) {
  const useAdvancedClassify = options.useAdvancedClassify !== false

  const filled = []
  const skipped = []

  const inputs = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select',
  )

  for (const el of inputs) {
    if (el.disabled || el.readOnly) continue
    if (el.getAttribute(EXT_MARK) === '1') continue // Skip already filled inputs
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue

    if (el.tagName === 'SELECT') {
      const key = resolveProfileKey(el, useAdvancedClassify)
      if (key && profile[key]) {
        if (setSelectValue(el, String(profile[key]))) filled.push({ tag: 'select', key })
      }
      continue
    }

    const type = (el.type || '').toLowerCase()
    if (type === 'file') {
      skipped.push({ reason: 'file', id: el.id || el.name })
      continue
    }

    const key = resolveProfileKey(el, useAdvancedClassify)
    if (key && profile[key]) {
      setNativeValue(el, String(profile[key]), true)
      filled.push({ tag: el.tagName, type, key })
      continue
    }

    if (isLikelyEssayQuestion(el)) {
      const customKey = getFieldStorageKey(el)
      const saved = profile.customFormAnswers?.[customKey]
      if (saved) {
        setNativeValue(el, String(saved), true)
        filled.push({ tag: el.tagName, type, key: 'custom' })
        continue
      }

      const template = pickEssayTemplateForField(getFieldDescriptor(el), profile)
      if (template) {
        setNativeValue(el, template, true)
        filled.push({ tag: el.tagName, type, key: 'template' })
        continue
      }

      skipped.push({ reason: 'no_template', hint: customKey.slice(0, 80) })
    }
  }

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
