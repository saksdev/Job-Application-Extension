/** Default profile id when user has not created named profiles */
export const DEFAULT_PROFILE_ID = 'default'

/** Background ↔ popup message types */
export const BG_MESSAGE = {
  FORWARD_TO_TAB: 'FORWARD_TO_TAB',
}

export const STORAGE_KEYS = {
  profiles: 'profiles',
  activeProfileId: 'activeProfileId',
  /** Legacy — ignored by current build; may exist in old installs */
  openaiApiKey: 'openaiApiKey',
  llmSettings: 'llmSettings',
  extensionSettings: 'extensionSettings',
}
