# Latte 主按钮文字对比度问题

## 1. 根因类别

- 类别：E，隐含假设。
- 具体原因：`apps/web/app/globals.css` 与 `apps/admin/app/globals.css` 的 `a { color: inherit }` 没有放进 Tailwind cascade layer。未分层规则会覆盖 `utilities` layer 中的 `.text-primary-foreground`。共享 `Button` 使用 `asChild` 包裹 Link 或 anchor 时，按钮文字因此继承正文 Text，而不是主题 Base。

## 2. 排查过程

1. 用户反馈 Blue 背景搭配暗色文字。先核对主题变量，Latte 的 `--theme-primary-contrast` 是 Base `#eff1f5`，色板映射没有错误。
2. 同一页面的 Latte 主题按钮文字正确，只有 `Button asChild` 链接错误。这个差异排除了共享 token 和 Tailwind utility 生成失败。
3. 浏览器计算样式显示“开始记录”为 Blue `rgb(30, 102, 245)` + Text `rgb(76, 79, 105)`；当前 stylesheet 同时包含 `.text-primary-foreground` 与未分层 `a { color: inherit }`。
4. 删除两个应用中的 `color: inherit` 后，旧开发进程仍提供旧 CSS chunk。重启 6153/6154 开发服务后，Web 和 Admin 的主按钮都变为 Blue `rgb(30, 102, 245)` + Base `rgb(239, 241, 245)`。

## 3. 预防措施

| 优先级 | 方式       | 动作                                             | 状态   |
| ------ | ---------- | ------------------------------------------------ | ------ |
| P0     | 代码       | 删除 Web/Admin 未分层 anchor 颜色覆盖            | 已完成 |
| P0     | 浏览器检查 | Latte 下读取 `Button asChild` 的背景和文字计算色 | 已完成 |
| P1     | 规范       | 在 UI 主题规范记录 cascade layer 覆盖规则        | 已完成 |
| P1     | 检查清单   | UI 质量检查增加 Link/anchor 按钮文字色           | 已完成 |

## 4. 扩展检查

- 相同问题同时存在于 Web 与 Admin，已一起修改。
- `rg -n "^a \\{|color: inherit" apps packages --glob '*.css'` 确认应用只保留 `text-decoration: none`。
- 共享 Button 本身不需要为 anchor 增加更高优先级或 `!important`；修复全局级联来源即可。
- 项目没有 `src/templates/markdown/spec/`，本次没有可同步的模板目录。

## 5. 已保存内容

- `.trellis/spec/ui/frontend/theme-guidelines.md`：新增未分层全局规则的错误与正确写法。
- `.trellis/spec/ui/frontend/quality-guidelines.md`：新增 `Button asChild` 颜色检查。
- 本文件保留计算色证据和开发服务旧 chunk 的排查过程。
