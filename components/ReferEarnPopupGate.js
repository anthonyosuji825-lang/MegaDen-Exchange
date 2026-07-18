'use client'
import { useState, useEffect } from 'react'
import ReferEarnPopup from './ReferEarnPopup'

const SESSION_FLAG = 'referPopupCheckedThisSession'

// Drop this once into your dashboard layout (or the main dashboard page).
// It handles everything: whether this session should show the popup at
// all (max 3 sessions, ever, tracked per account), and only asks the
// server once per browser session — not on every page navigation.
export default function ReferEarnPopupGate() {
  const [open, setOpen] = useState(false)
  const [referralLink, setReferralLink] = useState('')

  useEffect(() => {
    // Already asked the server this session — don't ask again, whatever
    // the answer was, so navigating between pages doesn't re-trigger it.
    if (sessionStorage.getItem(SESSION_FLAG)) return
    sessionStorage.setItem(SESSION_FLAG, '1')

    fetch('/api/refer-popup', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.show) {
          setReferralLink(data.referralLink)
          setOpen(true)
        }
      })
      .catch(() => {}) // fail silently — this is a promo, not critical path
  }, [])

  return (
    <ReferEarnPopup
      open={open}
      referralLink={referralLink}
      onClose={() => setOpen(false)}
    />
  )
}