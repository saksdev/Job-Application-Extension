import { useCallback, useEffect, useState } from 'react'
import { sendToActiveTab } from '../lib/tabMessaging.js'

function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage()
  } else {
    window.open(chrome.runtime.getURL('src/options/index.html'))
  }
}

export default function App() {
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    sendToActiveTab({ type: 'GET_PLATFORM' })
      .then((res) => setPlatform(res?.platform || 'custom'))
      .catch(() => setPlatform('—'))
  }, [])

  const onImport = useCallback(async () => {
    setImporting(true)
    setStatus('')
    try {
      const res = await sendToActiveTab({ type: 'IMPORT_FORM_TO_PROFILE' })
      if (!res?.ok) {
        setStatus(res?.error || 'Import failed.')
        return
      }
      setStatus(`Saved ${res.imported ?? 0} non-empty field(s) from this page into your active profile.`)
    } catch (e) {
      setStatus(String(e?.message || e))
    } finally {
      setImporting(false)
    }
  }, [])

  const onFill = useCallback(async () => {
    setLoading(true)
    setStatus('')
    try {
      const res = await sendToActiveTab({ type: 'FILL_FORM', useAdvancedClassify: true })
      if (!res?.ok) {
        setStatus(res?.error || 'Fill failed.')
        return
      }
      const n = res.filled?.length ?? 0
      const resume = res.resume?.ok ? ` Resume uploaded (${res.resume.count} field(s)).` : ''
      setStatus(`Filled ${n} field(s) on ${res.platform}.${resume}`)
    } catch (e) {
      setStatus(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="popup">
      <header className="popup__head">
        <h1>Job form auto-fill</h1>
        <p className="popup__sub">Built-in field model · local profile</p>
      </header>
      <p className="popup__meta">
        Detected portal: <strong>{platform || '…'}</strong>
      </p>
      <button type="button" className="btn btn--primary" disabled={loading || importing} onClick={onFill}>
        {loading ? 'Filling…' : 'Auto Fill Form'}
      </button>
      <button type="button" className="btn btn--ghost" disabled={loading || importing} onClick={onImport}>
        {importing ? 'Saving…' : 'Save page form to profile'}
      </button>
      <button type="button" className="btn btn--ghost" onClick={openOptions}>
        Profiles &amp; paragraphs
      </button>
      {status ? <p className="popup__status">{status}</p> : null}
    </div>
  )
}
