// scripts/generate-icons.js
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const sourceIcon = 'public/icon.png'; // 你的源图标（1024x1024 PNG）

async function generateIcons() {
  try {
    // 创建 icons 目录
    const iconsDir = path.join(process.cwd(), 'public', 'icons');
    await fs.mkdir(iconsDir, { recursive: true });
    
    for (const size of sizes) {
      await sharp(sourceIcon)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
      
      console.log(`生成图标: icon-${size}x${size}.png`);
    }
    
    // 生成 maskable 图标（圆角）
    for (const size of [192, 512]) {
      const roundedCorners = Buffer.from(
        `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.3}" ry="${size * 0.3}"/></svg>`
      );
      
      await sharp(sourceIcon)
        .resize(size, size)
        .composite([
          {
            input: roundedCorners,
            blend: 'dest-in'
          }
        ])
        .png()
        .toFile(path.join(iconsDir, `maskable-icon-${size}x${size}.png`));
      
      console.log(`生成maskable图标: maskable-icon-${size}x${size}.png`);
    }
    
    console.log('✅ 所有图标生成完成！');
  } catch (error) {
    console.error('❌ 生成图标时出错:', error);
  }
}

generateIcons();