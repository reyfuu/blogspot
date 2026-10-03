'use client'

import { useSyncExternalStore } from 'react'

/**
 * FR-056: pengguna dapat menimpa preferensi sistem, dan pilihannya diingat.
 *
 * Kelas `dark` dipasang ThemeScript sebelum paint pertama, jadi kelas itulah
 * sumber kebenaran — bukan state React. useSyncExternalStore membaca langsung
 * dari DOM tanpa memicu render berantai (setState di dalam effect).
 */

const DARK_CLASS = 'dark'

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains(DARK_CLASS)
}

/** Di server kelasnya belum diketahui; label netral dipakai sampai terhidrasi. */
function getServerSnapshot(): boolean | null {
  return null
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore<boolean | null>(subscribe, getSnapshot, getServerSnapshot)

  function toggle() {
    const next = !document.documentElement.classList.contains(DARK_CLASS)
    document.documentElement.classList.toggle(DARK_CLASS, next)
    document.documentElement.style.colorScheme = next ? 'dark' : 'light'
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // Penyimpanan diblokir (mis. mode privat) — tema tetap berubah untuk sesi ini.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark === null ? 'Ganti tema' : isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
      className="inline-flex size-9 items-center justify-center rounded-md border text-sm transition-colors hover:bg-[var(--bg-subtle)]"
    >
      <span aria-hidden="true">{isDark === null ? '◐' : isDark ? '☀' : '☾'}</span>
    </button>
  )
}
