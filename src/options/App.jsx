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

const FIELDS = [
  { key: 'label',             label: 'Profile name' },
  { key: 'firstName',         label: 'First name' },
  { key: 'lastName',          label: 'Last name' },
  { key: 'fullName',          label: 'Full name' },
  { key: 'email',             label: 'Email' },
  { key: 'phone',             label: 'Phone (full, e.g. +919876543210)' },
  { key: 'phoneCountryCode',  label: 'Phone country code (e.g. +91)' },
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

      <div className="footer">
        <button type="button" className="btn btn--primary" onClick={persist}>
          Save all
        </button>
        {savedMsg ? <span className="ok">{savedMsg}</span> : null}
      </div>
    </div>
  )
}
