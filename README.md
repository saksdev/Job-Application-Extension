# 🤖 AI Auto-Fill Job Application Extension

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Manifest](https://img.shields.io/badge/Manifest-V3-orange?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Llama%203.1-purple?style=for-the-badge)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)

**A privacy-first Chrome Extension that auto-fills job applications in seconds using serverless AI — no paid API keys required.**

[✨ Features](#-features) · [🚀 Getting Started](#-getting-started) · [🏗️ Architecture](#️-architecture) · [🤝 Contributing](#-contributing) · [📸 Screenshots](#-screenshots)

</div>

---

## 📌 Table of Contents

- [About the Project](#-about-the-project)
- [Problem Statement](#-problem-statement)
- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [System Architecture](#️-architecture)
- [Getting Started](#-getting-started)
- [How It Works](#-how-it-works)
- [Supported Platforms](#-supported-platforms)
- [Security & Privacy](#-security--privacy)
- [Roadmap](#️-roadmap)
- [Contributing](#-contributing)
- [Author](#-author)
- [License](#-license)

---

## 📖 About the Project

**AI Auto-Fill Job Application Extension** is a browser productivity tool for job seekers that eliminates the repetitive burden of filling out online job applications. Whether you're applying on Workday, Greenhouse, Lever, or any custom company portal — this extension fills the entire form for you in **under 3 seconds**.

> 🎯 **Goal:** Reduce average job application time from 15 minutes → under 60 seconds.

It uses a **Smart Built-In Rule Engine** (offline, zero-latency) for standard fields and a **free Cloudflare Workers AI backend** (Llama 3.1) for personalized essay generation — all without exposing your data to any centralized server.

---

## 😫 Problem Statement

Job seekers applying to 20+ positions daily face serious friction:

| Problem | Impact |
|---|---|
| Re-entering the same data on every ATS | Wastes 10–15 min per application |
| Answering "Why this company?" repeatedly | Mental fatigue, generic answers |
| Re-uploading resumes on every platform | Unnecessary friction |
| Re-entering GitHub, LinkedIn, Portfolio links | Tedious and error-prone |
| Workday's notoriously slow UX | Applicants give up mid-way |

---

## ✨ Features

### 🖱️ 1. One-Click Auto Fill
Instantly populates the entire job application form from a securely stored local profile — name, email, phone, address, links, work authorization, EEOC disclosures, and more.

### 🧠 2. Smart Built-In Field Detection (Offline)
A custom **TF-IDF inspired heuristic scoring engine** built in pure JavaScript:
- Works entirely offline — no internet required for standard fields
- Regex + autocomplete-based detection
- Maps 90%+ of standard ATS fields instantly
- Handles EEOC, pronouns, work authorization dropdowns

### 🤖 3. AI Essay Generation (Cloudflare Workers + Llama 3.1)
A free, serverless AI backend deployed on Cloudflare Workers:
- Writes personalized 2–4 sentence essay answers
- Contextualizes responses using your bio and experience
- Classifies unknown/obscure form labels (e.g., "Career Aspirations")
- **No OpenAI. No paid APIs. Completely free scaling.**

### 📋 4. Dynamic Custom Fields Memory
- Detects novel/unique questions on forms
- Saves them to "Custom Fields" in the Options UI
- Users answer once → auto-filled on every future application

### 📎 5. Resume Auto-Upload
- Stores a local PDF copy of your resume
- Automatically attaches it to file input fields

### 👤 6. Multi-Profile Support
- Create and switch between multiple profiles
- E.g., "Software Engineer", "Product Manager", "Frontend Developer"

### ⚡ 7. Zero-Click Autopilot Mode *(Coming Soon)*
- Detects application pages automatically
- Starts filling the form before you even click

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Extension Framework** | Chrome Extension API — Manifest V3 |
| **Frontend UI** | React + Vite |
| **Styling** | CSS Modules |
| **Languages** | JavaScript, HTML, CSS |
| **AI Backend** | Cloudflare Workers AI — `@cf/meta/llama-3.1-8b-instruct` |
| **Storage** | Chrome `localStorage` API (sandboxed, local-only) |
| **Field Detection** | Custom TF-IDF Heuristic Engine (pure JS) |
| **Build Tool** | Vite + Node.js |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (User's Machine)              │
│                                                         │
│  ┌───────────────┐     ┌──────────────────────────────┐ │
│  │  Options UI   │     │      Content Script          │ │
│  │  (React/Vite) │     │  (DOM Scanner + Field Filler)│ │
│  └───────┬───────┘     └────────────┬─────────────────┘ │
│          │                          │                   │
│          ▼                          ▼                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │          Chrome Extension Background Worker        │  │
│  │         (Storage Sync + Profile Manager)           │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                              │
│          ┌───────────────▼──────────┐                   │
│          │  Smart Rule Engine (JS)  │ ← Offline, Fast   │
│          │  TF-IDF Field Heuristics │                   │
│          └───────────────┬──────────┘                   │
│                          │ (only for essays)            │
└──────────────────────────┼──────────────────────────────┘
                           │ HTTPS (text only, no PII)
                           ▼
          ┌────────────────────────────────┐
          │     Cloudflare Workers AI      │
          │  Llama 3.1 (8B Instruct)       │
          │  Edge Computing — Free Tier    │
          └────────────────────────────────┘
```

**Data Flow:**
1. User lands on a job application page
2. Content Script scans the DOM for form fields
3. Smart Rule Engine (offline) maps 90% of fields from local profile
4. Cloudflare AI Worker generates essay answers for open-ended questions
5. Fields are populated automatically — including dropdowns, split inputs, and file uploads

---

## 🚀 Getting Started

### Prerequisites

- Node.js `v18+`
- A Chromium-based browser (Chrome, Edge, Brave)
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up) (for AI backend deployment)

### 1. Clone the Repository

```bash
git clone https://github.com/saksham-sharma/ai-autofill-extension.git
cd ai-autofill-extension
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Extension

```bash
npm run build
```

### 4. Deploy the Cloudflare Worker (AI Backend)

```bash
cd worker
npm install
npx wrangler deploy
```

> Copy your Worker URL and add it to `src/config.js` as `WORKER_URL`.

### 5. Load Extension in Chrome

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer Mode** (top right)
3. Click **"Load unpacked"**
4. Select the `dist/` folder

### 6. Set Up Your Profile

1. Click the extension icon → **"Open Settings"**
2. Fill in your personal details, resume PDF, and bio
3. Click **"Save Profile"**
4. Navigate to any job application → click **"Auto Fill"** ✅

---

## 🌐 Supported Platforms

| Platform | Status |
|---|---|
| Workday | ✅ Supported |
| Greenhouse | ✅ Supported |
| Lever | ✅ Supported |
| Ashby | ✅ Supported |
| SmartRecruiters | ✅ Supported |
| Custom Company Pages | ✅ Supported |
| Taleo | 🔜 Coming Soon |
| iCIMS | 🔜 Coming Soon |

---

## 🔐 Security & Privacy

This extension is built with a **privacy-first architecture**:

- ✅ **All personal data stays in your browser** — stored in Chrome's sandboxed `localStorage`
- ✅ **No centralized database** — your data is never uploaded or collected
- ✅ **Minimal AI surface** — only the essay prompt text (no PII) is sent to the Cloudflare Worker
- ✅ **No API keys required** — Cloudflare Workers AI is free at scale, no user credentials needed
- ✅ **Open source** — audit every line of code yourself

**Limitations:**
- ❌ Cannot solve CAPTCHAs or OTP verification
- ❌ Cannot bypass anti-bot iFrames
- ❌ Does not support Firefox (Manifest V3 differences)

---

## 🗺️ Roadmap

- [x] One-click auto fill for standard ATS fields
- [x] Cloudflare Workers AI essay generation
- [x] Multi-profile support
- [x] Resume PDF auto-upload
- [x] Custom fields memory
- [ ] Zero-Click Autopilot Mode
- [ ] Taleo + iCIMS support
- [ ] Application tracker dashboard
- [ ] Cover letter generation per job description
- [ ] Firefox support (Manifest V2 branch)
- [ ] Sync profiles across devices via Chrome Sync API

---

## 🤝 Contributing

Contributions make this project better for every job seeker. Here's how you can help:

### 🐛 Bug Reports
Found something broken? [Open an Issue](https://github.com/saksham-sharma/ai-autofill-extension/issues) with:
- Browser version
- ATS platform (e.g., Workday, Greenhouse)
- Steps to reproduce
- Screenshot or screen recording

### 💡 Feature Ideas
Have an idea? [Start a Discussion](https://github.com/saksham-sharma/ai-autofill-extension/discussions) before building so we can align direction.

### 🔧 Ways to Contribute

| Area | What's Needed |
|---|---|
| **New ATS Support** | Add DOM selectors for Taleo, iCIMS, BambooHR |
| **Field Detection** | Improve heuristic rules for edge-case field labels |
| **AI Prompts** | Improve essay generation quality and tone |
| **Testing** | Write unit tests for the field detection engine |
| **Accessibility** | Improve keyboard navigation in Options UI |
| **i18n** | Translate the Options UI to other languages |
| **Docs** | Improve setup guides and add video walkthroughs |

### 🛠️ Development Setup

```bash
# Fork and clone your fork
git clone https://github.com/YOUR_USERNAME/ai-autofill-extension.git

# Create a feature branch
git checkout -b feature/add-taleo-support

# Make your changes, then build
npm run build

# Test locally by loading the unpacked extension
# Then submit a Pull Request with a clear description
```

### Pull Request Guidelines
- Keep PRs focused — one feature or fix per PR
- Add a brief description of what changed and why
- Test on at least one real ATS platform before submitting
- Follow existing code style (ESLint config included)

---

## 📸 Screenshots

> *Add screenshots of the extension popup, options UI, and a form being filled here.*

```
📁 /screenshots
  ├── popup.png          — Extension popup UI
  ├── options-ui.png     — Profile settings page
  ├── autofill-demo.gif  — Form being filled live
  └── essay-gen.png      — AI essay output
```

---

## 📈 Impact

For active job seekers applying to 20–50 positions per day:

| Metric | Without Extension | With Extension |
|---|---|---|
| Time per application | 10–15 minutes | ~60 seconds |
| Daily applications | ~5 | 30–50 |
| Application fatigue | High | Minimal |
| Essay quality consistency | Variable | High |

> **Up to 80% reduction in time per application.**

---

## ⭐ Support

If this project helps your job search, consider:
- Starring ⭐ the repository
- Sharing it with other job seekers
- [Opening a PR](#-contributing) to add new ATS support

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

---

<div align="center">

Made with ❤️ by [Saksham Sharma](https://github.com/saksham-sharma) — built to make job hunting suck less.

</div>
