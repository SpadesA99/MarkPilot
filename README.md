# MarkPilot

> AI-Powered Chrome Bookmark Manager with VS Code Style Interface

[English](#english) | [中文](#中文)

![MarkPilot](https://img.shields.io/badge/version-1.4.8-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Chrome](https://img.shields.io/badge/chrome-extension-yellow.svg)

---

## English

### Overview

MarkPilot is a modern Chrome extension that revolutionizes how you organize bookmarks. Using AI technology, it automatically categorizes your bookmarks into meaningful folders, saving you hours of manual organization.

### Features

- **AI Smart Categorization** - Automatically organize bookmarks using OpenAI, Anthropic Claude, or custom AI providers
- **VS Code Dark Theme** - Clean, professional interface inspired by VS Code
- **Flat Folder View** - All folders displayed as groups on one page, no nested navigation
- **Masonry Layout** - Efficient waterfall grid display without gaps
- **Click Statistics** - Track bookmark usage and sort by frequency
- **Batch Processing** - Handle thousands of bookmarks with concurrent AI requests
- **Smart Title Generation** - AI generates meaningful titles for untitled bookmarks
- **Import/Export** - Support for Chrome HTML and JSON formats
- **Auto Cleanup** - Automatically remove empty folders after reorganization
- **Quick Add Popup** - Add bookmarks from any page via toolbar icon
- **RSS Subscription** - Auto-discover and subscribe to RSS/Atom feeds from bookmarks
- **Manual RSS Add** - Manually add any RSS/Atom subscription URL
- **Concurrent Discovery** - 10 parallel requests for fast feed discovery
- **Smart Deduplication** - Skip subscribed, deleted, and no-feed domains
- **Follow Subscriptions** - Star/follow specific subscriptions for AI analysis
- **Full Content Fetch** - Automatically fetch full article content for followed feeds
- **AI Article Analysis** - Generate outline and summary for each article individually
- **AI Briefing** - Generate AI summaries of unread subscription content (followed only)
- **Auto Refresh** - Configurable automatic feed refresh (15min - 24h)
- **Bark Notifications** - Push notifications to iOS devices via Bark app with article URL
- **One-Click Clear** - Delete all subscriptions or clear all cached data
- **Drag & Drop** - Drag bookmarks between folders to reorganize
- **Context Menu** - Right-click to create folders, delete bookmarks or folders, move bookmarks
- **Folder Pinning** - Pin folders to keep them at the top of the list
- **Move Bookmark** - Right-click bookmark to move it to another folder via submenu

### Installation

#### From Source

1. Clone this repository
   ```bash
   git clone https://github.com/yourusername/markpilot.git
   cd markpilot
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Build the extension
   ```bash
   npm run build
   ```

4. Load in Chrome
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### Configuration

1. Click the settings icon in MarkPilot
2. Choose your AI provider:
   - **OpenAI** - GPT-3.5/GPT-4
   - **Anthropic** - Claude models
   - **Custom** - Any OpenAI-compatible API
3. Enter your API key
4. (Optional) Set custom model name and base URL

### Usage

1. **View Bookmarks** - Browse your bookmarks in a clean masonry layout
2. **Smart Organize** - Click "智能整理" to let AI categorize all bookmarks
3. **Re-categorize Folder** - Click the sparkle icon on "未分类" folder to reorganize uncategorized items
4. **Search** - Use the search bar (Ctrl+P) to find bookmarks
5. **Import** - Import bookmarks from Chrome HTML export or JSON files
6. **Quick Add** - Click the extension icon to quickly add current page to bookmarks
7. **Subscriptions** - Click the orange "订阅" button to manage RSS subscriptions:
   - Click "一键发现订阅" to auto-discover RSS feeds (10 concurrent requests)
   - Click "手动添加" to add RSS/Atom URL directly
   - Click the star icon to follow/unfollow a subscription (only followed feeds are analyzed by AI)
   - Click "刷新全部" to fetch latest content
   - Click "AI 简报" to generate analysis for each article from followed subscriptions
   - Configure auto-refresh interval in settings (default: 1 hour)
   - Deleted subscriptions and no-feed domains are cached to speed up future scans
   - Enter your Bark Key in settings to receive push notifications with article links on iOS
   - Use "删除所有订阅" to clear all subscriptions, "清除所有数据" to reset everything

### Tech Stack

- React 19
- Vite
- Tailwind CSS
- react-masonry-css
- OpenAI SDK
- Chrome Extensions API

### License

MIT License

---

## 中文

### 概述

MarkPilot 是一款现代化的 Chrome 书签管理扩展，通过 AI 技术彻底改变你整理书签的方式。它能自动将书签分类到有意义的文件夹中，为你节省大量手动整理的时间。

### 功能特点

- **AI 智能分类** - 使用 OpenAI、Anthropic Claude 或自定义 AI 服务自动整理书签
- **VS Code 深色主题** - 简洁专业的界面设计，灵感来自 VS Code
- **扁平文件夹视图** - 所有文件夹在同一页面显示为分组，无嵌套导航
- **瀑布流布局** - 高效的网格展示，无空白间隙
- **点击统计** - 追踪书签使用情况，按访问频率排序
- **批量处理** - 并发 AI 请求，可处理数千个书签
- **智能标题生成** - AI 为无标题书签生成有意义的标题
- **导入/导出** - 支持 Chrome HTML 和 JSON 格式
- **自动清理** - 重新整理后自动删除空文件夹
- **快速添加** - 通过工具栏图标快速将当前页面添加到书签
- **RSS 订阅** - 自动发现并订阅书签中的 RSS/Atom 源
- **手动添加订阅** - 支持直接输入 RSS/Atom 订阅地址
- **并发发现** - 10 个并发请求快速发现订阅
- **智能去重** - 跳过已订阅、已删除和无订阅的域名
- **关注订阅** - 星标关注特定订阅源，AI 仅分析关注的订阅
- **全文抓取** - 自动抓取关注订阅的文章全文内容
- **AI 文章分析** - 为每篇文章独立生成大纲和摘要
- **AI 简报** - 生成关注订阅未读内容的 AI 摘要
- **定时刷新** - 可配置的自动刷新（15分钟 - 24小时）
- **Bark 推送** - 通过 Bark App 推送通知，包含文章链接
- **一键清理** - 删除所有订阅或清除所有缓存数据
- **拖拽移动** - 拖动书签到其他文件夹进行整理
- **右键菜单** - 右键创建文件夹、删除书签或文件夹、移动书签
- **文件夹置顶** - 置顶文件夹使其始终显示在最前面
- **移动书签** - 右键书签通过子菜单快速移动到其他文件夹

### 安装方法

#### 从源码安装

1. 克隆仓库
   ```bash
   git clone https://github.com/yourusername/markpilot.git
   cd markpilot
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 构建扩展
   ```bash
   npm run build
   ```

4. 在 Chrome 中加载
   - 打开 `chrome://extensions/`
   - 开启「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择 `dist` 文件夹

### 配置说明

1. 点击 MarkPilot 中的设置图标
2. 选择 AI 服务提供商：
   - **OpenAI** - GPT-3.5/GPT-4 模型
   - **Anthropic** - Claude 模型
   - **自定义** - 任何 OpenAI 兼容的 API
3. 输入你的 API Key
4. （可选）设置自定义模型名称和 Base URL

### 使用方法

1. **浏览书签** - 在简洁的瀑布流布局中查看书签
2. **智能整理** - 点击「智能整理」按钮让 AI 分类所有书签
3. **重新分类** - 点击「未分类」文件夹上的闪光图标重新整理未分类项目
4. **搜索** - 使用搜索栏 (Ctrl+P) 查找书签
5. **导入** - 从 Chrome HTML 导出文件或 JSON 文件导入书签
6. **快速添加** - 点击扩展图标快速将当前页面添加到书签
7. **订阅管理** - 点击橙色「订阅」按钮管理 RSS 订阅：
   - 点击「一键发现订阅」从书签中自动发现 RSS 源（10 并发）
   - 点击「手动添加」直接输入 RSS/Atom 地址
   - 点击星标图标关注/取消关注订阅源（仅关注的订阅会被 AI 分析）
   - 点击「刷新全部」获取最新内容
   - 点击「AI 简报」为关注订阅的每篇文章生成分析
   - 在设置中配置自动刷新间隔（默认：1小时）
   - 已删除的订阅和无订阅域名会被缓存，加快后续扫描
   - 在设置中输入 Bark Key 接收 iOS 推送通知（包含文章链接）
   - 「删除所有订阅」清空订阅，「清除所有数据」重置全部缓存

### 技术栈

- React 19
- Vite
- Tailwind CSS
- react-masonry-css
- OpenAI SDK
- Chrome Extensions API

### 开源协议

MIT License

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have suggestions, please [open an issue](https://github.com/yourusername/markpilot/issues).

---

Made with AI by MarkPilot Team
