/**
 * Proxies tab messaging so injection + sendMessage finish in the service worker.
 * (Running executeScript from the popup can fail: popup closes, or serialized inject func breaks.)
 */

import { BG_MESSAGE } from '../lib/constants.js'

const { FORWARD_TO_TAB } = BG_MESSAGE

chrome.runtime.onInstalled.addListener(() => {})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== FORWARD_TO_TAB) {
    return false
  }

  const tabId = message.tabId
  const payload = message.payload
  if (tabId == null || !payload) {
    sendResponse({ ok: false, error: 'Missing tabId or payload.' })
    return false
  }

  ;(async () => {
    try {
      const result = await forwardToTab(tabId, payload)
      sendResponse({ ok: true, result })
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) })
    }
  })()

  return true
})

async function forwardToTab(tabId, payload) {
  const trySend = () =>
    new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, payload, (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve(res)
      })
    })

  try {
    return await trySend()
  } catch (e) {
    const msg = String(e?.message || e)
    if (!msg.includes('Receiving end') && !msg.includes('Could not establish connection')) {
      throw e
    }
  }

  const manifest = chrome.runtime.getManifest()
  const rel = manifest.content_scripts?.[0]?.js?.[0]
  if (!rel || typeof rel !== 'string') {
    throw new Error('Extension manifest has no content_scripts js path.')
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    args: [rel],
    func: async (relPath) => {
      await import(chrome.runtime.getURL(relPath))
    },
  })

  // Let the module finish registering chrome.runtime.onMessage before retry.
  await new Promise((r) => setTimeout(r, 120))

  return await trySend()
}
