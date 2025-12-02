// scripts/generate-icons-fixed.js
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// 配置
const CONFIG = {
  sourceIcon: path.join(__dirname, '../public/icon-source.png'), // 源图标（建议 1024x1024 PNG）
  outputDir: path.join(__dirname, '../public'),
};

// 需要生成的图标尺寸和用途
const ICON_SIZES = [
  // favicon 尺寸
  { size: 16, name: 'favicon-16x16.png', purpose: 'favicon' },
  { size: 32, name: 'favicon-32x32.png', purpose: 'favicon' },
  { size: 48, name: 'favicon-48x48.png', purpose: 'favicon' },
  
  // PWA 标准尺寸
  { size: 72, name: 'icon-72x72.png', purpose: 'pwa' },
  { size: 96, name: 'icon-96x96.png', purpose: 'pwa' },
  { size: 128, name: 'icon-128x128.png', purpose: 'pwa' },
  { size: 144, name: 'icon-144x144.png', purpose: 'pwa' },
  { size: 152, name: 'icon-152x152.png', purpose: 'pwa' },
  { size: 192, name: 'icon-192x192.png', purpose: 'pwa' },
  { size: 384, name: 'icon-384x384.png', purpose: 'pwa' },
  { size: 512, name: 'icon-512x512.png', purpose: 'pwa' },
  
  // Apple 专用
  { size: 180, name: 'apple-touch-icon.png', purpose: 'apple' },
  { size: 167, name: 'apple-touch-icon-167x167.png', purpose: 'apple' },
  { size: 152, name: 'apple-touch-icon-152x152.png', purpose: 'apple' },
  { size: 120, name: 'apple-touch-icon-120x120.png', purpose: 'apple' },
  
  // Microsoft 磁贴
  { size: 144, name: 'mstile-144x144.png', purpose: 'microsoft' },
  { size: 310, name: 'mstile-310x310.png', purpose: 'microsoft' },
];

async function checkSourceFiles() {
  try {
    await fs.access(CONFIG.sourceIcon);
    console.log(`✓ 找到源文件: ${path.basename(CONFIG.sourceIcon)}`);
    return CONFIG.sourceIcon;
  } catch (error) {
    console.warn(`⚠️ 未找到源文件: ${path.basename(CONFIG.sourceIcon)}`);
    console.log('💡 请将你的应用图标保存为 public/icon-source.png (1024x1024)');
    process.exit(1);
  }
}

async function generatePNGIcon(sourcePath, outputPath, width, height = width) {
  try {
    await sharp(sourcePath)
      .resize(width, height, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(outputPath);
    
    console.log(`  ✓ 生成 ${width}x${height} -> ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`  ✗ 生成 ${width}x${height} 失败:`, error.message);
  }
}

async function generateAppleTouchIcon(sourcePath, outputPath, size) {
  try {
    // Apple 触摸图标有特定的圆角和背景
    const roundedIcon = Buffer.from(
      `<svg>
        <rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.2}" ry="${size * 0.2}" fill="white"/>
      </svg>`
    );
    
    await sharp(sourcePath)
      .resize(size - 40, size - 40) // 留出边距
      .png()
      .toBuffer()
      .then(buffer => {
        return sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          }
        })
        .composite([
          {
            input: roundedIcon,
            blend: 'dest-over'
          },
          {
            input: buffer,
            top: 20,
            left: 20,
            blend: 'over'
          }
        ])
        .png()
        .toFile(outputPath);
      });
    
    console.log(`  ✓ 生成 Apple 图标 ${size}x${size}`);
  } catch (error) {
    console.error(`  ✗ 生成 Apple 图标失败:`, error.message);
  }
}

async function generateMaskableIcon(sourcePath, outputPath, size) {
  try {
    // 可裁剪图标 (maskable) - 安全区域为 80%
    const safeArea = Math.round(size * 0.8); // 修复：取整
    const margin = Math.round((size - safeArea) / 2); // 修复：取整
    
    // 创建透明背景
    const background = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      }
    })
    .png()
    .toBuffer();
    
    // 创建图标内容（缩小到安全区域）
    const iconBuffer = await sharp(sourcePath)
      .resize(safeArea, safeArea)
      .png()
      .toBuffer();
    
    // 合并
    await sharp(background)
      .composite([
        {
          input: iconBuffer,
          top: margin,
          left: margin,
          blend: 'over'
        }
      ])
      .png()
      .toFile(outputPath);
    
    console.log(`  ✓ 生成可裁剪图标 ${size}x${size} (安全区域: ${safeArea}x${safeArea})`);
  } catch (error) {
    console.error(`  ✗ 生成可裁剪图标失败:`, error.message);
  }
}

async function generateFavicon(sourcePath) {
  try {
    // 生成 favicon.png (32x32)
    await sharp(sourcePath)
      .resize(32, 32)
      .png()
      .toFile(path.join(CONFIG.outputDir, 'favicon.png'));
    
    console.log(`  ✓ 生成 favicon.png (32x32)`);
    
    // 生成多尺寸的PNG文件
    const icoSizes = [16, 32, 48, 64];
    for (const size of icoSizes) {
      await sharp(sourcePath)
        .resize(size, size)
        .png()
        .toFile(path.join(CONFIG.outputDir, `favicon-${size}x${size}.png`));
      console.log(`  ✓ 生成 favicon-${size}x${size}.png`);
    }
    
  } catch (error) {
    console.error(`  ✗ 生成 favicon 失败:`, error.message);
  }
}

async function generateSocialImages(sourcePath) {
  try {
    // 生成 Open Graph 图片
    await sharp(sourcePath)
      .resize(1200, 630, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toFile(path.join(CONFIG.outputDir, 'og-image.png'));
    
    console.log('  ✓ 生成 Open Graph 图片 (1200x630)');
    
    // 生成 Twitter 卡片图片
    await sharp(sourcePath)
      .resize(800, 418, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toFile(path.join(CONFIG.outputDir, 'twitter-image.png'));
    
    console.log('  ✓ 生成 Twitter 卡片图片 (800x418)');
  } catch (error) {
    console.error('  ✗ 生成社交媒体图片失败:', error.message);
  }
}

async function main() {
  console.log('🚀 开始生成图标...\n');
  
  // 检查源文件
  const sourcePath = await checkSourceFiles();
  
  // 创建输出目录
  const iconsDir = path.join(CONFIG.outputDir, 'icons');
  await fs.mkdir(iconsDir, { recursive: true });
  
  // 1. 生成 favicon
  console.log('\n📌 生成 Favicon:');
  await generateFavicon(sourcePath);
  
  // 2. 生成所有 PNG 图标
  console.log('\n📌 生成 PNG 图标:');
  for (const icon of ICON_SIZES) {
    const outputPath = path.join(
      icon.purpose === 'favicon' ? CONFIG.outputDir : iconsDir, 
      icon.name
    );
    
    const width = icon.width || icon.size;
    const height = icon.height || icon.size;
    
    if (icon.purpose === 'apple') {
      await generateAppleTouchIcon(sourcePath, outputPath, icon.size);
    } else {
      await generatePNGIcon(sourcePath, outputPath, width, height);
    }
  }
  
  // 3. 生成 maskable 图标
  console.log('\n📌 生成可裁剪图标:');
  await generateMaskableIcon(
    sourcePath, 
    path.join(iconsDir, 'maskable-icon-192x192.png'), 
    192
  );
  await generateMaskableIcon(
    sourcePath, 
    path.join(iconsDir, 'maskable-icon-512x512.png'), 
    512
  );
  
  // 4. 生成社交媒体图片
  console.log('\n📌 生成社交媒体图片:');
  await generateSocialImages(sourcePath);
  
  console.log('\n🎉 图标生成完成！');
  console.log('\n📁 文件位置:');
  console.log(`   - 图标目录: ${iconsDir}`);
  console.log(`   - 配置文件: ${path.join(CONFIG.outputDir, 'manifest.json')}`);
  console.log('\n💡 提示: 确保在 HTML 中引用正确的图标路径');
}

main().catch(error => {
  console.error('\n❌ 生成过程中出错:', error);
  process.exit(1);
});