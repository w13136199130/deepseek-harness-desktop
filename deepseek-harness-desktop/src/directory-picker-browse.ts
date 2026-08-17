/**
 * Desktop browse backend for the directory-picker seam: an in-app directory
 * browser whose Windows root view enumerates every available drive instead of
 * opening directly at the home directory. Drive rows are ordinary
 * `DirectoryEntry` values (`C:\`, `D:\`, …), so the upstream browse UI can
 * jump into any drive and browse normally from there. Non-Windows hosts keep
 * the upstream behavior (root view = home directory), and listing/creation
 * semantics delegate to the upstream browse package's exported helpers, so
 * this backend is a drop-in for the upstream browse row in both directions.
 * @module deepseek-harness-desktop/directory-picker-browse
 */

import { statSync } from 'node:fs'
import { mkdir, opendir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import {
  DirectoryPicker, DirectoryPickerError,
} from '@deepseek-ai/dsh-host-directory-picker'
import type {
  DirectoryEntry, DirectoryListing, DirectoryPickerBrowseCapability,
} from '@deepseek-ai/dsh-host-directory-picker'
import {
  boundedInsert,
  fullyQualified,
  raceAbort,
  type ListingCandidate,
} from '@deepseek-ai/dsh-host-directory-picker-browse'

export { fullyQualified } from '@deepseek-ai/dsh-host-directory-picker-browse'

/** The virtual root row label for the Windows drive-selection view. */
const DRIVE_ROOT_LABEL = '\\'

/** One listing row for a drive root (`C:\`). */
function driveEntry(root: string): DirectoryEntry {
  return { name: root, path: root, hidden: false }
}

/**
 * Enumerate every currently available Windows drive root.
 * @param isDirectory - existence probe (defaults to `statSync(...).isDirectory()`).
 * @returns one directory row per mounted drive (`A:\` through `Z:\`).
 */
export function enumerateWindowsDrives(
  isDirectory: (path: string) => boolean = path => statSync(path).isDirectory(),
): DirectoryEntry[] {
  const drives: DirectoryEntry[] = []
  for (let code = 65; code <= 90; code += 1) {
    const root = `${String.fromCharCode(code)}:\\`
    try {
      // A drive without media (empty card reader) throws; only roots that
      // resolve as directories are offered.
      if (isDirectory(root)) drives.push(driveEntry(root))
    } catch {
      // Unavailable drive: skip.
    }
  }
  return drives
}

/**
 * Ancestor chain from the filesystem root to `target` inclusive — the
 * breadcrumb rows of a listing, every one a jump target.
 */
function ancestryCrumbs(target: string): DirectoryEntry[] {
  const crumbs: DirectoryEntry[] = []
  let current = target
  for (;;) {
    const parent = dirname(current)
    crumbs.unshift({ name: parent === current ? current : basename(current), path: current, hidden: false })
    if (parent === current) return crumbs
    current = parent
  }
}

/**
 * One listing row for a dirent, following symlinks to directories; null for
 * non-directories and broken/cyclic links.
 */
async function directoryRow(
  parent: string, name: string, isDirectory: boolean, isSymbolicLink: boolean, signal: AbortSignal | undefined,
): Promise<DirectoryEntry | null> {
  const path = join(parent, name)
  let enterable = isDirectory
  if (!enterable && isSymbolicLink) {
    try {
      enterable = (await raceAbort(stat(path), signal)).isDirectory()
    } catch {
      if (signal?.aborted) throw signal.reason
      return null
    }
  }
  if (!enterable) return null
  return { name, path, hidden: name.startsWith('.') }
}

/** The `ctx.directoryPicker` browse implementation with Windows drive enumeration. */
export default class DesktopBrowseDirectoryPicker extends DirectoryPicker {
  private readonly browseCapability: DirectoryPickerBrowseCapability = {
    kind: 'browse',
    list: (path, signal) => this.list(path, signal),
    createDirectory: (path, name) => this.createDirectory(path, name),
  }

  /**
   * Enumerate the Windows drive rows offered by the root view.
   * @returns one directory row per available drive.
   */
  protected drives(): DirectoryEntry[] {
    return enumerateWindowsDrives()
  }

  /**
   * The browse interaction capability.
   * @returns the stable `browse` capability object.
   */
  capability(): DirectoryPickerBrowseCapability {
    return this.browseCapability
  }

  private async list(path?: string, signal?: AbortSignal): Promise<DirectoryListing> {
    const home = homedir()
    // Windows root view: offer every mounted drive instead of the home
    // directory; the operator picks a drive to browse into. The drive-root
    // label (`\`) also returns here so a breadcrumb click stays on the view.
    if (process.platform === 'win32' && (path === undefined || path === DRIVE_ROOT_LABEL)) {
      return {
        path: DRIVE_ROOT_LABEL,
        home,
        crumbs: [{ name: DRIVE_ROOT_LABEL, path: DRIVE_ROOT_LABEL, hidden: false }],
        entries: this.drives(),
        truncated: false,
      }
    }
    if (path === undefined) path = home
    if (!fullyQualified(path, process.platform)) {
      throw new DirectoryPickerError('directory-unreadable', path, `cannot list "${path}": not a fully qualified path`)
    }
    const target = resolve(path)
    const keep = 1001
    const window: ListingCandidate[] = []
    let evicted = false
    try {
      const opening = opendir(target)
      const level = await raceAbort(opening, signal).catch((error: unknown) => {
        void opening.then(dir => dir.close().catch(() => {}), () => {})
        throw error
      })
      try {
        for (;;) {
          const dirent = await raceAbort(level.read(), signal)
          if (dirent === null) break
          if (!dirent.isDirectory() && !dirent.isSymbolicLink()) continue
          const candidate = { name: dirent.name, isDirectory: dirent.isDirectory(), isSymbolicLink: dirent.isSymbolicLink() }
          if (boundedInsert(window, candidate, keep)) evicted = true
        }
      } finally {
        const closing = level.close()
        if (signal?.aborted) closing.catch(() => {})
        else await closing
      }
    } catch (error: unknown) {
      signal?.throwIfAborted()
      throw new DirectoryPickerError('directory-unreadable', target, `cannot list ${target}: ${error instanceof Error ? error.message : String(error)}`)
    }
    const entries: DirectoryEntry[] = []
    let truncated = evicted
    for (const candidate of window) {
      signal?.throwIfAborted()
      const row = await directoryRow(target, candidate.name, candidate.isDirectory, candidate.isSymbolicLink, signal)
      if (row === null) continue
      if (entries.length === 1000) {
        truncated = true
        break
      }
      entries.push(row)
    }
    return { path: target, home, crumbs: ancestryCrumbs(target), entries, truncated }
  }

  private async createDirectory(path: string, name: string): Promise<string> {
    if (!fullyQualified(path, process.platform)) {
      throw new DirectoryPickerError('directory-create-failed', path, `cannot create under "${path}": not a fully qualified parent path`)
    }
    const parent = resolve(path)
    if (name.trim() === '' || name === '.' || name === '..' || /[/\\]/.test(name)) {
      throw new DirectoryPickerError('directory-create-failed', join(parent, name), `"${name}" is not a single path segment`)
    }
    const target = join(parent, name)
    try {
      await mkdir(target)
      return target
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST') {
        throw new DirectoryPickerError('directory-exists', target, `${target} already exists`)
      }
      throw new DirectoryPickerError('directory-create-failed', target, `cannot create ${target}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
