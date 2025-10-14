#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceImage = process.argv[2];
if (!sourceImage) {
  console.log('Usage: node generate-icons.js <source-image-path>');
  console.log('Example: node generate-icons.js my-icon.png');
  process.exit(1);
}

const sourcePath = path.resolve(sourceImage);
const iconsDir = path.join(__dirname, 'dist', 'icons');

// Ensure source image exists
if (!fs.existsSync(sourcePath)) {
  console.error(`Source image not found: ${sourcePath}`);
  process.exit(1);
}

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [16, 48, 128];

console.log(`Generating icons from: ${sourcePath}`);
console.log(`Output directory: ${iconsDir}`);

sizes.forEach(size => {
  const outputPath = path.join(iconsDir, `icon${size}.png`);
  const command = `magick "${sourcePath}" -resize ${size}x${size} "${outputPath}"`;

  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✓ Generated ${size}x${size} icon: ${outputPath}`);
  } catch (error) {
    console.error(`✗ Failed to generate ${size}x${size} icon:`, error.message);
  }
});

console.log('\n🎉 Icon generation complete!');
console.log('You can now load the extension in Chrome at chrome://extensions');