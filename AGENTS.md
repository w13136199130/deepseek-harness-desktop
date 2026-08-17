# AGENTS.md

本仓库是 DeepSeek Harness Desktop（DSH Desktop）产品工作区（wrapper repo）：所有桌面代码位于 `dsh-plugin-desktop/`，官方 DeepSeek Harness 源码以只读 submodule 形式固定在 `deepseek-harness/`。

## 红线

- **永不修改 `deepseek-harness/` 内的官方源码**（submodule 视为只读内容）。
- **常规构建只从 npm registry 解析已发布的 `@deepseek-ai/dsh-*` 包**，不得使用 `workspace:` / `link:` / `portal:` / 指向 deepseek-harness 的 `file:` 依赖。
- 更新上游必须在独立提交中同时更新 `gitlink`、`upstream.json` 与 `dsh-plugin-desktop` 的运行时依赖版本（`runtimePackageVersion`），并跑通 `yarn check`。

## 常用命令

```sh
corepack yarn install --immutable
corepack yarn check          # 布局门禁 + dsh-plugin-desktop 全量验证（build/typecheck/test/verify）
corepack yarn dev            # 构建并启动桌面应用
corepack yarn dist:win       # Windows NSIS 安装包（原生 Windows）
```

## 参考

- [docs/BLUEPRINT.md](docs/BLUEPRINT.md) —— 架构、命名、路径与实现思路
- [dsh-plugin-desktop/README.md](dsh-plugin-desktop/README.md) —— 桌面包说明与验证门禁
