#!/usr/bin/env node

/**
 * Post-build sanity check: make sure the custom 404 page is part of the build
 * output (otherwise the host serves its own generic 404).
 *
 * Since every route is now rendered on demand (`export const dynamic =
 * "force-dynamic"` in the root layout), the 404 is no longer emitted as a
 * static .html file — it ships as the server route `app/_not-found`. Both
 * shapes are accepted below. The check never fails the build.
 */

const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '../.next');

// Pre-rendered (static export) variants.
const staticCandidates = [
  'server/app/not-found.html',
  'server/app/_not-found.html',
  'server/pages/404.html',
  'static/chunks/pages/_not-found-*.html',
  'static/chunks/pages/404-*.html',
];

// On-demand (dynamic) variants.
const dynamicCandidates = [
  'server/app/_not-found',
  'server/app/_not-found.js',
  'server/app/not-found.js',
];

function exists(relativePath) {
  const target = path.join(buildDir, relativePath);
  if (fs.existsSync(target)) return true;

  if (target.includes('*')) {
    const dir = path.dirname(target);
    const prefix = path.basename(target).replace('*', '');
    if (fs.existsSync(dir)) {
      return fs.readdirSync(dir).some((file) => file.includes(prefix));
    }
  }
  return false;
}

const staticHit = staticCandidates.find(exists);
const dynamicHit = dynamicCandidates.find(exists);

if (staticHit) {
  console.log(`✅ Custom 404 page found (static): ${staticHit}`);
} else if (dynamicHit) {
  console.log(`✅ Custom 404 page found (rendered on demand): ${dynamicHit}`);
} else {
  console.warn('⚠️  Custom 404 page not found in the build output.');
  console.warn('   Checked:', [...staticCandidates, ...dynamicCandidates].join(', '));
  console.warn('   The host may fall back to its default 404 page. Not failing the build.');
}
