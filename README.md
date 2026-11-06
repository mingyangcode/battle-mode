# Battle Mode

面向街舞 Battle 的音乐准备与现场播放工具。

React + TypeScript + Vite。音乐保存在浏览器 IndexedDB；快速分析及 MusiCNN 优化在浏览器完成，无需分析服务器。

## 开发

pnpm install --frozen-lockfile
pnpm dev

## 验证与构建

pnpm test
PAGES_BASE=/battle-mode/ pnpm build:pages

## 发布

仓库：https://github.com/mingyangcode/battle-mode
在 Settings → Pages 中选择 GitHub Actions，再运行 Deploy Battle Mode 工作流。
预计网站：https://mingyangcode.github.io/battle-mode/ （发布成功前不可用）

## 第三方资源

见 public/notices。模型及示例媒体不因代码公开而自动获得无限制再分发许可；发布前须核对相应许可。手机 Safari 的本地模型验收仍待完成。

代码按 AGPL-3.0 开源。本次部署为非商业用途。第三方模型、音乐和封面分别遵循其自身许可，不纳入本项目代码许可证。
