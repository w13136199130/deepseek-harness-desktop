# 发布操作手册（GitHub + Gitee 双平台）

DeepSeek Harness Desktop 同时在 **GitHub（主仓库）** 与 **Gitee（镜像）** 维护。GitHub 的安装包由 CI 自动构建发布；Gitee 没有 GitHub Actions，发行版需要手动同步。本文记录从「没有 tag」到「用户可下载 win/mac 安装包 + 发布说明」的完整步骤。

## 仓库与远端

| 平台 | 远端名 | 地址 |
| --- | --- | --- |
| GitHub | `origin` | https://github.com/w13136199130/deepseek-harness-desktop.git |
| Gitee | `gitee` | https://gitee.com/shierai/deepseek-harness-desktop.git |

> 注意：本仓库 `main` 分支的上游（upstream）是 `gitee`。**不带 remote 的 `git push` 默认推 Gitee**，发布时 tag 必须显式指定 remote（见下文），不要用裸 `git push` 推 tag。

## 发布机制

- **GitHub**：`.github/workflows/release.yml` 监听 `v*` 标签推送。触发后并行运行两个 job：
  - `windows`：`yarn dist:win` 构建 NSIS 安装包 `deepseek-harness-desktop-<version>-x64-setup.exe`；
  - `macos`：`package:dir` 构建未签名 .app 并压缩为 `deepseek-harness-desktop-mac-x64-unsigned.zip`；
  - 两者都通过 `softprops/action-gh-release` 上传到该 tag 的 GitHub Release，并以 `body_path` 引用仓库根目录的 **`RELEASE_NOTES.md`** 作为发布说明（Release Notes）。
- **Gitee**：镜像仓库**不会**自动同步 GitHub 的 Release 产物，需在 Gitee 网页手动创建「发行版」。

> **发布说明单一事实源**：`RELEASE_NOTES.md` 是发布说明（描述）的唯一来源。每次发布前必须更新其中的版本号、下载表与内容；GitHub Release 会自动使用它，Gitee 手动创建时复制同一份文本。

## Gitee 发行版注意事项（实测）

- **附件 100MB 上限**：Gitee 发行版单文件附件上限 100MB，Windows 安装包（约 188MB）与 macOS zip 均超限，**无法直接上传**。Gitee 发行版应保留标签与描述，并在描述中引导用户从 GitHub Release 下载安装包（见 `RELEASE_NOTES.gitee.md` 的「下载说明」）。
- **body 校验敏感**：Gitee 创建/更新发行版的 `body` 字段对 **markdown 反引号（backtick）** 敏感——含反引号的 JSON 请求会被拒绝（`body is invalid`）。`RELEASE_NOTES.gitee.md` 是去掉反引号的 Gitee 专用版本。
- **用表单方式提交**：Gitee API 对 JSON 字节 body 的校验不稳定，改用 `application/x-www-form-urlencoded` 提交（`-Body` 传 hashtable）稳定成功：
  ```powershell
  $form = @{ tag_name = "v0.1.0"; name = "v0.1.0"; body = $body; prerelease = "false"; target_commitish = "main" }
  Invoke-RestMethod -Method Post -Uri "https://gitee.com/api/v5/repos/$owner/$repo/releases?access_token=$token" -Body $form -ContentType "application/x-www-form-urlencoded"
  ```
- **删除有异步延迟**：删除发行版后立即重建同 tag 会报「该标签已经存在发行版」，删除后等待数秒再创建。
- 更新发行版描述用 `PATCH /releases/{id}`，同样用表单方式与完整字段（tag_name/name/body/target_commitish）。

## 首次发布步骤（例如 v0.1.0）

### 1. 提交发布前代码

确认工作树干净，`yarn check` 通过（含布局门禁与全量验证）。**更新 `RELEASE_NOTES.md`**（版本号、下载表、功能说明），并把 `.github/workflows/release.yml`、`RELEASE_NOTES.md`、`docs/RELEASE.md` 等改动提交推送到 GitHub `main`：

```sh
git push origin main
```

### 2. 打标签（必须以 `v` 开头，否则 CI 不触发）

```sh
git tag -a v0.1.0 -m "v0.1.0"
```

### 3. 推送标签到 GitHub，触发 CI

```sh
git push origin v0.1.0
```

### 4. 等待 GitHub Actions 完成

打开仓库 Actions 页面（https://github.com/w13136199130/deepseek-harness-desktop/actions），等待 `windows` 与 `macos` 两个 job 全部通过。任一个失败都会导致对应产物缺失（`fail_on_unmatched_files: true` 时 Release 创建也会失败）。

### 5. 验证 GitHub Release

打开 https://github.com/w13136199130/deepseek-harness-desktop/releases/latest ，应看到：

- `deepseek-harness-desktop-0.1.0-x64-setup.exe`（Windows x64 安装程序）
- `deepseek-harness-desktop-mac-x64-unsigned.zip`（macOS 未签名应用）
- 自动使用 `RELEASE_NOTES.md` 作为发布说明（描述）

README 中「下载与安装」表格指向的 `/releases/latest` 链接此时即可用，徽章（release 版本、下载数）也会自动点亮。

### 6. 同步 Gitee 镜像

先把代码与标签推送到 Gitee：

```sh
git push gitee main
git push gitee v0.1.0
```

再在 Gitee 网页手动创建发行版，或用 Gitee API（见上文「Gitee 发行版注意事项」）：

1. 打开 https://gitee.com/shierai/deepseek-harness-desktop/releases（仓库页 → 「发行版」）。
2. 点击「新建发行版」。
3. 选择刚推送的标签 `v0.1.0`；标题与描述使用 `RELEASE_NOTES.gitee.md`（去反引号版本）内容。
4. **不要上传安装包附件**（100MB 上限，超限会失败）；描述中已含 GitHub Release 下载链接。
5. 点击「创建」。

### 7. （可选）README 增加 Gitee 下载入口

README 下载表目前只指向 GitHub Releases。若希望 Gitee 用户也能直接下载，可在表格中追加一行 Gitee 发行版链接；若 Gitee 只作为源码镜像，则保持现状即可。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 推送 tag 后 Actions 没有运行 | tag 名不是 `v*` 开头（如 `0.1.0` 而非 `v0.1.0`）；删除并重新打正确的 tag |
| tag 推到 Gitee 后 Actions 报错 | Gitee 不运行 GitHub Actions，属正常现象；GitHub 侧成功即可 |
| Release 创建失败：找不到产物 | 某个 job 构建失败；查看 Actions 日志定位（常见：`dist:win` 的 gate、macOS `package:dir`、产物名不匹配 glob） |
| macOS job 一直排队不执行 | GitHub 已下线 `macos-13` runner 镜像（2025-12-08 移除），workflow 必须使用 `macos-15-intel`（x64）等仍在维护的 runner；检查 `.github/workflows/release.yml` 的 `runs-on` |
| Release Notes 为空或与仓库不符 | 确认 `RELEASE_NOTES.md` 已提交并推送，且 workflow 中 `softprops/action-gh-release` 带 `body_path: RELEASE_NOTES.md`（已在仓库内配置） |
| Gitee 附件上传超限 | Gitee 发行版附件上限 100MB，安装包无法上传；在发行版描述中提供 GitHub 下载链接（已在 `RELEASE_NOTES.gitee.md` 中处理） |
| Gitee body is invalid | body 含 markdown 反引号会被拒绝；使用 `RELEASE_NOTES.gitee.md` 并以 `application/x-www-form-urlencoded` 方式提交 |
| 未签名警告 | Windows 安装包默认未签名（SmartScreen / Unknown publisher），macOS 应用未公证；正式签名与公证是独立发布门禁，见 `deepseek-harness-desktop/README.md` 与 `docs/BLUEPRINT.md` |

## 版本升级时的增量操作

后续版本只需：

```sh
# 1. 提升版本号（deepseek-harness-desktop/package.json）并提交推送
# 2. 打新 tag 并推送 GitHub / Gitee
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
git push gitee v0.2.0
# 3. 等待 GitHub Actions，Gitee 手动创建发行版并同步产物与描述
```
