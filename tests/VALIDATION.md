# V0 验证记录

开发环境：macOS，本地 Vite，Codex 内嵌 Chromium 浏览器。

已验证：

- Audio Spike 先于完整 App 实现并在浏览器运行。
- 真实 OfflineAudioContext 渲染：A、双 voice crossfade、B、Judging 原曲继续与最终 30% gain。
- 32 秒完整 WAV 导入 → Not Prepared → 编辑器整曲波形。
- Start 2.0 秒再经键盘右移到 2.1 秒、End 6 秒：PRE 正确显示 2.1 秒。
- Preview 播放头到 6.9 秒（越过 6 秒 Segment End）。
- Save 后现场选择器出现 AVAILABLE 曲目；READY 提前解码。
- START 双击不会重复调度；导航在播放中锁定。
- 自动 DANCER B → JUDGING，原曲播放头继续到 13.6 秒。
- END 后返回 NEW ROUND；选择器显示 PLAYED，直接点击可再次 READY。

实际听感与移动系统行为仍需使用本地音乐在 iPhone / Android 真机与现场音响测试。自动化验证不等同于人工听感验收。

补充最终验证：

- 16 项 OfflineAudioContext 渲染断言全部通过，包括重复 START、提前 END 取消未来音源、无效 Segment 拒绝、A/B 对应采样位置一致。
- 390 × 844 与 375 × 667 布局无横向溢出，主按钮高度 57px；375 × 667 下主按钮底部为 607px，处于首屏范围。
- 鼠标/触摸式拖动 End handle 从 6.0s 移动至 17.5s，数值与波形选区同步更新。
- 刷新后 IndexedDB 恢复准备好的 Segment、played 状态与原始 WAV，重新进入编辑器可再次 decode。
- TypeScript 检查、生产构建、Node 状态机与曲线回归全部通过。
