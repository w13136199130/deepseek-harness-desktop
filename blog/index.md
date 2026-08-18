# DeepSeek Harness Desktop 技术博客

> 基于 Electron + DeepSeek Harness（DSH）的桌面应用技术解析
>
> 产品名：**DeepSeek Harness Desktop**（短名 *DSH Desktop*）｜ 当前版本：`0.1.0`

![对话主界面](assets/conversation.png)

*图：DSH Desktop 主界面 —— 基于官方 DeepSeek Harness Web UI，运行在 Electron 沙箱 renderer 中*

---

## 目录

- [1. 项目简介](#1-项目简介)
- [2. 功能点](#2-功能点)
- [3. 架构设计](#3-架构设计)
- [4. 如何使用](#4-如何使用)
- [5. 开发](#5-开发)
- [6. 打包发布](#6-打包发布)
- [7. 技术要点与设计取舍](#7-技术要点与设计取舍)
- [8. 仓库地址](#8-仓库地址)

---

## 1. 项目简介

**DeepSeek Harness Desktop**（DSH Desktop）是一个把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）**原样运行**在 Electron 桌面壳中的产品。它以 **Cordis / Loader 插件行** 的方式组合桌面能力，而不是 fork 官方源码：

- 官方源码以**只读 submodule** 固定在 `deepseek-harness/`，零 fork、零修改；
- 官方更新 = 升级 submodule commit + 升级运行时包版本；
- 桌面能力以 `desktop-shell`、`desktop-profiles`、`desktop-terminal`、`desktop-updates`、`desktop-pnpm` 等 Host 插件行实现，随官方 Loader 挂载、随 generation dispose。

它的核心思路一句话总结：

> **桌面端 = Electron 宿主 + 官方 DSH 运行时（原样运行），以 Cordis 插件行实现的桌面能力。**

---

## 2. 功能点

### 2.1 双呈现模式

| 模式 | 说明 |
| --- | --- |
| **compatibility**（兼容，默认） | 原生边框普通窗口 + 官方 Web UI，官方插件行原样保留 |
| **advanced**（高级） | Windows 11 Mica / macOS 原生 vibrancy、隐藏式标题栏、原生材质。仅 macOS 与 Windows |

模式单一事实源位于 DSH home 的 `settings.yaml`：

```yaml
deepseek-harness-desktop:
  mode: compatibility # 或 advanced
```

> Linux 只支持兼容模式，advanced 值会被拒绝而非静默降级。

### 2.2 桌面能力

- **托盘**：列出现有 profile、可切换激活 profile、打开隔离 DSH 终端、检查更新、切换模式、请求退出；托盘文案跟随系统语言（中文系统显示中文）。
- **Profile 管理**：`desktop`（Launcher 管理）与 `web` 默认项；切换 profile 以"先持久化、再有序重启"生效；有 last-known-good 回滚保护。
- **DSH 终端**：以当前激活 profile 为工作目录打开系统终端，内置私有 `dsh` / `pnpm` / `node` shim，不改全局环境。
- **内置 pnpm**：Electron 充当 Node 运行时，把内置 pnpm 前置到进程 `PATH`，开箱即用，无需系统安装 Node。
- **更新检查**：查询稳定版本端点，后台静默检查 + 托盘手动检查，支持下载 DMG（macOS）/ NSIS 安装器（Windows）。
- **Windows ACL 沙箱**：保留上游 `pwsh-sandbox` 行为与 ACL confinement，fail-closed 绝不无沙箱回退。

### 2.3 安全模型

- renderer 开启 `contextIsolation` 与 Chromium sandbox，关闭 Node integration；
- **无 preload bridge**，renderer 不获得原始 Electron API；
- 导航/重定向被限制在确切的 loopback origin（`127.0.0.1` 临时端口）。

---

## 3. 架构设计

### 3.1 总体结构

```
DeepSeek Harness Desktop.exe（自包含：Electron + Node 运行时 + pnpm + 官方 DSH npm 包）
└── Electron main 进程
    ├── 单实例锁
    ├── 内置 pnpm 运行时（ELECTRON_RUN_AS_NODE，Electron 充当 Node）
    ├── boot() 启动官方 Host Cordis 根（@deepseek-ai/dsh-app-boot）
    │   └── profile = 官方 dsh-base + dsh-web-app + 桌面行（cordis.patch.yml insert，不落盘）
    │       └── Host 绑定 127.0.0.1 临时端口 loopback HTTP/WebSocket
    └── desktop-shell 创建 BrowserWindow（sandbox:true / nodeIntegration:false / contextIsolation:true）
        └── 加载同源官方 Web UI —— renderer 零 Electron API、零 preload bridge
```

### 3.2 关键设计

- **官方能力原样**：agent / 模型 / 工具 / 会话 / 设置 / 沙箱 / Web UI 全部来自官方 npm 包；
- **桌面能力是插件行**：`desktop-shell`（窗口/托盘/生命周期）、`desktop-terminal`、`desktop-pnpm`、`desktop-profiles`、`desktop-updates`；
- **共享 loopback carrier**：两种模式都复用官方 loopback HTTP/WebSocket，而非 Electron IPC；
- **服务寻址**：Launcher 通过 `ctx.desktopProfiles`、`ctx.desktopPnpm` 等作用于当前 generation 的 Cordis service 暴露能力，不是 renderer bridge；
- **更新/升级**：官方源码零 fork，上游同步 = gitlink + `upstream.json` + `runtimePackageVersion` 三处同时更新。

### 3.3 仓库拓扑

```
dsh-desktop/                    本地 checkout 目录
├── deepseek-harness/           submodule（gitlink，官方源码只读）
├── deepseek-harness-desktop/   workspace 成员（发布为 npm 包）
├── docs/                       蓝本、上游同步说明、截图
├── blog/                       本博客
├── scripts/verify-layout.mjs   布局与上游一致性门禁
└── package.json / upstream.json / .gitmodules / yarn.lock
```

---

## 4. 如何使用

### 4.1 环境要求

- 安装 Git；
- Node.js `22.x`（打包推荐与 CI 一致的 `22.23.2`）；
- Corepack（`corepack enable`）或随 Node 提供。

### 4.2 安装依赖

```sh
corepack yarn install --immutable
```

### 4.3 启动应用

有图形会话时，显式启动桌面应用（`dev` 会在启动前自动构建）：

```sh
corepack yarn dev
```

### 4.4 命令行启动

全局安装 npm 包后，可直接以命令启动：

```sh
npm install -g deepseek-harness-desktop   # 会自动安装 electron peer
dsh-desktop                                # 别名
```

或在 profile 内安装：

```sh
dsh plugin --profile desktop add deepseek-harness-desktop
dsh plugin --profile desktop add electron   # 需要命令行启动时手动补 electron peer
```

### 4.5 插件工作流

```sh
dsh plugin --profile desktop add third-party-plugin
dsh plugin --profile desktop remove third-party-plugin
dsh plugin --profile desktop update
```

默认 profile 为 `desktop`；可通过托盘 **Profile** 子菜单切换其他 Web-capable profile（切换会重启应用）。

### 4.6 无 Electron 的 headless 入口

```sh
node lib/bin.js --help
node lib/bin.js --version
```

---

## 5. 开发

### 5.1 常用命令

| 命令 | 说明 |
| --- | --- |
| `corepack yarn install --immutable` | 安装依赖（冻结 lockfile） |
| `corepack yarn check` | 布局门禁 + 全量验证（build / typecheck / test / verify） |
| `corepack yarn dev` | 构建并启动桌面应用 |
| `corepack yarn package:dir` | 生成当前平台的未封装目录产物 |
| `corepack yarn dist:win` | Windows x64 NSIS 安装包（原生 Windows） |

### 5.2 验证

`yarn check` 会：

- 验证生产依赖图中每个必需第一方 peer 都由 desktop deploy root 声明；
- run Headless Loader smoke：激活 launcher 桌面行 + profile 本地第三方行，启动已发布 Web profile，检查 loopback 根页面与 client manifest；
- 跑单元 + 类型测试，覆盖两种 profile 组合、重启栅栏、client environment 校验、desktop layout 状态与各平台原生窗口选项。

### 5.3 目录速览

```
src/              桌面包源码（main / client / update-checker / tray-labels …）
tests/            单元与类型测试
scripts/          布局门禁、打包辅助
build/            tray-icon.svg 等图标源；由它派生各平台图标
docs/             蓝本、截图、上游同步说明
dist/             打包产物（gitignore）
```

---

## 6. 打包发布

### 6.1 Windows x64 本地安装包

在**原生 Windows x64** 电脑上，打开 PowerShell：

```powershell
git submodule update --init --recursive
corepack.cmd yarn install --immutable
corepack.cmd yarn dist:win
```

`dist:win` 特点：

- 拒绝非 Windows / 非 x64 宿主；
- 先跑一组 Windows 可运行的 gate（build、全部 TS compiler face、打包 + 原生 shell 聚焦测试、runtime-closure verifier），再构建 NSIS 向导并校验两个 PE 文件；
- 不要求 Python 或 Visual Studio C++ Build Tools（直接用 `node-pty` 内置的 x64 Node-API 二进制，不从源码重编）；
- 产物：`deepseek-harness-desktop\dist\deepseek-harness-desktop-0.1.0-x64-setup.exe`；
- 本地命令默认 `signExecutable=false` 并移除证书变量 —— 产物可安装测试，但 **无 Authenticode 签名**，Windows 可能显示 Unknown publisher / SmartScreen 警告。

### 6.2 图标派生

`build/tray-icon.svg` 是唯一品牌蓝源文件，构建过程从中派生：

- Windows / Linux 应用图标 `build/app-icon.png`；
- macOS Dock 图标 `build/app-icon-mac.png`；
- macOS 模板图与固定品牌蓝的 Windows/Linux 托盘图。

---

## 7. 技术要点与设计取舍

- **零 fork**：官方源码 submodule 只读，桌面能力全部以插件行实现；上游同步走独立的"gitlink + upstream.json + runtimePackageVersion"三合一流程。
- **Ambient pnpm**：Electron 内置固定版本 pnpm 前置到当前进程 `PATH`，Host 与第三方插件可发现它；不会修改系统 `PATH`、shell 启动文件或 profile 配置。
- **安全边界**：`desktopPnpm.run()` / `runPlugin()` 使用准确打包 entry、无 shell argv、child-only 的 DSH home 与 Electron-backed Node，公开 runtime path 不暴露 `node` 或 `dsh`。
- **更新交接**：只验证下载容器，不验证 publisher 身份 —— 签名、Authenticode 校验、SmartScreen 信誉仍是发布 gate。
- **已知暂缓**：切换 profile/模式按设计重启；Linux 无高级模式与桌面终端命令；共享 carrier 用 loopback H/W 而非 Electron IPC（需上游提供 transport 扩展点）；`dshmarket@1.2.3` 仍是用户可选安装的第三方包而非内置 marketplace。
- **固定版本族**：当前固定已发布 DSH `0.1.0-rc.6` family；`deepseek-harness/` 源码 checkout 早于该版本，因此测试验证的是已发布包接口而非上游未发布源码。

![设置界面](assets/settings.png)

*图：DSH Desktop 设置界面 —— 依托官方 settings 界面与桌面自有 settings namespace*

---

## 8. 仓库地址

| 平台 | 地址 |
| --- | --- |
| **GitHub（主仓库）** | https://github.com/w13136199130/deepseek-harness-desktop |
| Gitee（镜像） | https://gitee.com/shierai/deepseek-harness-desktop |

```sh
# 克隆（GitHub）
git clone --recurse-submodules https://github.com/w13136199130/deepseek-harness-desktop.git

# 或 Gitee 镜像
git clone --recurse-submodules https://gitee.com/shierai/deepseek-harness-desktop.git
```

> 注意：仓库含官方 `deepseek-harness/` submodule，克隆时请加 `--recurse-submodules`，或克隆后执行 `git submodule update --init --recursive`。

---

*License: MIT · 本文档随 repo 维护于 `blog/index.md`，效果图位于 `blog/assets/`（源自 `docs/screenshots/`）。*
