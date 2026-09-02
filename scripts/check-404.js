#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '../.next');
const notFoundPaths = [
  path.join(buildDir, 'server/app/not-found.html'),
  path.join(buildDir, 'server/pages/404.html'),
  path.join(buildDir, 'static/chunks/pages/_not-found-*.html'),
  path.join(buildDir, 'static/chunks/pages/404-*.html')
];

function checkFileExists(filePath) {
  if (fs.existsSync(filePath)) return true;
  // Check for wildcard patterns
  if (filePath.includes('*')) {
    const dir = path.dirname(filePath);
    const pattern = path.basename(filePath);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      return files.some(file => file.includes(pattern.replace('*', '')));
    }
  }
  return false;
}

const found = notFoundPaths.some(checkFileExists);

if (!found) {
  console.error('❌ Custom 404 page not found in build output!');
  console.error('This will cause Netlify to show its default 404 page.');
  console.error('Checked paths:', notFoundPaths);
  // Don't fail the build - just warn
  console.log('Continuing with build...');
}

console.log('✅ 404 page check completed');