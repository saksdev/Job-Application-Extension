/**
 * Detects ATS / career portal from URL and document signals.
 */
export function detectPlatform() {
  const href = window.location.href.toLowerCase()
  const hostname = window.location.hostname.toLowerCase()

  if (hostname.includes('myworkdayjobs.com') || href.includes('workday')) {
    return 'workday'
  }
  if (hostname.includes('greenhouse.io') || href.includes('greenhouse')) {
    return 'greenhouse'
  }
  if (hostname.includes('lever.co') || href.includes('jobs.lever.co')) {
    return 'lever'
  }
  if (hostname.includes('ashbyhq.com') || href.includes('jobs.ashbyhq.com')) {
    return 'ashby'
  }
  if (hostname.includes('smartrecruiters.com')) {
    return 'smartrecruiters'
  }
  return 'custom'
}
