import { mkdtempSync, writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DirectoryPickerBrowseCapability } from '@deepseek-ai/dsh-host-directory-picker'
import DesktopBrowseDirectoryPicker, {
  enumerateWindowsDrives,
  fullyQualified,
} from '../src/directory-picker-browse.ts'

class FixedDrivesPicker extends DesktopBrowseDirectoryPicker {
  constructor(ctx: ConstructorParameters<typeof DesktopBrowseDirectoryPicker>[0], drives: string[]) {
    super(ctx)
    this.drives = () => drives.map(root => ({ name: root, path: root, hidden: false }))
  }
}

/** Mount the picker on a real Cordis context; optionally pin the platform. */
async function createPicker(platform?: NodeJS.Platform, drives?: string[]): Promise<{
  capability: DirectoryPickerBrowseCapability
  dispose: () => Promise<void>
}> {
  if (platform !== undefined) vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
  const ctx = new Context()
  const fiber = drives === undefined
    ? ctx.plugin(DesktopBrowseDirectoryPicker)
    : ctx.plugin(FixedDrivesPicker, drives)
  await fiber.await()
  const picked = ctx.get('directoryPicker')!.capability()
  if (picked.kind !== 'browse') throw new Error('desktop browse backend must advertise the browse capability')
  return {
    capability: picked,
    dispose: async () => {
      await fiber.dispose()
      vi.restoreAllMocks()
    },
  }
}

describe('desktop browse directory picker', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('enumerates existing drive roots as directory rows', () => {
    const existing = new Set(['C:\\'])
    const drives = enumerateWindowsDrives(path => existing.has(path))
    expect(drives).toEqual([{ name: 'C:\\', path: 'C:\\', hidden: false }])
  })

  it('skips drives without media', () => {
    const drives = enumerateWindowsDrives(() => false)
    expect(drives).toEqual([])
  })

  it.each([
    ['C:\\x', 'win32', true],
    ['D:\\x', 'win32', true],
    ['\\\\server\\share', 'win32', true],
    ['\\x', 'win32', false],
    ['x', 'win32', false],
    ['/x', 'linux', true],
    ['x', 'linux', false],
  ] as const)('fullyQualified(%s, %s) = %s', (path, platform, expected) => {
    expect(fullyQualified(path, platform)).toBe(expected)
  })

  it('offers every drive from the Windows root view', async () => {
    const { capability, dispose } = await createPicker('win32', ['C:\\', 'D:\\'])
    try {
      const listing = await capability.list(undefined)

      expect(listing.path).toBe('\\')
      expect(listing.home.length).toBeGreaterThan(0)
      expect(listing.crumbs).toEqual([{ name: '\\', path: '\\', hidden: false }])
      expect(listing.entries.map(entry => entry.name)).toEqual(['C:\\', 'D:\\'])
      expect(listing.truncated).toBe(false)
      for (const entry of listing.entries) {
        expect(fullyQualified(entry.path, 'win32')).toBe(true)
      }
    } finally {
      await dispose()
    }
  })

  it('returns the root view for the drive-root breadcrumb jump', async () => {
    const { capability, dispose } = await createPicker('win32', ['C:\\'])
    try {
      const listing = await capability.list('\\')
      expect(listing.path).toBe('\\')
      expect(listing.entries.map(entry => entry.name)).toEqual(['C:\\'])
    } finally {
      await dispose()
    }
  })

  it('lists one directory level with ancestry crumbs on the real host', async () => {
    const { capability, dispose } = await createPicker()
    const root = mkdtempSync(join(tmpdir(), 'dsh-browse-'))
    try {
      await mkdir(join(root, 'alpha'))
      await mkdir(join(root, 'beta'))
      writeFileSync(join(root, 'file.txt'), 'x')

      const listing = await capability.list(root)
      expect(listing.path).toBe(root)
      expect(listing.entries.map(entry => entry.name).sort()).toEqual(['alpha', 'beta'])
      expect(listing.crumbs.at(-1)?.path).toBe(root)
      expect(listing.truncated).toBe(false)
    } finally {
      await dispose()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a non-fully-qualified listing path', async () => {
    const { capability, dispose } = await createPicker()
    try {
      await expect(capability.list('relative')).rejects.toThrow('not a fully qualified path')
    } finally {
      await dispose()
    }
  })

  it('creates one child directory and rejects existing names', async () => {
    const { capability, dispose } = await createPicker()
    const root = mkdtempSync(join(tmpdir(), 'dsh-browse-'))
    try {
      const created = await capability.createDirectory(root, 'fresh')
      expect(created).toBe(join(root, 'fresh'))

      await expect(capability.createDirectory(root, 'fresh'))
        .rejects.toMatchObject({ code: 'directory-exists' })
    } finally {
      await dispose()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects an invalid create name', async () => {
    const { capability, dispose } = await createPicker()
    try {
      await expect(capability.createDirectory(tmpdir(), 'a/b')).rejects.toMatchObject({
        code: 'directory-create-failed',
      })
    } finally {
      await dispose()
    }
  })
})
