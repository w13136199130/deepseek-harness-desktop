# DSH Desktop 实施蓝图

> 结论先行：桌面端 = **Electron 宿主 + 官方 DSH 运行时（原样运行）+ 以 Cordis 插件行实现的桌面能力**。官方源码零 fork、零修改；官方更新 = 升 submodule commit + 升运行时包版本。

## 1. 架构

```
DSH Desktop.exe（自包含：Electron + Node 运行时 + pnpm + 官方 DSH npm 包）
└── Electron main 进程
    ├── 单实例锁
    ├── 内置 pnpm 运行时（ELECTRON_RUN_AS_NODE，Electron 充当 Node）
    ├── boot() 启动官方 Host Cordis 根（@deepseek-ai/dsh-app-boot）
    │     └── profile = 官方 dsh-base + dsh-web-app + 桌面行（cordis.patch.yml insert，不落盘）
    ├── Host 绑定 127.0.0.1 临时端口 loopback HTTP/WebSocket
    └── desktop-shell 创建 BrowserWindow（sandbox:true / nodeIntegration:false / contextIsolation:true）
          └── 加载同源官方 Web UI —— 渲染进程零 Electron API、零 preload bridge
```

- **官方能力原样**：agent / 模型 / 工具 / 会话 / 设置 / 沙箱 / Web UI 全部来自官方包。
- **桌面能力是插件行**：`desktop-shell`（窗口/托盘/生命周期）、`desktop-terminal`、`desktop-pnpm`、`desktop-profiles`、`desktop-updates`，随官方 Loader 挂载、随 generation dispose。
- **双模式**：`compatibility`（默认，普通窗口 + 官方 UI）与 `advanced`（Windows 11 Mica / macOS vibrancy）。当前启用 compatibility，advanced 为后续迭代。

## 2. 命名规范

| 项 | 值 | 说明 |
| --- | --- | --- |
| 本地目录 | `dsh-desktop/` | 与官方 checkout 目录区分 |
| GitHub 仓库名 | `deepseek-harness-desktop` | 与产品仓库命名一致（待用户确认） |
| 产品名 | `DSH Desktop` | `build.productName` / `shortcutName` |
| npm 包名 | `dsh-plugin-desktop` | 内部保留；发布 npm 需改 `@<org>/dsh-desktop` |
| 二进制 | `dsh-desktop` / `dsh-plugin-desktop` | package.json `bin` |
| appId | `com.example.dshdesktop` ⚠️ 占位 | 发布前必须改为你的反向域名 |
| 更新端点 | `updates.example.com` ⚠️ 占位 | 发布前必须自建端点或改 GitHub Releases |
| 包管理器 | `yarn@4.18.0`（根）/ `pnpm`（submodule 内部） | 两者隔离 |

## 3. 包与依赖

- 根 workspace 仅含 `dsh-plugin-desktop` 一个成员（fabric/market 为参考项目规划目录，已剔除）。
- `resolutions`：`app-builder-lib@26.15.3` patch、`@deepseek-ai/dsh-sandbox-windows-acl@0.1.0-rc.6` patch、`koffi@^3.1.0 → 3.1.5`（来自参考项目，必须保留）。
- `dependenciesMeta.built`：放行 electron / koffi / node-pty / esbuild 等原生包构建（`.yarnrc.yml` 的 `enableScripts: false`）。
- 运行时 family：`@deepseek-ai/dsh-*@0.1.0-rc.6`（精确版本，与 `upstream.json.runtimePackageVersion` 一致，由 `verify-layout` 强制）。
- Electron peer/dev：`43.4.0`。

## 4. 存放路径

```
dsh-desktop/
├── .gitattributes / .gitignore / .yarnrc.yml
├── package.json / upstream.json / README.md / AGENTS.md / CLAUDE.md / LICENSE
├── patches/                    app-builder-lib + dsh-sandbox-windows-acl patch
├── scripts/verify-layout.mjs   布局与上游一致性门禁
├── docs/BLUEPRINT.md           本文档
├── deepseek-harness/           submodule（gitlink，官方源码只读）
└── dsh-plugin-desktop/
    ├── src/                    主进程引导 + 桌面插件行
    │   ├── main.ts             Electron 最小引导（单实例 → boot → 窗口）
    │   ├── profile.ts          官方 dsh-base + dsh-web-app + 桌面行组合
    │   ├── runtime.ts          desktop-shell：窗口/托盘/service contract
    │   ├── desktop-runtime-environment.ts   内置 pnpm / dsh 命令 shim
    │   ├── desktop-terminal.ts / pnpm.ts / profiles.ts / updates.ts
    │   ├── windows-pwsh-sandbox.ts / windows-acl-runner.ts / windows-volume-diagnostics.ts
    │   └── client/             advanced 模式 Client 插件（当前未启用）
    ├── cordis.patch.yml        桌面行注入（updates 默认禁用，等更新端点）
    ├── build/                  应用/托盘图标（沿用参考图标，待替换）
    ├── scripts/                打包与验证脚本（package-win.ts 等）
    ├── tests/                  单测与打包验证
    └── package.json            build.appId 等打包配置
```

## 5. 实现思路

1. **启动**：Electron main 进程内 `boot()` 官方 Host 根，Host 提供 loopback Web carrier，窗口加载同源页面。无渲染进程桥。
2. **Profile**：`desktop` profile = 官方 `dsh-base` + `dsh-web-app` + 桌面行；桌面行每次启动注入、不持久化进 profile manifest。
3. **自包含**：内置 pnpm + Electron-as-Node，用户无需安装 Node/pnpm/DSH；profile 插件管理复用官方 `dsh plugin --profile` CLI。
4. **打包**：electron-builder NSIS（x64、向导式、可改目录、快捷方式）；`asar` + `asarUnpack`；`afterPack` 校验。
5. **验证**：`yarn check` = `check:layout`（布局/上游一致性）+ 桌面包的 build/typecheck/test + runtime closure + loader/profile boot smoke + packaged-runtime + license。
6. **升级（无缝衔接）**：官方发版 → 独立提交同时更新 `gitlink` + `upstream.json` + 运行时依赖版本 → `yarn check` 全绿。

## 6. 发布前待办（当前占位）

- [ ] appId 改为自有反向域名（`package.json` build.appId + `src/main.ts` setAppUserModelId）
- [ ] 更新/下载端点（`update-checker.ts` / `update-download.ts`）并启用 `desktop-updates`
- [ ] 应用图标与托盘图标替换（`build/`）
- [ ] npm 包名与发布策略（如需发布 npm）
- [ ] Windows 代码签名证书（`CSC_*` 环境变量），消除 SmartScreen 提示
- [ ] GitHub Actions Windows runner 构建 CI

## 7. Windows 本机构建前置条件

electron-builder 打包时 `@electron/rebuild` 会把 node-pty 等原生模块按 **Electron ABI** 从源码重编，因此本机出包需要：

1. **Python**（node-gyp 依赖）：`winget install Python.Python.3.12 --scope user`
2. **Visual Studio 2022 Build Tools**（VC++ 工作负载，node-gyp 编译 C++ 依赖）：
   `winget install Microsoft.VisualStudio.2022.BuildTools -e --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`

GitHub Actions 的 `windows-latest` runner 自带以上工具链，CI 出包无需本机安装。`.electron-cache/`（Electron 二进制缓存）与 `dsh-plugin-desktop/dist/`、`lib/` 均已被 .gitignore 排除。

**node-pty Spectre patch**：node-pty 1.1.0 在 `binding.gyp` 中硬编码 `SpectreMitigation: 'Spectre'`，要求 VS 2022 的 Spectre 缓解库组件（不属于 VCTools 推荐集）。本仓库通过 `patches/node-pty@1.1.0.patch`（Yarn patch，见根 `package.json` resolutions）移除该设置，使 Electron ABI 重编在任何 Windows 主机/CI 上都能完成。
