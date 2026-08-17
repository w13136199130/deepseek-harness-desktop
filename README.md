# DeepSeek Harness Desktop（DSH Desktop）

面向 Windows 与 macOS 的 DeepSeek Harness 桌面客户端：把官方 DSH 的本地 Web UI、Host 服务与插件系统装进原生桌面应用。

- 官方 Harness 以**固定版本原样运行**（源码以 submodule 锁定，运行时使用官方 npm 发布包）。
- Desktop 负责窗口、托盘、终端、更新与工作配置，并以**官方 Cordis 插件机制**与 Harness 组合。
- 本项目**不 fork、不修改官方源码**；官方更新 = 升 submodule commit + 升运行时包版本，见 [docs/BLUEPRINT.md](docs/BLUEPRINT.md)。

## 目录结构

```
├── package.json            Yarn 4 workspace 根（resolutions / dependenciesMeta / 脚本）
├── .yarnrc.yml             nodeLinker: node-modules、enableScripts: false
├── upstream.json           官方仓库 / commit / sourceVersion / runtimePackageVersion
├── patches/                electron-builder 与 dsh-sandbox-windows-acl 的 Yarn patch
├── scripts/verify-layout.mjs  布局与上游一致性门禁（yarn check:layout）
├── deepseek-harness/       git submodule —— 官方源码（只读，锁定 commit）
└── dsh-plugin-desktop/     桌面产品包（Electron 壳 + Cordis 插件行）
```

## 快速开始

```sh
git submodule update --init --recursive
corepack yarn install --immutable
corepack yarn check
corepack yarn dev
```

## 打包

```sh
corepack yarn dist:win    # Windows x64 NSIS 安装包（需在原生 Windows 上执行）
corepack yarn dist:mac    # macOS 应用（需在 macOS 上执行）
```

## 发布前必改项（当前为占位）

- `dsh-plugin-desktop/package.json` 的 `build.appId`（当前 `com.example.deepseek-harness-desktop`）
- `dsh-plugin-desktop/src/update-checker.ts` / `update-download.ts` 的更新与下载端点（当前 `updates.example.com` 占位，自动检查默认禁用）
- 应用图标（`dsh-plugin-desktop/build/`，当前沿用上游参考图标）
