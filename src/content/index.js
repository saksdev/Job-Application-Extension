import { detectPlatform } from '../lib/platformDetector.js'
import { fillVisibleFields, tryFillResumeFileInput, collectFormSnapshot } from '../lib/fillForm.js'
import { getActiveProfile, getExtensionSettings, mergeIntoActiveProfile } from '../lib/storage.js'
import { attachFormLearning } from './formLearn.js'

/** Prevents duplicate listeners if the content script file is injected twice. */
const INIT_GUARD = '__JOB_FORM_AUTOFILL_CONTENT_V1'

if (!globalThis[INIT_GUARD]) {
  globalThis[INIT_GUARD] = true

  attachFormLearning()

  // --- AUTOPILOT INITIALIZATION ---
  ;(async () => {
    try {
      const ext = await getExtensionSettings()
      if (ext.autopilotEnabled) {
        let throttleTimer = null
        
        const runAutofill = async () => {
          const profile = await getActiveProfile()
          if (!profile.email && !profile.firstName) return
          const useAdvancedClassify = ext.useAdvancedFieldModel !== false
          const aiSettings = { aiProvider: ext.aiProvider, aiApiKey: ext.aiApiKey, aiModel: ext.aiModel }
          await fillVisibleFields(profile, { useAdvancedClassify, aiSettings })
          tryFillResumeFileInput(profile)
        }

        const observer = new MutationObserver(() => {
          if (throttleTimer) return
          throttleTimer = setTimeout(() => {
            throttleTimer = null
            runAutofill()
          }, 800) // Debounce heavily to prevent freezing
        })

        // Run once on load
        runAutofill()
        
        // Watch for dynamically added form fields
        observer.observe(document.body, { childList: true, subtree: true })
      }
    } catch (e) {
      console.warn("[Autofill] Autopilot initialization failed:", e)
    }
  })()

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_PLATFORM') {
      sendResponse({ platform: detectPlatform() })
      return true
    }

    if (message?.type === 'FILL_FORM') {
      ;(async () => {
        try {
          const profile = await getActiveProfile()
          const ext = await getExtensionSettings()
          const resumeResult = tryFillResumeFileInput(profile)
          const useAdvancedClassify = ext.useAdvancedFieldModel !== false && message.useAdvancedClassify !== false
          const aiSettings = { aiProvider: ext.aiProvider, aiApiKey: ext.aiApiKey, aiModel: ext.aiModel }

          const result = await fillVisibleFields(profile, {
            useAdvancedClassify,
            aiSettings,
          })

          sendResponse({
            ok: true,
            platform: detectPlatform(),
            filled: result.filled,
            skipped: result.skipped,
            resume: resumeResult,
          })
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message || e) })
        }
      })()
      return true
    }

    if (message?.type === 'IMPORT_FORM_TO_PROFILE') {
      ;(async () => {
        try {
          const ext = await getExtensionSettings()
          const useAdvancedClassify = ext.useAdvancedFieldModel !== false

          const rows = await collectFormSnapshot({
            useAdvancedClassify,
          })

          const patch = {}
          const custom = {}

          for (const row of rows) {
            if (row.profileKey) {
              patch[row.profileKey] = row.value
            } else {
              custom[row.storageKey] = row.value
            }
          }

          if (Object.keys(custom).length) {
            patch.customFormAnswers = custom
          }

          if (Object.keys(patch).length) {
            await mergeIntoActiveProfile(patch)
          }

          sendResponse({
            ok: true,
            imported: rows.length,
            platform: detectPlatform(),
          })
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message || e) })
        }
      })()
      return true
    }

    return false
  })
}
