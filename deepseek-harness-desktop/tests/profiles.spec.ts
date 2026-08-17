import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { DesktopRuntime, DesktopTrayItem } from '../src/runtime.ts'
import type { DesktopProfiles } from '../src/profile-service.ts'
import { trayLabels } from '../src/tray-labels.ts'
import { apply, inject, name } from '../src/profiles.ts'

describe('desktop profiles Host plugin', () => {
  it.each([
    ['en-US', 'Profile: desktop', 'headless (Unavailable for Desktop)'],
    ['zh-CN', '配置文件：desktop', 'headless（桌面不可用）'],
  ] as const)('registers localized radio profile commands (%s)', async (locale, profileLabel, unavailableLabel) => {
    let trayItem: DesktopTrayItem | undefined
    let disposeEffect: (() => void) | undefined
    const events: string[] = []
    const disposeRegistration = vi.fn()
    const runtime = {
      labels: trayLabels(locale),
      registerTrayItem: (item: DesktopTrayItem) => {
        trayItem = item
        return { refresh: () => {}, dispose: disposeRegistration }
      },
      requestRestart: vi.fn(async () => { events.push('unexpected restart') }),
    } as unknown as DesktopRuntime
    const profiles: DesktopProfiles = {
      current: { name: 'desktop', dir: '/profiles/desktop' },
      list: () => [
        { name: 'desktop', dir: '/profiles/desktop', exists: true, bundles: [], webCapable: true },
        { name: '工作 profile', dir: '/profiles/work', exists: true, bundles: [], webCapable: true },
        { name: 'headless', dir: '/profiles/headless', exists: true, bundles: [], webCapable: false },
      ],
      select: async selected => { events.push(`select:${selected}`) },
    }
    const ctx = {
      desktopRuntime: runtime,
      desktopProfiles: profiles,
      effect: (register: () => (() => void)) => {
        disposeEffect = register()
        return disposeEffect
      },
    } as unknown as Context

    apply(ctx)

    expect(name).toBe('desktop-profiles')
    expect(inject).toEqual(['desktopRuntime', 'desktopProfiles'])
    expect(trayItem).toMatchObject({ group: 'profiles', order: 10 })
    expect(trayItem?.label()).toBe(profileLabel)
    const commands = trayItem?.submenu?.() ?? []
    expect(commands.map(command => ({
      label: command.label(),
      checked: command.checked?.(),
      enabled: command.enabled?.(),
    }))).toEqual([
      { label: 'desktop', checked: true, enabled: true },
      { label: '工作 profile', checked: false, enabled: true },
      { label: unavailableLabel, checked: false, enabled: false },
    ])

    await commands[1]?.invoke()
    expect(events).toEqual(['select:工作 profile'])
    expect(runtime.requestRestart).not.toHaveBeenCalled()
    disposeEffect?.()
    expect(disposeRegistration).toHaveBeenCalledOnce()
  })
})
