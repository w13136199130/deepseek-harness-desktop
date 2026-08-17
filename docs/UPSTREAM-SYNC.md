# 上游同步操作手册（Upstream Sync）

DeepSeek Harness Desktop 不 fork、不修改官方源码。官方 DeepSeek Harness 更新时，本仓库需要同步**两个版本面**：

1. **源码 commit**：`deepseek-harness/` submodule 的 gitlink + `upstream.json.commit` + `sourceVersion` —— 用于开发对齐与版本记录。
2. **运行时 npm family**：`upstream.json.runtimePackageVersion` + `deepseek-harness-desktop/package.json` 中全部 `@deepseek-ai/dsh-*` 依赖 —— 构建与用户安装实际使用。

两者可独立更新（参考项目即源码 `0.1.0-rc.5` + 运行时 `0.1.0-rc.6`）。

## 完整操作步骤

### 1. 查看官方最新版本

```sh
cd deepseek-harness
git fetch origin
git log --oneline origin/master -5     # 最新源码提交
git tag -l | tail -5                    # 或看官方 tag
cd ..
npm view @deepseek-ai/dsh version      # 最新 npm 运行时 family（含 -rc 预发布需 npm view dist-tags）
```

### 2. 锁定新的官方 commit（submodule 只读，永不改代码）

```sh
cd deepseek-harness
git checkout <新commit或tag>
git rev-parse HEAD        # 记下新 SHA
cd ..
```

### 3. 更新 `upstream.json`

```json
{
  "repository": "https://github.com/deepseek-ai/deepseek-harness.git",
  "commit": "<第 2 步的新 SHA>",
  "sourceVersion": "<deepseek-harness/package.json 的 version>",
  "runtimePackageVersion": "<新的 npm family，如 0.1.0-rc.7>"
}
```

> 若 npm 尚未发布新 family：`runtimePackageVersion` 保持不变，跳过第 4 步。

### 4. 提升运行时依赖

把 `deepseek-harness-desktop/package.json` 中**全部** `@deepseek-ai/dsh*` 依赖从旧版本改为新 family（它们当前都是精确版本 `0.1.0-rc.6`，整体替换即可）。同时检查根 `package.json` 的 `resolutions`：

- `koffi@npm:^3.1.0` → `3.1.5`：若上游新版本要求更高 koffi，同步升级。
- `dsh-sandbox-windows-acl` patch：若官方已修复 STARTF_USESHOWWINDOW 问题，删除该 patch；否则为 npm 新版本重新生成。
- `node-pty` patch：node-pty 若升级，需按 [docs/BLUEPRINT.md](BLUEPRINT.md) 第 7 节重新打 Spectre patch。
- `electron` peer：上游若要求更高 Electron，同步升级。

### 5. 重装依赖 + 全量验证

```sh
git add deepseek-harness          # 记录新 gitlink（160000）
corepack yarn install             # 依赖变更时更新 yarn.lock
corepack yarn check               # 布局门禁 + build/typecheck/test/闭包/许可 全量验证
```

`yarn check:layout` 会强制一致性：submodule commit == `upstream.json.commit`、submodule 工作树干净、`@deepseek-ai/dsh-*` 依赖 == `runtimePackageVersion`、无 `workspace:`/`file:` 源码链接绕过。

官方 API 若有破坏性变更，会在 typecheck/build 期暴露——这正是"无缝衔接"的兜底机制：问题在构建期出现，而不是用户运行期崩溃。

### 6. 提交升级（独立提交）

```sh
git add upstream.json deepseek-harness-desktop/package.json yarn.lock deepseek-harness
git commit -m "chore(upstream): sync deepseek-harness <SHA前10位> (source rc.X / runtime rc.Y)"
```

### 7. 发布新安装包

```sh
corepack yarn dist:win     # 或推送后由 CI 构建
```

产物更新到 GitHub Release / 自建更新端点。当前 `desktop-updates` 行默认禁用（端点未部署），部署后将 `cordis.patch.yml` 中 `enabled` 改回 `true`。

## 常见情况速查

| 情况 | 处理 |
| --- | --- |
| 官方只发 npm family，源码未发 commit/tag | 只升 `runtimePackageVersion` + 依赖；submodule 可保持不动 |
| 官方源码改了桌面注入的服务 API（如 webServer/webRuntime） | typecheck 暴露 → 调整 `deepseek-harness-desktop/src/` 对应行 |
| `dsh-sandbox-windows-acl` 内容变化 | 检查 `patches/` 是否需要重生成或删除 |
| 新版本要求更高 koffi / electron / node-pty | 同步升级 resolutions、peerDependencies 与对应 patch |
| `git fetch origin` 网络失败 | 重试；或从本机官方 checkout 拉取：`git -C deepseek-harness fetch <本地checkout路径>` 后 checkout 对应 commit |

## 备注

- 本机开发用的官方 checkout（如 `E:\space\my_space\deepseek-harness-desktop`）与 wrapper 的 submodule 相互独立；wrapper 构建只依赖 npm 发布包，该 checkout 仅作参考，可留可删。
- 升级永远在**独立提交**中进行（gitlink + 元数据 + 依赖一起），保证 `verify-layout` 的一致性检查随时可复现。
