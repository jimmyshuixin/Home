# 虚静以宁 - 个人主页全栈项目

![GitHub stars](https://img.shields.io/github/stars/jimmyshuixin/Home?style=flat-square&logo=github)
![GitHub forks](https://img.shields.io/github/forks/jimmyshuixin/Home?style=flat-square&logo=github)
![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)
![Tech Stack](https://img.shields.io/badge/Tech-Vue.js%20%7C%20Cloudflare-06D6A0?style=flat-square)

这是一个高度可定制、功能丰富的现代化个人主页项目。前端基于原生 HTML/CSS/JavaScript 和 **Vue.js 3** 构建，后端完全由 **Cloudflare Workers** 驱动，构成了一套完整、安全、高性能的 **Serverless** 架构。

---

### ✨ [在线演示 (Live Demo)](https://xvyin.com/)
<img width="3199" height="1719" alt="图片" src="https://github.com/user-attachments/assets/b15cf6db-fc46-4bcf-9248-0f2f11d053a9" />


## 核心功能

### 🚀 前端 (index.html)
- **动态交互式仪表盘**: 通过卡片式布局清晰地展示个人简历、GitHub 仓库、博客文章、书架、兴趣爱好等。
- **集成 AI 聊天机器人**: 内置一个基于 [DeepSeek API](https://platform.deepseek.com/) 的 AI 对话助手，支持对话历史记录和参数调整。
- **实时留言板/弹幕**: 基于 Firestore 实现的实时留言功能，新消息会以弹幕的形式在主页顶部滚动。
- **自定义音乐播放器**: 支持切换和播放在线歌单，以及从本地文件夹读取音乐文件。
- **数据驱动内容**: 所有个人数据（如简历、项目、书单）都通过 JSON 和 Markdown 文件进行管理，方便更新。
- **美学设计**: 采用毛玻璃质感 (Glassmorphism) UI，支持浅色/深色模式自动切换和手动切换。
- **完全响应式**: 完美适配桌面、平板和手机设备。

### ☁️ 后端 (Cloudflare Workers Serverless API)
项目后端由四个独立的 Cloudflare Worker 代理服务构成，实现了前后端分离，保证了前端静态部署的安全性与高性能。

1.  **`source-proxy.js` (静态资源代理)**:
    -   **功能**: 通用的 CDN 资源缓存和反代服务。
    -   **用途**: 加速并缓存所有第三方静态资源（如字体、CSS库），避免因源站网络问题导致页面加载缓慢，同时解决了跨域问题。

2.  **`music-proxy.js` (音乐 API 代理)**:
    -   **功能**: Meting API 的高可用反向代理。
    -   **用途**: 解决前端直接调用音乐 API 时遇到的 CORS 跨域限制。

3.  **`github-proxy.js` (GitHub API 代理)**:
    -   **功能**: 安全地代理对 GitHub API 的请求。
    -   **用途**: 将 GitHub 个人访问令牌（PAT）安全地存储在 Worker 的环境变量中，避免在客户端暴露密钥。支持获取用户统计、置顶仓库、仓库列表和动态事件。

4.  **`firebase-proxy.js` (Firestore 数据库代理)**:
    -   **功能**: 作为前端与 Google Firestore 数据库之间的安全后端 (BFF)。
    -   **用途**: 安全地处理留言板和评论功能的数据库读写操作。通过在 Worker 中处理服务账户密钥认证，完全避免了在客户端暴露 Firebase 凭证的风险。

## 技术栈

-   **前端**: `HTML`, `CSS`, `JavaScript`, `Vue.js 3`
-   **后端 (Serverless)**: `Cloudflare Workers`
-   **数据库**: `Google Firestore`
-   **API**: `GitHub API`, `Meting API`, `DeepSeek AI API`
-   **静态资源**: 通过自定义的 `source-proxy` 从 `loli.net`, `bootcdn.net` 等源站代理和缓存。

## 项目结构

```

.
├── content/                # 存放所有个人数据的目录
├── icon/                   # 存放图标和图片的目录
├── worker/                 # 存放所有 Cloudflare Worker 脚本的目录
│   ├── firebase-proxy.js
│   ├── github-proxy.js
│   ├── music-proxy.js
│   └── source-proxy.js
├── index.html              # 项目唯一的 HTML 入口文件
├── LICENSE                 # 项目许可证文件
└── README.md               # 就是你正在看的这个文件
````

## 部署指南

请遵循以下步骤来部署你自己的个人主页。

### 准备工作

1.  一个 **GitHub** 账户。
2.  一个 **Cloudflare** 账户。
3.  一个 **Firebase** 项目（如果需要使用留言板功能）。
4.  一个文本编辑器，如 VS Code。

### 第 1 步：克隆或 Fork 本仓库

将此项目 Fork 到你自己的 GitHub 账户，然后通过 `git clone` 将其克隆到本地。

```bash
git clone [https://github.com/YOUR_USERNAME/YOUR_REPO.git](https://github.com/YOUR_USERNAME/YOUR_REPO.git)
cd YOUR_REPO
````

### 第 2 步：配置前端内容

所有前端的配置和个人数据都在 `index.html` 文件和 `content/` 目录中。

1.  **修改核心配置**:
    打开 `index.html`，找到靠近文件底部的 `<script>` 标签内的 `config` 对象。

    ```javascript
    const config = {
      // ... 其他配置
      github: {
        username: "jimmyshuixin", // <--- 修改为你的 GitHub 用户名
        spaceUrl: "[https://github.com/jimmyshuixin](https://github.com/jimmyshuixin)", // <--- 修改为你的 GitHub 主页链接
      },
      // ... 其他配置
    };
    ```

    你还需要根据后续步骤中创建的 Worker 服务的 URL 来更新此对象中的 `guestbookApiUrl`, `music.api` 等字段。

2.  **修改个人数据**:
    进入 `content/` 目录，根据你的个人信息修改 `.json` 和 `.md` 文件。例如：

      - `content/resume.json`: 你的简历信息。
      - `content/bookshelf.json`: 你的书单。
      - `content/about.md`: 关于你的介绍。
      - ...以此类推，修改所有相关文件。

### 第 3 步：部署 Cloudflare Workers 后端服务

你需要将 4 个 `*-proxy.js` 文件分别部署为 4 个独立的 Cloudflare Worker。

#### 部署 `source-proxy.js` (静态资源代理)

1.  登录 Cloudflare 仪表盘，进入 **Workers & Pages** \> **Create Application** \> **Create Worker**。
2.  为你的 Worker 命名，例如 `source-proxy`，然后点击 **Deploy**。
3.  点击 **Edit code**，将 `source-proxy.js` 的全部内容复制粘贴到在线编辑器中，再次点击 **Save and Deploy**。
4.  部署成功后，你会得到一个 URL，例如 `source-proxy.yourname.workers.dev`。
5.  **重要**: 回到 `index.html`，使用“查找并替换”功能，将所有 `https://source.xvyin.com` 替换为你刚刚获取的 Worker URL。

#### 部署 `music-proxy.js` (音乐代理)

1.  重复上述创建 Worker 的步骤，命名为 `music-proxy`。
2.  将 `music-proxy.js` 的代码部署上去。
3.  获取其 URL，例如 `music-proxy.yourname.workers.dev`。
4.  在 `index.html` 的 `config` 对象中，将 `music.api` 的值修改为你的 Worker URL (记得保留末尾的 `/`)。

#### 部署 `github-proxy.js` (GitHub 代理)

1.  创建名为 `github-proxy` 的 Worker 并部署 `github-proxy.js` 的代码。
2.  **配置密钥**:
      - 首先，你需要一个 [GitHub Personal Access Token (PAT)](https://github.com/settings/tokens)。创建一个新的 classic token，授予 `public_repo` 和 `read:user` 权限。**创建后立即复制并妥善保管这个 Token**。
      - 在 Cloudflare 中，进入你刚创建的 `github-proxy` Worker 的设置页面 (**Settings** \> **Variables**)。
      - 在 **Environment Variables** 下，点击 **Add secret**，变量名设为 `GITHUB_TOKEN`，值为你刚刚创建的 GitHub PAT。
3.  获取其 URL，例如 `github.yourname.workers.dev` (你可以自定义子域)。
4.  在 `index.html` 中，找到 `apiService` 对象，将其中的 `workerUrl` ( `https://github.xvyin.com/` ) 替换为你的 Worker URL。

#### 部署 `firebase-proxy.js` (Firestore 代理)

1.  **准备 Firebase**:
      - 创建一个 Firebase 项目，并启用 **Firestore Database**。
      - 进入 **Project settings** \> **Service accounts**，点击 **Generate new private key**，下载一个 JSON 密钥文件。
2.  创建名为 `firebase-proxy` 的 Worker 并部署 `firebase-proxy.js` 的代码。
3.  **配置密钥**:
      - 打开你下载的 JSON 密钥文件，你会看到 `project_id`, `client_email`, 和 `private_key`。
      - 进入 `firebase-proxy` Worker 的设置页面 (**Settings** \> **Variables**)。
      - 添加 **三个** secret 变量：
          - `FIREBASE_PROJECT_ID`: 值为 JSON 文件中的 `project_id`。
          - `FIREBASE_CLIENT_EMAIL`: 值为 JSON 文件中的 `client_email`。
          - `FIREBASE_PRIVATE_KEY`: 值为 JSON 文件中的 `private_key` (请务必完整复制，包括 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`)。
4.  获取其 URL，例如 `firebase.yourname.workers.dev`。
5.  在 `index.html` 的 `config` 对象中，将 `guestbookApiUrl` 的值修改为你的 Worker URL 加上 `/messages` 路径 (例如 `https://firebase.yourname.workers.dev/messages`)。

### 第 4 步：部署前端页面

在完成所有代码和配置的修改后，将你的代码 `git commit` 和 `git push` 到你的 GitHub 仓库。你有两种推荐的部署方式：

1.  **GitHub Pages (简单)**:

      - 在你的 GitHub 仓库页面，进入 **Settings** \> **Pages**。
      - 在 **Branch** 下，选择 `main` 分支，目录选择 `/(root)`，然后点击 **Save**。
      - 几分钟后，你的网站就会部署在 `https://YOUR_USERNAME.github.io/YOUR_REPO/`。

2.  **Cloudflare Pages (推荐)**:

      - 在 Cloudflare 仪表盘，进入 **Workers & Pages** \> **Create Application** \> **Pages** \> **Connect to Git**。
      - 选择你的 GitHub 仓库。
      - 构建设置留空或选择 "None"，因为这是一个静态 HTML 项目。
      - 点击 **Save and Deploy**。Cloudflare 会为你提供一个 URL，并在此后每次你推送到 `main` 分支时自动重新部署。

## 贡献

欢迎通过 Pull Request 或 Issues 为此项目做出贡献。

1.  Fork 本仓库
2.  创建你的 Feature 分支 (`git checkout -b feature/AmazingFeature`)
3.  提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4.  推送到分支 (`git push origin feature/AmazingFeature`)
5.  打开一个 Pull Request

## 鸣谢

本项目的构建离不开以下优秀的开源项目和服务，在此表示特别感谢：

  - **Meting API / MetingJS**: 为本项目的音乐播放器提供了强大、稳定的跨平台数据支持。感谢 [metowolf](https://github.com/metowolf) 的卓越工作。
  - **Vue.js**: 提供了现代化的前端开发体验。
  - **Cloudflare**: 提供了强大的 Workers 和 Pages 服务，使得 Serverless 架构成为可能。
  - **DeepSeek AI**: 提供了 AI 对话模型的 API 支持。

## 许可证

本项目采用 [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html) 许可证。
