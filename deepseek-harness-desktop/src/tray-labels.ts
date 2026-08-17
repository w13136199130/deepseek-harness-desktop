/** Native tray menu labels resolved from the Electron application locale. */

import type { DesktopShellMode } from './runtime.ts'

/** Language families supported by the desktop-owned native tray. */
export type TrayLanguage = 'en' | 'zh'

/** Resolve the tray language from an Electron locale tag (for example `zh-CN`). */
export function trayLanguage(locale: string): TrayLanguage {
  return /^zh\b|^zh-/iu.test(locale) ? 'zh' : 'en'
}

/** Localized native tray menu labels. */
export interface TrayLabels {
  /** Reveal and focus the main window. */
  open(productName: string): string
  /** Open the packaged DSH terminal for the active profile. */
  openTerminal: string
  /** Heading above the selectable profile radio commands. */
  profile(name: string): string
  /** Suffix rendered for a profile that cannot back the desktop Web surface. */
  unavailableForDesktop(name: string): string
  /** Manual update check command. */
  checkForUpdates: string
  /** Manual update check command while a request is in flight. */
  checkingForUpdates: string
  /** Tray status when a strictly newer version is available. */
  updateAvailable(version: string): string
  /** Tray status while a confirmed installer is downloading. */
  downloading(version: string): string
  /** Command that activates the opposite presentation mode. */
  switchMode(mode: DesktopShellMode): string
  /** Native application exit command. */
  quit: string
}

const EN: TrayLabels = {
  open: productName => `Open ${productName}`,
  openTerminal: 'Open DSH Terminal',
  profile: name => `Profile: ${name}`,
  unavailableForDesktop: name => `${name} (Unavailable for Desktop)`,
  checkForUpdates: 'Check for Updates…',
  checkingForUpdates: 'Checking for Updates…',
  updateAvailable: version => `DeepSeek Harness Desktop ${version} Available`,
  downloading: version => `Downloading DeepSeek Harness Desktop ${version}…`,
  switchMode: mode => mode === 'compatibility'
    ? 'Switch to Advanced Mode'
    : 'Switch to Compatibility Mode',
  quit: 'Quit',
}

const ZH: TrayLabels = {
  open: productName => `打开 ${productName}`,
  openTerminal: '打开 DSH 终端',
  profile: name => `配置文件：${name}`,
  unavailableForDesktop: name => `${name}（桌面不可用）`,
  checkForUpdates: '检查更新…',
  checkingForUpdates: '正在检查更新…',
  updateAvailable: version => `DeepSeek Harness Desktop ${version} 可用更新`,
  downloading: version => `正在下载 DeepSeek Harness Desktop ${version}…`,
  switchMode: mode => mode === 'compatibility'
    ? '切换到高级模式'
    : '切换到兼容模式',
  quit: '退出',
}

/** Return the tray labels for the resolved application language. */
export function trayLabels(locale: string): TrayLabels {
  return trayLanguage(locale) === 'zh' ? ZH : EN
}
