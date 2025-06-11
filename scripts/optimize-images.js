import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputDir = path.join(__dirname, '../src/assets');
const outputDir = path.join(__dirname, '../src/assets/optimized');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Image sizes for responsive loading
const sizes = [
  { width: 1920, suffix: '@2x' },
  { width: 960, suffix: '@1x' },
  { width: 480, suffix: '@small' }
];

// Background images to optimize
const images = [
  'main-overview-bg.png',
  'hyperliquid-bg.png',
  'celestia-bg.png',
  'dymension-bg.png',
  'initia-bg.png'
];

async function optimizeImage(filename) {
  const inputPath = path.join(inputDir, filename);
  const baseName = path.basename(filename, path.extname(filename));

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `${baseName}${size.suffix}.webp`);
    
    await sharp(inputPath)
      .resize(size.width, null, {
        withoutEnlargement: true,
        fit: 'cover'
      })
      .webp({
        quality: 80,
        effort: 6
      })
      .toFile(outputPath);
    
    console.log(`Created ${outputPath}`);
  }
}

async function optimizeAll() {
  for (const image of images) {
    try {
      await optimizeImage(image);
    } catch (error) {
      console.error(`Error optimizing ${image}:`, error);
    }
  }
}

optimizeAll().catch(console.error); 