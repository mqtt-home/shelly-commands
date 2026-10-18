import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type Lang = 'de' | 'en'
export const LANGS: Lang[] = ['de', 'en']

/** A configured text per language; "*" applies to every language. */
export type Text = Record<string, string>

const LANG_KEY = 'home.lang'

// German is the house language; English stays one tap away. Per device.
function initialLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'de' || v === 'en') return v
  } catch {
    // storage blocked
  }
  return 'de'
}

const dict = {
  de: {
    'title': 'Rollläden',
    'disconnected': 'Verbindung getrennt',
    'reconnect': 'Neu verbinden',
    'loading': 'Rollläden werden geladen …',
    'error.title': 'Rollläden konnten nicht geladen werden',
    'retry': 'Erneut versuchen',
    'safe.on': 'Sicherheitsmodus an – zum Ausschalten tippen',
    'safe.off': 'Sicherheitsmodus aus – zum Einschalten tippen',
    'safe.hint': 'Sicherheitsmodus: Befehle zum Ausführen zweimal tippen',
    'safe.auto': 'auf dem Handy automatisch an',
    'tapAgain': 'Nochmal tippen',
    'all': 'Alle',
    'all.devices': '{n} Geräte',
    'all.close': 'Alle schließen',
    'all.open': 'Alle öffnen',
    'all.slats': 'Lamellen (nur Raffstores)',
    'all.tiltClosed': 'Lamellen zu',
    'all.tiltHalf': 'Lamellen halb',
    'position': 'Position',
    'slats': 'Lamellen',
    'quick': 'Schnellwahl',
    'groups': 'Gruppen',
    'devices': 'Einzelne Geräte',
    'open': 'Öffnen',
    'close': 'Schließen',
    'pos.open': 'Offen',
    'pos.closed': 'Geschlossen',
    'pos.openPct': 'offen',
    'pos.preview': 'Vorschau',
    'type.blinds': 'Raffstore',
    'type.rollershutter': 'Rollladen',
    'tilted': 'Lamellen {n} %',
    'tilt.blinds': 'Schließen & Lamellen kippen',
    'tilt.shutter': 'Lüftungsstellung (fast zu)',
    'group.count': '{n} Geräte',
    'group.one': '1 Gerät',
    'group.avg': 'Ø Position',
    'group.someTilted': 'teils gekippt',
    'group.details': '{name} einzeln steuern',
    'group.updating': 'Gruppe wird gestellt …',
    'group.dialogHint': 'Jedes Gerät der Gruppe einzeln steuern. Änderungen wirken sofort.',
    'group.empty': 'Diese Gruppe enthält keine Geräte.',
    'empty': 'Keine Rollläden gefunden',
    'empty.hint': 'Sind die Shelly-Geräte konfiguriert und erreichbar?',
    'allGrouped': 'Alle Geräte sind oben in Gruppen eingeteilt.',
    'failed': 'Befehl fehlgeschlagen: {error}',
    'dialog.close': 'Schließen',
    'language': 'Sprache',
  },
  en: {
    'title': 'Blinds',
    'disconnected': 'Disconnected',
    'reconnect': 'Reconnect',
    'loading': 'Loading blinds …',
    'error.title': 'Could not load the blinds',
    'retry': 'Try again',
    'safe.on': 'Safe mode on – tap to turn off',
    'safe.off': 'Safe mode off – tap to turn on',
    'safe.hint': 'Safe mode: tap a command twice to run it',
    'safe.auto': 'on automatically on phones',
    'tapAgain': 'Tap again',
    'all': 'All',
    'all.devices': '{n} devices',
    'all.close': 'Close all',
    'all.open': 'Open all',
    'all.slats': 'Slats (venetian blinds only)',
    'all.tiltClosed': 'Slats closed',
    'all.tiltHalf': 'Slats half',
    'position': 'Position',
    'slats': 'Slats',
    'quick': 'Quick positions',
    'groups': 'Groups',
    'devices': 'Individual devices',
    'open': 'Open',
    'close': 'Close',
    'pos.open': 'Open',
    'pos.closed': 'Closed',
    'pos.openPct': 'open',
    'pos.preview': 'preview',
    'type.blinds': 'Venetian blind',
    'type.rollershutter': 'Roller shutter',
    'tilted': 'Slats {n} %',
    'tilt.blinds': 'Close & tilt slats',
    'tilt.shutter': 'Tilt (almost closed)',
    'group.count': '{n} devices',
    'group.one': '1 device',
    'group.avg': 'Avg. position',
    'group.someTilted': 'some tilted',
    'group.details': 'Control {name} individually',
    'group.updating': 'Moving group …',
    'group.dialogHint': 'Control each device of the group individually. Changes apply immediately.',
    'group.empty': 'This group has no devices.',
    'empty': 'No blinds found',
    'empty.hint': 'Are the Shelly devices configured and reachable?',
    'allGrouped': 'All devices are organised in groups above.',
    'failed': 'Command failed: {error}',
    'dialog.close': 'Close',
    'language': 'Language',
  },
} satisfies Record<Lang, Record<string, string>>

export type Key = keyof (typeof dict)['de']

export interface I18n {
  lang: Lang
  locale: string
  setLang: (l: Lang) => void
  /** A UI string with {placeholders}. */
  t: (key: Key, vars?: Record<string, string | number>) => string
  /** A configured text in the current language. */
  tx: (text: Text | null | undefined) => string
  /** A number in the current locale (8,5 in German). */
  num: (n: number, decimals?: number) => string
}

const Ctx = createContext<I18n | null>(null)

export function resolveText(text: Text | null | undefined, lang: Lang) {
  if (!text) return ''
  return text[lang] ?? text['*'] ?? text.en ?? text.de ?? Object.values(text)[0] ?? ''
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      // convenience only
    }
  }, [])

  const value = useMemo<I18n>(() => {
    const locale = lang === 'de' ? 'de-DE' : 'en-GB'
    document.documentElement.lang = lang
    const t: I18n['t'] = (key, vars) =>
      (dict[lang][key] ?? dict.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? ''))
    const fmt = new Map<number, Intl.NumberFormat>()
    const num: I18n['num'] = (n, decimals = 0) => {
      let f = fmt.get(decimals)
      if (!f) {
        f = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        fmt.set(decimals, f)
      }
      return f.format(n)
    }
    return { lang, locale, setLang, t, tx: (text) => resolveText(text, lang), num }
  }, [lang, setLang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside I18nProvider')
  return v
}
