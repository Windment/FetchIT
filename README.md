# FetchIT

**FetchIT** 是一款面向 Windows 的桌面音视频下载工具，基于 Electron 构建。它以 yt-dlp、ffmpeg 与 aria2c 为底层能力，将解析、下载、整理与解密整合进统一的图形界面：既可解析并下载主流视频与音乐平台的链接，也能对已知直链的普通文件进行多线程加速下载，并额外提供加密音乐文件的还原能力。

| 项目 | 说明 |
| --- | --- |
| 当前版本 | 1.3.1 |
| 开源协议 | GPL-3.0-only |
| 运行平台 | Windows 10 / 11（仅 x64） |
| 技术栈 | Electron + Node.js，界面为原生 HTML / CSS / JavaScript |
| 项目仓库 | [github.com/Windment/FetchIT](https://github.com/Windment/FetchIT) |
| 官方网站 | [fetchitapp.netlify.app](https://fetchitapp.netlify.app) |

## 下载与安装

前往 [Releases](https://github.com/Windment/FetchIT/releases) 页面下载最新的安装包，文件名形如 `FetchIT Setup x.x.x.exe`。安装程序支持自定义安装目录，安装后即可直接使用，无需额外部署运行环境。

更多功能介绍、使用说明与网页版音乐解密，请访问官方网站：[fetchitapp.netlify.app](https://fetchitapp.netlify.app)。

## 功能总览

FetchIT 围绕四类场景组织功能：

| 工作模式 | 适用场景 | 关键特性 |
| --- | --- | --- |
| 常规模式 | 单个视频或音频链接 | 自动解析并按预设下载 |
| 列表模式 | 合集、歌单、剧集链接 | 先解析条目，再手动筛选分集，逐个下载 |
| 直链模式 | 已知直链的任意文件 | 多线程加速下载，支持断点续传 |
| 音乐解密 | 本地加密音频文件 | 还原为可正常播放的音频文件 |

## 工作模式

### 常规模式

粘贴单个视频或音频链接，程序自动调用 yt-dlp 解析，并依据当前预设下载。常规模式提供两种筛选方式：

- **自动**：按预设智能选取可用的视频流与音频流。
- **手动**：先解析出全部可用流，再由用户指定视频流与音频流的组合，确认后开始下载。

### 列表模式

粘贴合集、歌单、剧综链接后，程序先解析全部条目，再按筛选设置执行。列表内任务逐个下载，以降低触发风控的概率。

内置以下平台的原生 API 解析器，更快速且精准获取信息：

| 平台 | 支持内容 |
| --- | --- |
| 哔哩哔哩 | 合集、剧集、番剧；自动识别并默认跳过预告 |
| 网易云音乐 | 歌单、单曲；识别 VIP 歌曲 |
| 芒果 TV | 剧集、综艺 |

其他站点会自动回退到 yt-dlp 的列表解析能力，实际下载仍由 yt-dlp 完成。解析完成后可选择「全部下载」，或进入「手动筛选」弹窗勾选分集，并支持按关键词搜索过滤。

### 直链模式（附加功能）

面向普通文件、压缩包、安装包等已知直链资源，使用 aria2c 多线程并发下载，默认 64 分片并行。支持断点续传，可在参数区指定分片数、User-Agent、Cookie 与 Referer。

### 音乐解密（附加功能）

用于还原 NCM、UC、KWM、XM、MG3D 等常见加密格式的本地音乐文件，输出为 MP3 / FLAC / M4A / WAV 等可正常播放的音频。支持点击选择或直接拖拽，可一次导入多个文件并批量处理。

## 下载预设

预设面板集中在主界面顶部，可针对每个任务单独配置，包含四个下拉项：

| 项目 | 可选值 | 说明 |
| --- | --- | --- |
| 格式 | 原始 / MP4 / MKV / MOV / MP3 / M4A / WAV / FLAC | 选择视频容器会执行转封装，选择音频格式则仅抽取音轨；需要保持文件原样时选择「原始」 |
| 封面 | 不保存 / JPG / PNG / WebP | 将视频封面单独导出为图片 |
| 编码 | 默认 / 兼容优先（H.264 + AAC）/ 自定义 | 「兼容优先」提升在旧设备、剪辑软件与播放器中的兼容性；自定义可指定视频编码（H.264 / H.265 / AV1 / VP9）与音频编码（AAC / M4A / Vorbis / Opus / MP3 / AC3） |
| 质量 | 最佳 / 最差 / 自定义 | 默认为「可得的最佳质量」；自定义可分别指定分辨率、帧率与音质 |

## 设置

设置按用途划分为七组，改动即时生效并自动保存：

| 分组 | 主要条目 |
| --- | --- |
| 存储位置 | 保存位置、Cookie 池、日志存储路径 |
| 下载性能 | 并行数、分片数、快速预设、进度冻结重试、缓冲区、Deno 运行时 |
| 网络请求 | IPV4 / IPV6、请求间隔、重试次数、限速、代理 |
| 通知 | 通知显示时长、完成时系统通知、通知范围 |
| 记忆 | 记住 Cookie、记住 User-Agent |
| 窗口行为 | 关闭时行为、关闭时同时打开输出位置 |
| 外观 | 主题、主题色、背景图、模糊程度 |

运行时配置写入用户数据目录下的 `settings.json`（`%APPDATA%/FetchIT/`）。合集目录功能可将同一合辑的文件归档到同名子目录，可在设置中按需开关。

## Cookie 管理

部分平台的高清晰度内容、会员内容或列表下载需要登录状态，导入对应站点的 Cookie 后这些内容才可正常获取。Cookie 管理提供两种导入方式：

- **手动导入**：支持 Netscape 格式以及一般形式的 Cookie 文本，粘贴即可保存。
- **登录提取**：在应用内打开目标站点并正常登录，程序自动将 Cookie 导出为 Netscape 格式并入池。

Cookie 池以目录集中管理，每个 Cookie 保存为独立的 `.txt` 文件，便于在不同站点之间切换。

> Cookie 属于账号隐私，请勿分享给他人；下载内容请仅用于个人合理使用。

## 目录结构

```
fetchit/
├── src/
│   ├── app/                # 主进程
│   │   ├── app.js          # 应用入口
│   │   ├── window.js       # 主窗口与托盘管理
│   │   ├── context.js      # 全局上下文与默认设置
│   │   ├── downloads.js    # 下载流程、yt-dlp 参数构造、列表解析调度
│   │   ├── cookies.js      # Cookie 池、导入导出、登录提取
│   │   ├── decrypt.js      # 加密音乐文件解密
│   │   ├── settings.js     # 设置读写
│   │   ├── bilibili.js     # 哔哩哔哩列表解析
│   │   ├── netease.js      # 网易云音乐列表解析
│   │   ├── mgtv.js         # 芒果 TV 列表解析
│   │   ├── net.js          # 网络请求与 Cookie 处理工具
│   │   ├── folders.js      # 合集目录组织
│   │   ├── output.js       # 子进程输出解析
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
├── obfuscate.js            # 代码混淆脚本
├── package.json
└── dependence.bat          # 安装依赖
```

## 环境要求

- Windows 10 / 11（仅打包 x64）
- Node.js 16 及以上
- npm

## 从源码运行

```bat
:: 1. 安装依赖
dependence.bat
:: 或手动执行
npm install

:: 2. 以开发模式启动（NODE_ENV=development）
set NODE_ENV=development && npm start
```

开发模式下，`utils/` 目录下的二进制文件会被直接引用，无需打包。

## 构建安装包

构建分为两个阶段：`obfuscate.js` 先将 `src/` 复制到 `build/` 并对 JavaScript 文件做混淆，随后由 electron-builder 以 `build/` 作为应用目录产出 NSIS 安装包至 `dist/`。

```bat
:: 仅生成免安装的解压目录（dist/win-unpacked）
npm run pack

:: 生成 NSIS 安装包（dist/FetchIT Setup x.x.x.exe）
npm run dist

:: 仅执行代码混淆，不调用 electron-builder
npm run obfuscate
```

构建产物：

- `dist/win-unpacked/FetchIT.exe`：免安装的可执行文件
- `dist/FetchIT Setup x.x.x.exe`：NSIS 安装包，支持自定义安装目录

> 构建前请确认 `utils/` 下的 `yt-dlp.exe`、`ffmpeg.exe`、`aria2c.exe`、`aria2.conf` 已就位。

## 依赖说明

| 外部工具 | 位置 | 用途 |
| --- | --- | --- |
| yt-dlp | `utils/yt-dlp.exe` | 视频与音频的解析、下载 |
| ffmpeg | `utils/ffmpeg.exe` | 媒体合并、转码、缩略图嵌入 |
| aria2c | `utils/aria2c.exe` | 直链多线程加速下载 |
| deno | `utils/deno.exe` | 部分解析脚本的运行时 |

应用启动时会异步预热上述二进制（执行 `--version`），以缩短首次实际调用的响应时间。

## 支持与赞赏

FetchIT 完全免费且开源，也不会收集任何数据。如果你喜欢该项目，欢迎通过赞赏支持后续的开发与维护：

[前往赞赏页](https://fetchitapp.netlify.app/about.html#sponsor)

## 许可证与致谢

本项目采用 GPL-3.0-only 协议，作者 [Windment](https://space.bilibili.com/3546631764970328)。源码与衍生作品须遵循同一许可证发布。

重要贡献者：Rouk（[@runer7266-glitch](https://github.com/runer7266-glitch)），在列表解析、Cookie 手动导入流程与音乐解密等多项功能上提供了重要贡献。

禁止进行任何商业性行为，包括但不限于将该项目制作为付费软件并未经允许二次发布等

## 免责声明

本项目仅供学习与个人使用，使用者需自行遵守目标站点的服务条款及当地法律法规，因不当使用产生的后果由使用者自行承担。
