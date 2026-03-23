/**
 * Sends messages to the active tab's content script via the background service worker.
 * Injection + retry run in the service worker so the popup can close without killing the flow,
 * and the loader path is passed as args (reliable serialization).
 */

import { BG_MESSAGE } from './constants.js'

const { FORWARD_TO_TAB } = BG_MESSAGE

function isAllowedPage(url) {
  return /^https?:\/\//i.test(url || '') || /^file:\/\//i.test(url || '')
}

/**
 * @param {object} message
 * @returns {Promise<unknown>}
 */
export async function sendToActiveTab(message) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (!tab?.id) {
    throw new Error('No active tab.')
  }

  const url = tab.url || ''
  if (!isAllowedPage(url)) {
    throw new Error(
      'Cannot run on this page type. Supported: http://, https://, file://. For local files, go to chrome://extensions and enable "Allow access to file URLs" for this extension.',
    )
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: FORWARD_TO_TAB, tabId: tab.id, payload: message },
      (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (!res?.ok) {
          const err = res?.error || 'Message to tab failed.'
          reject(
            new Error(
              `${err} — Reload the extension on chrome://extensions, then refresh this page (F5).`,
            ),
          )
          return
        }
        resolve(res.result)
      },
    )
  })
}
