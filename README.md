# Yakimoji

## Codex Hook 说明

这个项目把 Codex 的 `Stop` hook 配置放在 [`.codex/hooks.json`](./.codex/hooks.json)。
这里故意通过仓库内的包装脚本 [`.codex/hooks/stop-hook.sh`](./.codex/hooks/stop-hook.sh) 作为入口，这样 Codex 配置就可以跟随项目，在不同机器上保持可移植。

这个包装脚本会在运行时解析项目根目录，然后再调用当前仓库里的 BMAD `story-automator` hook 脚本。

Claude 的 hook 配置独立放在 `.claude/settings.json`。
那个文件仍然可能使用绝对路径，因为 `bmad-story-automator` 的安装逻辑会把 Claude 的 hook 命令规范化成绝对路径。
