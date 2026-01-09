# MarkPilot

> AI-Powered Chrome Bookmark Manager with VS Code Style Interface

[English](#english) | [中文](#中文)

![MarkPilot](https://img.shields.io/badge/version-1.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Chrome](https://img.shields.io/badge/chrome-extension-yellow.svg)

---

## English

### Overview

MarkPilot is a modern Chrome extension that revolutionizes how you organize bookmarks. Using AI technology, it automatically categorizes your bookmarks into meaningful folders, saving you hours of manual organization.

### Features

- **AI Smart Categorization** - Automatically organize bookmarks using OpenAI, Anthropic Claude, or custom AI providers
- **VS Code Dark Theme** - Clean, professional interface inspired by VS Code
- **Masonry Layout** - Efficient waterfall grid display without gaps
- **Click Statistics** - Track bookmark usage and sort by frequency
- **Batch Processing** - Handle thousands of bookmarks with concurrent AI requests
- **Smart Title Generation** - AI generates meaningful titles for untitled bookmarks
- **Import/Export** - Support for Chrome HTML and JSON formats
- **Auto Cleanup** - Automatically remove empty folders after reorganization
- **Quick Add Popup** - Add bookmarks from any page via toolbar icon
- **RSS/Sitemap Subscription** - Auto-discover and subscribe to RSS feeds from bookmarks
- **Manual RSS Add** - Manually add any RSS/Atom subscription URL
- **Concurrent Discovery** - 10 parallel requests for fast feed discovery
- **Smart Deduplication** - Skip subscribed, deleted, and no-feed domains
- **AI Briefing** - Generate AI summaries of unread subscription content
- **Auto Refresh** - Configurable automatic feed refresh (15min - 24h)
- **Browser Notifications** - Click notifications to open feed page directly
- **Test Notifications** - Verify notification settings in the feed settings panel

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
   - Click "刷新全部" to fetch latest content
   - Click "AI 简报" to generate a summary of unread content
   - Configure auto-refresh interval in settings (default: 1 hour)
   - Deleted subscriptions and no-feed domains are cached to speed up future scans
   - Click browser notifications to open feed page directly
   - Use "测试通知" to verify notifications, "清除无订阅缓存" to rescan domains

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
- **瀑布流布局** - 高效的网格展示，无空白间隙
- **点击统计** - 追踪书签使用情况，按访问频率排序
- **批量处理** - 并发 AI 请求，可处理数千个书签
- **智能标题生成** - AI 为无标题书签生成有意义的标题
- **导入/导出** - 支持 Chrome HTML 和 JSON 格式
- **自动清理** - 重新整理后自动删除空文件夹
- **快速添加** - 通过工具栏图标快速将当前页面添加到书签
- **RSS/Sitemap 订阅** - 自动发现并订阅书签中的 RSS 源
- **手动添加订阅** - 支持直接输入 RSS/Atom 订阅地址
- **并发发现** - 10 个并发请求快速发现订阅
- **智能去重** - 跳过已订阅、已删除和无订阅的域名
- **AI 简报** - 生成未读订阅内容的 AI 摘要
- **定时刷新** - 可配置的自动刷新（15分钟 - 24小时）
- **浏览器通知** - 点击通知直接打开订阅页面
- **测试通知** - 在设置中验证通知功能是否正常

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
   - 点击「刷新全部」获取最新内容
   - 点击「AI 简报」生成未读内容摘要
   - 在设置中配置自动刷新间隔（默认：1小时）
   - 已删除的订阅和无订阅域名会被缓存，加快后续扫描
   - 点击浏览器通知可直接打开订阅页面
   - 「测试通知」验证通知，「清除无订阅缓存」重新扫描域名

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
