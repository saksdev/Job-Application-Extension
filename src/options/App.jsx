import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getSettings,
  saveProfiles,
  setActiveProfileId,
  saveExtensionSettings,
  defaultExtensionSettings,
  createEmptyProfile,
} from '../lib/storage.js'
import { DEFAULT_PROFILE_ID } from '../lib/constants.js'
import { testAIConnection, AI_PROVIDERS } from '../lib/aiEngine.js'

const FIELDS = [
  { key: 'label',             label: 'Profile name' },
  { key: 'firstName',         label: 'First name' },
  { key: 'lastName',          label: 'Last name' },
  { key: 'fullName',          label: 'Full name' },
  { key: 'email',             label: 'Email' },
  { key: 'phone',             label: 'Phone number only — no country code (e.g. 9876543210)' },
  { key: 'phoneCountryCode',  label: 'Country dial code (e.g. +91, +1, +44)' },
  { key: 'address',           label: 'Street address' },
  { key: 'city',              label: 'City' },
  { key: 'state',             label: 'State / Province' },
  { key: 'zip',               label: 'ZIP / Postal' },
  { key: 'country',           label: 'Country (full name, e.g. India)' },
  { key: 'countryCode',       label: 'Country ISO code (e.g. IN, US, GB)' },
  { key: 'linkedin',          label: 'LinkedIn URL' },
  { key: 'github',            label: 'GitHub URL' },
  { key: 'portfolio',         label: 'Portfolio URL' },
  { key: 'currentCompany',    label: 'Current company' },
  { key: 'jobTitle',          label: 'Current job title' },
  { key: 'yearsOfExperience', label: 'Years of experience (e.g. 3)' },
  { key: 'noticePeriod',      label: 'Notice period (e.g. Immediately, 30 days)' },
  { key: 'currentSalary',     label: 'Current salary / CTC (number)' },
  { key: 'expectedSalary',    label: 'Expected salary / CTC (number)' },
  { key: 'salaryCurrency',    label: 'Salary currency (e.g. INR, USD)' },
  { key: 'educationLevel',    label: "Degree (e.g. Bachelor's, Master's, PhD)" },
  { key: 'fieldOfStudy',      label: 'Field of study / Major' },
  { key: 'university',        label: 'University / College' },
  { key: 'graduationYear',    label: 'Graduation year (e.g. 2022)' },
  { key: 'gpa',               label: 'GPA / CGPA (e.g. 8.5)' },
  { key: 'authorizedToWork',  label: 'Authorized to work? (Yes / No)' },
  { key: 'requireSponsorship',label: 'Need visa sponsorship? (Yes / No)' },
  { key: 'visaStatus',        label: 'Visa type (e.g. H1B, Citizen, OPT)' },
  { key: 'willingToRelocate', label: 'Willing to relocate? (Yes / No)' },
  { key: 'workPreference',    label: 'Work preference (Remote / Hybrid / On-site)' },
  { key: 'hearAboutUs',       label: 'How did you hear about us? (e.g. LinkedIn)' },
  { key: 'gender',            label: 'Gender (e.g. Prefer not to say)' },
  { key: 'ethnicity',         label: 'Ethnicity (e.g. Asian, Prefer not to say)' },
  { key: 'veteranStatus',     label: 'Veteran status (e.g. I am not a protected veteran)' },
  { key: 'disabilityStatus',  label: 'Disability (e.g. No, I do not have a disability)' },
]

/** Long text — filled by the built-in Field Understanding Model when questions match. */
const PARAGRAPH_FIELDS = [
  { key: 'whyCompany', label: 'Why this company' },
  { key: 'whyRole', label: 'Why this role / why hire you' },
  { key: 'coverLetter', label: 'Cover letter (default)' },
  { key: 'bio', label: 'Bio / experience summary' },
]

export default function App() {
  const [profiles, setProfiles] = useState({})
  const [activeId, setActiveId] = useState(DEFAULT_PROFILE_ID)
  const [ext, setExt] = useState(() => defaultExtensionSettings())
  const [savedMsg, setSavedMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')
  const [aiTestStatus, setAiTestStatus] = useState('')

  useEffect(() => {
    ;(async () => {
      const s = await getSettings()
      setProfiles(s.profiles)
      setActiveId(s.activeProfileId)
      setExt(s.extensionSettings || defaultExtensionSettings())
      setLoading(false)
    })()
  }, [])

  const current = useMemo(() => profiles[activeId] || createEmptyProfile(activeId, 'Profile'), [profiles, activeId])

  const updateField = useCallback(
    (key, value) => {
      setProfiles((prev) => ({
        ...prev,
        [activeId]: { ...prev[activeId], [key]: value },
      }))
    },
    [activeId],
  )

  const updateExt = useCallback((patch) => {
    setExt((prev) => ({ ...prev, ...patch }))
  }, [])

  /** Update a single key in customFormAnswers */
  const updateCustomField = useCallback((fieldKey, value) => {
    setProfiles((prev) => ({
      ...prev,
      [activeId]: {
        ...prev[activeId],
        customFormAnswers: { ...(prev[activeId]?.customFormAnswers || {}), [fieldKey]: value },
      },
    }))
  }, [activeId])

  /** Delete a custom field */
  const deleteCustomField = useCallback((fieldKey) => {
    setProfiles((prev) => {
      const next = { ...prev[activeId]?.customFormAnswers }
      delete next[fieldKey]
      return { ...prev, [activeId]: { ...prev[activeId], customFormAnswers: next } }
    })
  }, [activeId])

  /** Add a new custom field manually */
  const addCustomField = useCallback(() => {
    const label = newFieldLabel.trim()
    if (!label) return
    const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    updateCustomField(key, newFieldValue.trim())
    setNewFieldLabel('')
    setNewFieldValue('')
  }, [newFieldLabel, newFieldValue, updateCustomField])

  const persist = useCallback(async () => {
    await saveProfiles(profiles)
    await setActiveProfileId(activeId)
    await saveExtensionSettings(ext)
    setSavedMsg('Saved.')
    setTimeout(() => setSavedMsg(''), 2000)
  }, [profiles, activeId, ext])

  const addProfile = useCallback(() => {
    const id = crypto.randomUUID()
    const base = profiles[activeId] || createEmptyProfile(DEFAULT_PROFILE_ID, 'Default')
    const copy = {
      ...createEmptyProfile(id, 'New profile'),
      ...base,
      id,
      label: 'New profile',
      resumeDataUrl: base.resumeDataUrl,
      resumeFileName: base.resumeFileName,
      customFormAnswers: { ...(base.customFormAnswers || {}) },
    }
    setProfiles((prev) => ({ ...prev, [id]: copy }))
    setActiveId(id)
  }, [profiles, activeId])

  const removeProfile = useCallback(() => {
    const ids = Object.keys(profiles)
    if (ids.length <= 1) return
    setProfiles((prev) => {
      const next = { ...prev }
      delete next[activeId]
      return next
    })
    const remaining = ids.filter((x) => x !== activeId)
    setActiveId(remaining[0] || DEFAULT_PROFILE_ID)
  }, [profiles, activeId])

  const testAI = useCallback(async () => {
    setAiTestStatus('Testing…')
    try {
      const result = await testAIConnection({ aiProvider: ext.aiProvider, aiApiKey: ext.aiApiKey, aiModel: ext.aiModel })
      setAiTestStatus(result.ok ? `✅ Connected! Response: "${result.response}"` : `❌ Failed. Got: "${result.response || 'no response'}"` )
    } catch (e) {
      setAiTestStatus(`❌ Error: ${e.message}`)
    }
  }, [ext.aiProvider, ext.aiApiKey, ext.aiModel])

  const onResume = useCallback(
    (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        updateField('resumeDataUrl', reader.result)
        updateField('resumeFileName', file.name)
      }
      reader.readAsDataURL(file)
    },
    [updateField],
  )

  if (loading) {
    return <div className="page">Loading…</div>
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1>Job form auto-fill</h1>
        <p>
          Data stays in this browser. The extension uses a <strong>built-in Field Understanding Model</strong> (rules +
          scoring + HTML autocomplete) to decide what each field is, then fills from your profile. No external AI
          service is required. Save paragraphs below for long questions; edit <code>src/lib/fieldUnderstandingModel.js</code>{' '}
          to tune matching.
        </p>
      </header>

      <section className="card">
        <h2>Automation</h2>
        <label className="field field--row">
          <input
            type="checkbox"
            checked={ext.autopilotEnabled || false}
            onChange={(e) => updateExt({ autopilotEnabled: e.target.checked })}
          />
          <span>
            <strong>Zero-Click Autopilot</strong>: Automatically watch the page and fill recognized job application fields the moment they appear (great for Workday multi-step forms).
          </span>
        </label>
      </section>

      {/* ── AI SETTINGS ──────────────────────────────────── */}
      <section className="card">
        <h2>🤖 AI Brain</h2>
        <p className="hint" style={{marginBottom:'14px'}}>
          AI writes personalized essay answers and classifies unknown fields.
          <strong> Cloudflare Worker is recommended</strong> — free, no user token needed.
        </p>

        {/* Cloudflare Worker (recommended) */}
        <div style={{padding:'14px', background:'#f0fdf4', borderRadius:'10px', border:'1.5px solid #86efac', marginBottom:'14px'}}>
          <div style={{fontWeight:700, marginBottom:'6px'}}>⭐ Cloudflare Workers AI
            <span style={{fontSize:'0.75rem', background:'#dcfce7', color:'#166534', padding:'1px 8px', borderRadius:'999px', marginLeft:'8px'}}>Recommended — Free</span>
          </div>
          <p className="hint" style={{marginBottom:'10px'}}>Deploy a free worker on Cloudflare (Llama 3.1). Users need nothing — just paste the URL.</p>
          <label className="field" style={{marginBottom:'8px'}}>
            <span>Your Worker URL</span>
            <input
              value={ext.aiWorkerUrl || ''}
              onChange={(e) => updateExt({ aiWorkerUrl: e.target.value, aiProvider: e.target.value ? 'cloudflare' : '' })}
              placeholder="https://job-autofill-ai.yourname.workers.dev"
            />
          </label>
          <label className="field" style={{marginBottom:'10px'}}>
            <span>Worker secret key (optional)</span>
            <input type="password" value={ext.aiSecretKey || ''}
              onChange={(e) => updateExt({ aiSecretKey: e.target.value })}
              placeholder="Leave blank if none" />
          </label>
          {ext.aiWorkerUrl && (
            <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
              <button type="button" className="btn btn--secondary" onClick={testAI}>Test Worker</button>
              {aiTestStatus && <span className="hint" style={{fontSize:'0.85rem'}}>{aiTestStatus}</span>}
            </div>
          )}
        </div>

        {/* Token-based fallback */}
        <details>
          <summary style={{cursor:'pointer',fontWeight:600,fontSize:'0.875rem',color:'#475569',padding:'4px 0'}}>
            Or use your own API token (GitHub Models / HuggingFace)
          </summary>
          <div style={{marginTop:'10px'}}>
            <label className="field" style={{marginBottom:'10px'}}>
              <span>Provider</span>
              <select value={['github','huggingface'].includes(ext.aiProvider) ? ext.aiProvider : ''}
                onChange={(e) => updateExt({ aiProvider: e.target.value || 'cloudflare' })}>
                <option value="">-- Select --</option>
                <option value="github">⭐ GitHub Models (free with GitHub account)</option>
                <option value="huggingface">🤗 HuggingFace (free tier)</option>
              </select>
            </label>
            {['github','huggingface'].includes(ext.aiProvider) && (
              <>
                <label className="field" style={{marginBottom:'8px'}}>
                  <span>API Key / Token</span>
                  <input type="password" value={ext.aiApiKey || ''}
                    onChange={(e) => updateExt({ aiApiKey: e.target.value })}
                    placeholder="Paste token here" />
                </label>
                <label className="field" style={{marginBottom:'10px'}}>
                  <span>Model (optional)</span>
                  <input value={ext.aiModel || ''}
                    onChange={(e) => updateExt({ aiModel: e.target.value })}
                    placeholder={AI_PROVIDERS[ext.aiProvider]?.defaultModel || ''} />
                </label>
                <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                  <button type="button" className="btn btn--secondary" onClick={testAI}>Test</button>
                  {aiTestStatus && <span className="hint">{aiTestStatus}</span>}
                </div>
              </>
            )}
          </div>
        </details>
      </section>
            <option value="">— Disabled (use rule-based only) —</option>
            <option value="github">⭐ GitHub Models (free with GitHub account) — Llama 3.1 70B, Phi-3, Mistral</option>
            <option value="huggingface">🤗 HuggingFace Inference API (free tier)</option>
          </select>
        </label>

        {ext.aiProvider === 'github' && (
          <p className="hint" style={{marginBottom:'10px', padding:'8px 12px', background:'#f0f9ff', borderRadius:'8px', borderLeft:'3px solid #0ea5e9'}}>
            <strong>How to get your GitHub token (2 min):</strong><br/>
            1. Go to <strong>github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained</strong><br/>
            2. Create a new token — no special permissions needed<br/>
            3. Copy and paste below
          </p>
        )}
        {ext.aiProvider === 'huggingface' && (
          <p className="hint" style={{marginBottom:'10px', padding:'8px 12px', background:'#fdf4ff', borderRadius:'8px', borderLeft:'3px solid #a855f7'}}>
            <strong>How to get your HuggingFace token:</strong><br/>
            1. Go to <strong>huggingface.co → Settings → Access Tokens</strong><br/>
            2. Create a new Read token, paste below
          </p>
        )}

        {ext.aiProvider && (
          <>
            <label className="field" style={{marginBottom:'10px'}}>
              <span>API Key / Token (stored locally, only sent to {AI_PROVIDERS[ext.aiProvider]?.name})</span>
              <input
                type="password"
                value={ext.aiApiKey || ''}
                onChange={(e) => updateExt({ aiApiKey: e.target.value })}
                placeholder="Paste your token here"
              />
            </label>
            <label className="field" style={{marginBottom:'12px'}}>
              <span>Model name (optional — leave blank for default)</span>
              <input
                value={ext.aiModel || ''}
                onChange={(e) => updateExt({ aiModel: e.target.value })}
                placeholder={AI_PROVIDERS[ext.aiProvider]?.defaultModel || ''}
              />
            </label>
            <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
              <button type="button" className="btn btn--secondary" onClick={testAI}>Test Connection</button>
              {aiTestStatus && <span className="hint" style={{fontSize:'0.85rem'}}>{aiTestStatus}</span>}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2>Form memory</h2>
        <label className="field field--row">
          <input
            type="checkbox"
            checked={ext.autoLearnFromForms}
            onChange={(e) => updateExt({ autoLearnFromForms: e.target.checked })}
          />
          <span>
            Remember what I type — when I leave a field, save its value into the active profile (uses the same field
            model + custom labels).
          </span>
        </label>
        <label className="field field--row">
          <input
            type="checkbox"
            checked={ext.useAdvancedFieldModel}
            onChange={(e) => updateExt({ useAdvancedFieldModel: e.target.checked })}
          />
          <span>
            Use advanced field analysis when simple label rules do not match (weighted keywords + autocomplete mapping).
          </span>
        </label>
        <p className="hint">
          Values you could not map are stored by question text and reused next time on similar wording.
        </p>
      </section>

      <section className="card">
        <h2>Profiles</h2>
        <div className="row">
          <label className="field grow">
            <span>Active profile</span>
            <select value={activeId} onChange={(e) => setActiveId(e.target.value)}>
              {Object.values(profiles).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label || p.id}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--secondary" onClick={addProfile}>
            Add profile
          </button>
          <button type="button" className="btn btn--danger" onClick={removeProfile}>
            Remove
          </button>
        </div>

        {FIELDS.map(({ key, label }) => (
          <label key={key} className="field">
            <span>{label}</span>
            <input value={current[key] ?? ''} onChange={(e) => updateField(key, e.target.value)} />
          </label>
        ))}

        <h3 className="card__sub">Saved paragraphs (used for long / essay questions)</h3>
        {PARAGRAPH_FIELDS.map(({ key, label }) => (
          <label key={key} className="field">
            <span>{label}</span>
            <textarea
              rows={5}
              value={current[key] ?? ''}
              onChange={(e) => updateField(key, e.target.value)}
            />
          </label>
        ))}

        <label className="field">
          <span>Resume (PDF)</span>
          <input type="file" accept=".pdf,application/pdf" onChange={onResume} />
        </label>
        {current.resumeDataUrl ? (
          <p className="hint">Stored: {current.resumeFileName || 'resume.pdf'}</p>
        ) : (
          <p className="hint">Upload a PDF for automatic file-field upload on supported pages.</p>
        )}
      </section>

      {/* ── CUSTOM FIELDS ─────────────────────────────────── */}
      <section className="card">
        <h2>🧩 Custom Fields</h2>
        <p className="hint" style={{marginBottom:'12px'}}>
          Fields saved from unknown form inputs appear here automatically. You can also add your own.
          They are matched against job forms by their label text.
        </p>

        {Object.entries(current.customFormAnswers || {}).length === 0 && (
          <p className="hint">No custom fields yet. Import a form or add one below.</p>
        )}

        {Object.entries(current.customFormAnswers || {}).map(([fieldKey, fieldVal]) => (
          <div key={fieldKey} className="row" style={{alignItems:'center', gap:'8px', marginBottom:'8px'}}>
            <label className="field grow">
              <span style={{fontFamily:'monospace', fontSize:'0.78rem', color:'#6366f1'}}>{fieldKey.replace(/_/g, ' ')}</span>
              <input
                value={fieldVal ?? ''}
                onChange={(e) => updateCustomField(fieldKey, e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn--danger"
              style={{marginTop:'18px', padding:'6px 10px', fontSize:'0.8rem'}}
              onClick={() => deleteCustomField(fieldKey)}
              title="Delete this field"
            >✕</button>
          </div>
        ))}

        <hr style={{margin:'14px 0', borderColor:'#e2e8f0'}} />
        <h3 className="card__sub">Add a new custom field</h3>
        <div className="row" style={{gap:'8px', alignItems:'flex-end'}}>
          <label className="field grow">
            <span>Field label (e.g. "Preferred Language")</span>
            <input
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              placeholder="Field name"
              onKeyDown={(e) => e.key === 'Enter' && addCustomField()}
            />
          </label>
          <label className="field grow">
            <span>Value</span>
            <input
              value={newFieldValue}
              onChange={(e) => setNewFieldValue(e.target.value)}
              placeholder="Your answer"
              onKeyDown={(e) => e.key === 'Enter' && addCustomField()}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            style={{marginBottom:'0', padding:'9px 16px'}}
            onClick={addCustomField}
          >+ Add</button>
        </div>
      </section>

      <div className="footer">
        <button type="button" className="btn btn--primary" onClick={persist}>
          Save all
        </button>
        {savedMsg ? <span className="ok">{savedMsg}</span> : null}
      </div>
    </div>
  )
}
