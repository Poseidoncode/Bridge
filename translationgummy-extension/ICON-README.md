# Translation Bridge - Icon Generation Tool

## 🎨 快速生成 Chrome 扩展图标

这个工具可以从一张源图片自动生成 Chrome 扩展所需的三种尺寸图标：

- `icon16.png` (16x16) - 扩展列表显示
- `icon48.png` (48x48) - 扩展管理页面
- `icon128.png` (128x128) - Chrome Web Store

## 🚀 使用方法

### 方法 1：使用 npm 脚本（推荐）

```bash
# 准备一张源图片（建议至少128x128像素）
# 然后运行：
npm run generate-icons your-icon.png
```

### 方法 2：直接运行脚本

```bash
node generate-icons.js your-icon.png
```

### 方法 3：使用在线工具（如果没有 ImageMagick）

访问以下网站之一：

- [Favicon.io](https://favicon.io/favicon-converter/)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Iconifier](https://iconifier.net/)

## 📋 支持的图片格式

- PNG (推荐)
- JPG/JPEG
- SVG (会自动转换为 PNG)
- WebP

## 🔧 系统要求

需要安装 ImageMagick：

```bash
# macOS (使用Homebrew)
brew install imagemagick

# Ubuntu/Debian
sudo apt-get install imagemagick

# Windows (使用Chocolatey)
choco install imagemagick
```

## 📁 文件结构

```
translationgummy-extension/
├── icon-source.svg          # 示例SVG图标
├── icon-source.png          # 转换后的PNG
├── generate-icons.js        # 图标生成脚本
└── dist/icons/              # 输出目录
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 💡 图标设计建议

1. **尺寸**: 源图片至少 128x128 像素
2. **背景**: 建议使用透明背景或纯色背景
3. **风格**: 简洁明了，易于小尺寸识别
4. **颜色**: 与扩展主题相符

## 🎯 示例

```bash
# 使用项目中的示例图标
npm run generate-icons icon-source.png

# 使用你自己的图片
npm run generate-icons ~/Desktop/my-awesome-icon.png
```

生成完成后，图标会自动放置在`dist/icons/`目录中，可以直接加载到 Chrome 扩展中！
