'use client'

import { useEffect } from 'react'

export default function LandingAnimations() {
  useEffect(() => {
    const elements = document.querySelectorAll('[data-reveal]')
    elements.forEach(el => el.classList.add('lp-hidden'))

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.remove('lp-hidden')
            e.target.classList.add('lp-visible')
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    )

    elements.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return null
}
