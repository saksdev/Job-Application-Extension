import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Job Form Auto-Fill',
  version: '1.0.0',
  description:
    'Fill job applications from your saved profile using a built-in field understanding model (no external AI required).',
  permissions: ['storage', 'activeTab', 'scripting'],
  host_permissions: ['<all_urls>'],
  icons: {
    16:  'src/icons/icon16.png',
    32:  'src/icons/icon32.png',
    48:  'src/icons/icon48.png',
    128: 'src/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Job Form Auto-Fill',
    default_icon: {
      16:  'src/icons/icon16.png',
      32:  'src/icons/icon32.png',
      48:  'src/icons/icon48.png',
      128: 'src/icons/icon128.png',
    },
  },
  background: {
    service_worker: 'src/background/index.js',
    type: 'module',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.js'],
      run_at: 'document_idle',
    },
  ],
})
