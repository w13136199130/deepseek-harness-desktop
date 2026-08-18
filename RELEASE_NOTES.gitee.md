# DeepSeek Harness Desktop v0.1.0

> 面向 Windows 与 macOS 的 DeepSeek Harness 桌面客户端。内置 Electron、Node.js、pnpm 与固定版本的官方 DSH 依赖，无需配置命令行环境，下载安装即可使用。
>
> 社区维护的开源项目，并非 DeepSeek 官方产品。

---

## 下载

| 平台 | 安装包 | 说明 |
| --- | --- | --- |
| Windows x64 | deepseek-harness-desktop-0.1.0-x64-setup.exe | NSIS 安装程序，支持自定义安装目录、开始菜单与桌面快捷方式 |
| macOS | deepseek-harness-desktop-mac-x64-unsigned.zip | 未签名应用包，解压后拖入 Applications 使用 |

> 未签名说明：本版本产物未签名。Windows 安装时可能显示 "Unknown publisher" 或 SmartScreen 警告（点击「更多信息 → 仍要运行」即可）；macOS 首次打开需在「系统设置 → 隐私与安全性」中允许。正式签名与公证是后续独立发布门禁。

## 功能亮点

- 原生桌面体验：Electron 窗口 + 系统托盘，托盘菜单跟随系统语言（中文系统显示中文），应用图标统一品牌蓝。
- 双呈现模式：
  - 兼容模式（默认）：普通原生窗口 + 官方 DSH Web UI，官方插件行原样保留；
  - 高级模式（Windows / macOS）：Windows 11 Mica 毛玻璃、macOS 侧边栏 vibrancy、隐藏式标题栏与原生材质。
- 零 fork 架构：官方 DeepSeek Harness 以固定版本原样运行（源码 submodule 锁定、运行时使用官方 npm 发布包），Desktop 只提供窗口、托盘、终端、更新与工作配置，通过官方 Cordis 插件机制组合。
- 自包含运行时：内置 pnpm 与 Electron-as-Node，用户无需安装 Node.js / pnpm / DSH。
- 工作配置（Profile）：通过托盘切换 DSH profile；Windows 工作区选择默认列出所有盘符，任意卷可达。
- DSH 终端：托盘一键打开以当前 profile 为工作目录的系统终端（macOS Terminal / Windows PowerShell 7 或 cmd），内置私有 dsh、pnpm、node shim，不改全局环境。
- 更新检查：内置产品更新端点（当前默认禁用，端点部署后启用）。
- Windows 安全沙箱：PowerShell 执行保持上游 ACL 受限令牌沙箱，fail-closed，不自动降权。

## 首次使用

1. 下载对应平台的安装包并安装（macOS 拖入 Applications）。
2. 首次启动自动创建默认 desktop profile，并启动官方 DSH Web 界面。
3. 通过托盘菜单可切换 profile、切换呈现模式、打开 DSH 终端。

## 系统要求

| 平台 | 要求 |
| --- | --- |
| Windows | x64（Windows 10 / 11；高级模式的 Mica 材质需 Windows 11 22H2+） |
| macOS | x64（macOS 13+，建议） |

> 高级模式暂不支持 Linux；Linux 仅兼容模式。

## 常见问题

- Windows 提示 "Unknown publisher" / SmartScreen：产物未签名，属预期行为，点击「更多信息 → 仍要运行」继续。
- macOS 提示无法打开：未公证应用需在「系统设置 → 隐私与安全性」中点击「仍要打开」。
- 首次启动较慢：首次会创建 profile 并初始化官方 DSH 运行时，属正常现象。

## 与官方项目的关系

本项目基于 deepseek-ai/deepseek-harness 构建，是对 DSH 桌面体验的社区实现。核心智能体、模型、工具、会话、Web UI 与插件生态均来自官方项目，Desktop 负责桌面应用封装与原生体验。若需从命令行运行 Harness 或参与核心功能开发，请优先查看官方仓库。

## 仓库地址

- GitHub（主仓库）：https://github.com/w13136199130/deepseek-harness-desktop
- Gitee（镜像）：https://gitee.com/shierai/deepseek-harness-desktop

## License

MIT License。本项目是独立的社区项目，与 DeepSeek 官方没有隶属关系，也未获得其背书；DeepSeek 是 DeepSeek AI 的商标。
