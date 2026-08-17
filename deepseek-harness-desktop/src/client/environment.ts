/** Desktop renderer modes accepted from the Electron-owned page URL. */
export type DesktopClientMode = 'compatibility' | 'advanced'

/** Host platforms whose native chrome has a desktop presentation. */
export type DesktopClientPlatform = 'darwin' | 'win32' | 'linux'

/** Validated renderer environment supplied by the Electron Host. */
export interface DesktopClientEnvironment {
  /** Active shell mode for this BrowserWindow lifetime. */
  mode: DesktopClientMode
  /** Electron Host platform used for native spacing and drag regions. */
  platform: DesktopClientPlatform
}

const MODES = new Set<DesktopClientMode>(['compatibility', 'advanced'])
const PLATFORMS = new Set<DesktopClientPlatform>(['darwin', 'win32', 'linux'])

/**
 * Validate the Electron-owned query marker before any desktop client effects run.
 * @param search - URL search string, including or omitting the leading question mark.
 * @returns the validated desktop renderer environment.
 */
export function parseDesktopClientEnvironment(search: string): DesktopClientEnvironment {
  const params = new URLSearchParams(search)
  const mode = params.get('deepseek-harness-desktop-mode')
  const platform = params.get('deepseek-harness-desktop-platform')
  if (!MODES.has(mode as DesktopClientMode)) {
    throw new Error(`deepseek-harness-desktop: invalid or missing deepseek-harness-desktop-mode ${JSON.stringify(mode)}`)
  }
  if (!PLATFORMS.has(platform as DesktopClientPlatform)) {
    throw new Error(`deepseek-harness-desktop: invalid or missing deepseek-harness-desktop-platform ${JSON.stringify(platform)}`)
  }
  return { mode: mode as DesktopClientMode, platform: platform as DesktopClientPlatform }
}
