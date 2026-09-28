# FetchIT

简单易用且高效的音视频下载工具，基于 Electron 构建，支持众多平台，同时支持直链加速下载其他文件，并附带加密音乐文件解密能力。
由非常简单的HTML+JS+CSS制作

## 功能概览

FetchIT 提供四种工作模式，覆盖常见的下载与解密场景：

- **常规模式**：粘贴单个视频或音频链接，自动调用 yt-dlp 解析并下载。
- **列表模式**：粘贴合辑、歌单、剧综链接，先解析全部条目，再以手动筛选方式决定下载哪些分集，列表内任务逐个执行，避免风控。
- **直链模式（附加功能）**：对已知直链资源（普通文件、压缩包、安装包等）使用 aria2c 多线程加速下载。
- **音乐解密（附加功能）**：对 NCM、QMC、KGM、KWM、XM 等加密格式的本地音乐文件进行解密，还原为 MP3 / FLAC / M4A / WAV。

### 平台列表解析

列表模式内置以下平台的原生 API 解析器，可在不依赖 yt-dlp 列表接口的情况下快速获取条目信息：

- 哔哩哔哩（合集、剧集、番剧，自动识别预告/正片并默认跳过预告）
- 网易云音乐（歌单、单曲，识别 VIP 歌曲）
- 芒果 TV（剧集、综艺）

其他站点会自动回退到 yt-dlp 的列表解析能力，实际下载仍由 yt-dlp 完成。

### 预设与质量

预设面板集中在主界面顶部，可针对每个任务单独配置：

- **格式**：原始混合流 / 仅视频 / 仅音频 / 指定格式后的混合流
- **缩略图**：不下载 / 保存为同名图片
- **编码**：默认（不考虑编码）、兼容优先（H.264 + AAC）、自定义
- **质量**：能触及的最佳质量 / 能触及的最差质量 / 自定义（分辨率偏好、FPS 偏好、音质偏好）

### Cookie 管理

内置 Cookie 管理面板，支持：

- 手动导入 Netscape / Header-String 格式的 Cookie 文本或文件
- 登录站点提取 Cookie：在应用内打开目标站点登录后，自动将 Cookie 导出为 Netscape 格式并入池
- Cookie 池目录集中管理，每个 Cookie 一份 `.txt` 文件，可在不同任务间快速切换

### 主题与外观

- 深色 / 浅色主题，可自定义主色调
- 可设置背景图片与背景模糊度
- 系统托盘驻留，支持关闭时最小化到托盘或直接退出

## 目录结构

```
fetchit/
├── src/
│   ├── app/                # 主进程
│   │   ├── app.js          # 应用入口
│   │   ├── window.js       # 主窗口与托盘管理
│   │   ├── context.js      # 全局上下文与默认设置
│   │   ├── downloads.js     # 下载流程、yt-dlp 参数构造、列表解析调度
│   │   ├── cookies.js      # Cookie 池、导入导出、登录提取
│   │   ├── decrypt.js      # 加密音乐文件解密
│   │   ├── settings.js     # 设置读写
│   │   ├── bilibili.js     # 哔哩哔哩列表解析
│   │   ├── netease.js      # 网易云音乐列表解析
│   │   ├── mgtv.js         # 芒果 TV 列表解析
│   │   ├── net.js          # 网络请求与 Cookie 处理工具
│   │   ├── folders.js      # 合集目录组织
│   │   ├── output.js       # 子进程输出解析
│   │   └── music.js
│   └── renderer/           # 渲染进程
│       ├── index.html
│       ├── cookie-extract.html
│       ├── css/
│       └── js/
├── utils/                  # 外部二进制与配置
│   ├── yt-dlp.exe
│   ├── ffmpeg.exe
│   ├── aria2c.exe
│   ├── aria2.conf
│   └── deno.exe
├── icons/
├── obfuscate.js            # 构建前的代码混淆与复制
├── package.json
└── dependence.bat          # 一键安装依赖
```

## 环境要求

- Windows 10 / 11（仅打包 x64）
- Node.js 16+
- npm（建议使用 `dependence.bat` 或手动 `npm install`，`.npmrc` 已配置国内镜像源加速）

## 从源码运行

```bat
:: 1. 安装依赖
dependence.bat
:: 或手动执行
npm install

:: 2. 以开发模式启动（NODE_ENV=development）
set NODE_ENV=development && npm start
```

开发模式下，`utils/` 目录下的二进制文件直接被引用，无需打包。

## 从源码构建安装包

构建流程包含两个阶段：`obfuscate.js` 将 `src/` 复制到 `build/` 并对 JS 文件做混淆，随后 `electron-builder` 把 `build/` 作为应用目录产出 NSIS 安装包到 `dist/`。

```bat
:: 仅生成免安装的解压目录（dist/win-unpacked）
npm run pack

:: 生成 NSIS 安装包（dist/FetchIT Setup x.x.x.exe）
npm run dist

:: 仅执行代码混淆，不调用 electron-builder
npm run obfuscate
```

构建产物：

- `dist/win-unpacked/FetchIT.exe`：免安装可执行文件
- `dist/FetchIT Setup 1.2.9.exe`：NSIS 安装包，支持自定义安装目录

> 构建前请确认 `utils/` 下的 `yt-dlp.exe`、`ffmpeg.exe`、`aria2c.exe` 、`aria2.conf`已就位

## 设置与持久化

运行时配置存储在用户数据目录下（`%APPDATA%/FetchIT/`）：

- `settings.json`：主设置文件（保存路径、并发、主题、代理、Cookie 路径等）

可通过设置面板调整：

- 下载：保存目录、最大并发任务数、单任务分段数、强制 IPv4、进度冻结重试、请求间隔、限速
- 网络：Cookie 池路径、HTTP 代理、自定义请求头、User-Agent
- 界面：主题、主色、背景图、模糊度、通知时长、关闭行为（退出 / 最小化到托盘）

## 依赖说明

| 外部工具 | 位置 | 用途 |
| --- | --- | --- |
| yt-dlp | `utils/yt-dlp.exe` | 视频 / 音频解析与下载 |
| ffmpeg | `utils/ffmpeg.exe` | 媒体合并、转码、缩略图嵌入 |
| aria2c | `utils/aria2c.exe` | 直链多线程加速下载 |
| deno | `utils/deno.exe` | 部分解析脚本运行时 |

应用启动时会异步预热上述二进制（`--version`），首次实际调用时响应更快。

## 许可证

GPL-3.0-only，作者 [Windment](https://space.bilibili.com/3546631764970328?spm_id_from=333.1007.0.0)。源码与衍生作品须遵循同一许可证发布。
重要贡献者：[runer7266-glitch](https://github.com/runer7266-glitch)
其他工具：[Deepseek](https://deepseek.com)

## 免责声明

本项目仅供学习与个人使用，使用者需自行遵守目标站点的服务条款与当地法律法规，因不当使用产生的后果由使用者自行承担。
