/** Electron adapter for the upstream Windows ACL PowerShell executor. */

import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { win32 } from 'node:path'
import type { ShellExecSpec, ShellProcess, ShellRunResult } from '@deepseek-ai/dsh-shell'
import { SandboxUnavailableError } from '@deepseek-ai/dsh-sandbox'
import { SandboxPwshExecutor } from '@deepseek-ai/dsh-pwsh-sandbox'
import type { Config as PwshConfig } from '@deepseek-ai/dsh-pwsh-local'
import {
  diagnoseWindowsVolumes,
  formatWindowsVolumeConcern,
} from './windows-volume-diagnostics.ts'

const RUN_AS_NODE = 'ELECTRON_RUN_AS_NODE'
const UPSTREAM_RUNNER = fileURLToPath(import.meta.resolve('@deepseek-ai/dsh-sandbox-windows-acl/runner'))
const DESKTOP_TRAMPOLINE = fileURLToPath(new URL('./windows-acl-runner.js', import.meta.url))

/** Inputs controlling one exact ACL-runner argv rewrite. */
export interface WindowsAclAdaptation {
  /** Host platform; only Windows is adapted. */
  platform: NodeJS.Platform
  /** Whether the current Host executable is Electron. */
  electron: boolean
  /** Current Electron executable path. */
  execPath: string
  /** Resolved upstream ACL runner path. */
  upstreamRunner: string
  /** Desktop-owned Node-mode trampoline path. */
  trampoline: string
}

/** Adapted execution inputs passed to the ordinary local executor. */
export interface AdaptedWindowsAclExecution {
  /** Spec carrying the runner-only Electron environment. */
  spec: ShellExecSpec
  /** Exact argv, with the desktop trampoline inserted when required. */
  argv: readonly string[]
}

/** Windows PowerShell paths that do not depend on PATH-provided portable runtimes. Built with win32 semantics on every host so results are deterministic off Windows. */
export function desktopWindowsPwshPath(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean = existsSync,
): string | undefined {
  if (platform !== 'win32') return undefined
  const programFiles = env.ProgramFiles ?? 'C:\\Program Files'
  const systemRoot = env.SystemRoot ?? 'C:\\Windows'
  const candidates = [
    win32.join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
    win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
  ]
  return candidates.find(candidate => exists(candidate))
}

/** Keep explicit user config, otherwise avoid PATH-resolved portable pwsh in the Windows ACL sandbox. */
export function desktopWindowsPwshConfig(
  config: PwshConfig,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean = existsSync,
): PwshConfig {
  if (config.pwshPath !== undefined && config.pwshPath.length > 0) return config
  const pwshPath = desktopWindowsPwshPath(env, platform, exists)
  return pwshPath === undefined ? config : { ...config, pwshPath }
}

/**
 * Insert the desktop Node-mode trampoline for the exact upstream ACL runner.
 * @param spec - resolved PowerShell execution spec.
 * @param argv - argv after the upstream sandbox provider has confined it.
 * @param adaptation - executable and runner identities for this Host.
 * @returns unchanged inputs for every non-runner call, otherwise the isolated runner launch.
 */
export function adaptWindowsAclExecution(
  spec: ShellExecSpec,
  argv: readonly string[],
  adaptation: WindowsAclAdaptation,
): AdaptedWindowsAclExecution {
  const [program, runner, ...args] = argv
  if (adaptation.platform !== 'win32'
    || !adaptation.electron
    || program !== adaptation.execPath
    || runner !== adaptation.upstreamRunner) {
    return { spec, argv }
  }

  const env = { ...spec.env }
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === RUN_AS_NODE) delete env[key]
  }
  env[RUN_AS_NODE] = '1'
  return {
    spec: { ...spec, env },
    argv: [adaptation.execPath, adaptation.trampoline, adaptation.upstreamRunner, ...args],
  }
}

/**
 * Append an actionable volume cause to a Windows ACL sandbox failure when the
 * command's working directory sits on a volume that cannot support the
 * runner's NTFS-style ACL and junction operations. The runner is fail-closed
 * by design (no unrestricted fallback), so the added detail is the only
 * diagnostic the command sees.
 * @param error - the upstream sandbox-unavailable failure.
 * @param workdir - the command working directory whose volume is suspected.
 * @returns the original error when no volume concern applies, otherwise a new
 * error carrying the concern text.
 */
export function enhanceSandboxUnavailableWithVolumeDiagnosis(
  error: SandboxUnavailableError,
  workdir: string,
): Error {
  const concerns = diagnoseWindowsVolumes(process.platform, [
    { label: 'command working directory', path: workdir },
  ])
  if (concerns.length === 0) return error
  const detail = concerns.map(formatWindowsVolumeConcern).join('; ')
  // Rebuild with the volume cause appended to the runner-failure detail so
  // the operator sees the placement problem, not only the fail-closed
  // signature. The mode is not exposed on the error; 'read-only' is the
  // confining label the message template requires (the original detail is
  // preserved verbatim inside the new detail).
  const runnerFailure = error.message.includes('Runner failure: ')
    ? error.message.slice(error.message.indexOf('Runner failure: ') + 'Runner failure: '.length)
    : error.message
  return new SandboxUnavailableError('read-only', `${runnerFailure} ${detail}`)
}

/** PowerShell sandbox provider that repairs only Electron-hosted Windows ACL launches. */
export class DesktopWindowsPwshSandbox extends SandboxPwshExecutor {
  constructor(ctx: ConstructorParameters<typeof SandboxPwshExecutor>[0], config: PwshConfig) {
    super(ctx, desktopWindowsPwshConfig(config, process.env, process.platform))
  }

  private adapt(spec: ShellExecSpec, argv: readonly string[]): AdaptedWindowsAclExecution {
    return adaptWindowsAclExecution(spec, argv, {
      platform: process.platform,
      electron: process.versions.electron !== undefined,
      execPath: process.execPath,
      upstreamRunner: UPSTREAM_RUNNER,
      trampoline: DESKTOP_TRAMPOLINE,
    })
  }

  protected override async runArgv(spec: ShellExecSpec, argv: readonly string[]): Promise<ShellRunResult> {
    const adapted = this.adapt(spec, argv)
    try {
      return await super.runArgv(adapted.spec, adapted.argv)
    } catch (error) {
      if (error instanceof SandboxUnavailableError) {
        throw enhanceSandboxUnavailableWithVolumeDiagnosis(error, spec.workdir)
      }
      throw error
    }
  }

  protected override startArgv(spec: ShellExecSpec, argv: readonly string[]): ShellProcess {
    const adapted = this.adapt(spec, argv)
    try {
      return super.startArgv(adapted.spec, adapted.argv)
    } catch (error) {
      if (error instanceof SandboxUnavailableError) {
        throw enhanceSandboxUnavailableWithVolumeDiagnosis(error, spec.workdir)
      }
      throw error
    }
  }
}

export default DesktopWindowsPwshSandbox
