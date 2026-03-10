import { useEffect, useState } from 'react'

const STORAGE_KEY = 'flow-viewer-theme'

export function useTheme(): [boolean, (value: boolean | ((prev: boolean) => boolean)) => void] {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(stored === 'dark' || (stored !== 'light' && prefersDark))
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem(STORAGE_KEY, 'dark')
    }
    else {
      root.classList.remove('dark')
      localStorage.setItem(STORAGE_KEY, 'light')
    }
  }, [dark])

  return [dark, setDark]
}
