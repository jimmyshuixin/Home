# 虚静以宁 - 个人主页

这是一个功能丰富、设计精美的个人主页项目，完全由单个 HTML 文件构成，集成了 Vue 3、动态背景、音乐播放器、AI 聊天机器人等多种功能。

[**在线预览**](https://xvyin.com/) 

![网站截图](https://github.com/user-attachments/assets/345d5fa5-ef00-417d-aa94-5b33476b2891)


---

## ✨ 功能特性

* **炫酷动态背景**: 基于 Canvas 实现的动态粒子背景，在深色模式下有漩涡效果。
* **响应式布局**: 兼容桌面、平板和移动设备，提供流畅的跨设备浏览体验。
* **明暗主题切换**: 支持手动切换浅色/深色主题，并能根据用户系统偏好或时间自动选择。
* **iOS 风格玻璃拟物特效**: 广泛应用的半透明玻璃效果，提升了界面的现代感和层次感。
* **浮动导航栏**: 导航栏在向下滚动时自动展开，向上滚动时收起，节省屏幕空间。
* **打字机动画**: 主页欢迎语采用动态打字机效果，生动有趣。
* **集成音乐播放器**:
    * 基于 APlayer.js，界面美观。
    * 自动从 QQ 音乐获取歌单。
    * 支持歌词同步滚动、播放列表、音量控制等功能。
* **模块化内容展示**:
    * **关于我**: 个性化的自我介绍。
    * **GitHub**: 自动拉取并展示您的 GitHub 仓库和贡献图。
    * **时光轴**: 以时间线的形式展示您的重要经历。
    * **目标进度**: 以进度条的形式可视化您的个人目标。
    * **我的笔记/书架**: 展示您的笔记或在读/推荐书籍。
* **AI 聊天机器人**:
    * 集成 **DeepSeek** API。
    * 支持 Markdown 格式渲染、代码高亮和一键复制。
    * 可配置模型参数（如温度）和启用网页搜索。
    * 安全存储 API Key 于本地。
* **其他细节**:
    * 流星风格滚动指示器。
    * 平滑滚动和元素加载动画。
    * 自动计算网站运行时间。

## 🛠️ 技术栈

* **前端框架**: [Vue.js 3](https://vuejs.org/) (Composition API)
* **样式**: 原生 CSS3，包含大量自定义样式和动画效果。
* **图标**: [Phosphor Icons](https://phosphoricons.com/)
* **音乐播放器**: [APlayer.js](https://github.com/MoePlayer/APlayer)
* **Markdown 解析**: [Marked.js](https://github.com/markedjs/marked)
* **AI 服务**: [DeepSeek API](https://platform.deepseek.com/)

## 🚀 如何运行

该项目不依赖任何构建工具，所有代码都在一个 `home.html` 文件中。

1.  **克隆仓库**
    ```bash
    git clone [https://github.com/YourUsername/YourRepoName.git](https://github.com/YourUsername/YourRepoName.git)
    ```
2.  **打开文件**
    直接用现代浏览器（如 Chrome, Firefox, Edge）打开 `home.html` 文件即可本地运行。

## ⚙️ 如何配置

大部分的可配置项都集中在 `home.html` 文件末尾的 `<script>` 标签内的 `setup()` 函数中。

```javascript
// --- Vue.js 应用逻辑 ---
const { createApp, ref, onMounted, onUnmounted, nextTick, watch } = Vue;

createApp({
    setup() {
        // --- 配置信息 ---
        // 1. 网站上线时间 (用于计算已运行天数)
        const VITE_SITE_START = "2024-01-01";
        
        // 2. ICP备案号 (如果在中国大陆部署)
        const VITE_SITE_ICP = "渝ICP备2025053763号-1";
        
        // 3. 音乐播放器歌单配置
        const VITE_SONG_API = "[https://api.injahow.cn/meting/](https://api.injahow.cn/meting/)"; // MetingJS API
        const VITE_SONG_SERVER = "tencent"; // 音乐平台: netease, tencent, kugou, xiami, baidu
        const VITE_SONG_TYPE = "playlist"; // 类型: song, playlist, album, search, artist
        const VITE_SONG_ID = "9206816111"; // 歌单 ID
        
        // ... 其他数据如 timeline, targets, bookshelf 等可在此处直接修改 ...

        const github = ref({
            repos: [],
            // 4. Github 贡献图 (替换 jimmyshuixin 为你的 Github 用户名)
            contributionsUrl: "[https://ghchart.rshah.org/jimmyshuixin](https://ghchart.rshah.org/jimmyshuixin)",
            // 5. Github 主页地址
            spaceUrl: "[https://github.com/jimmyshuixin](https://github.com/jimmyshuixin)",
        });

        // ...

        function fetchGithubData() {
            // 6. 获取 Github 仓库的 API (替换 jimmyshuixin 为你的 Github 用户名)
            fetch(
                "[https://api.github.com/users/jimmyshuixin/repos?sort=updated&per_page=6](https://api.github.com/users/jimmyshuixin/repos?sort=updated&per_page=6)"
            )
            //...
        }

        // ...
    }
}).mount("#app");
```

**AI 聊天机器人配置**:
AI 聊天机器人的 **API Key** 无需在代码中配置。用户首次使用时，在网页的输入框中填入自己的 DeepSeek API Key 即可。密钥会被保存在浏览器的 `localStorage` 中，下次访问时无需重新输入。

## 📄 开源许可

本项目采用 [MIT License](LICENSE) 开源。
