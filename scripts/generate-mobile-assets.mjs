import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

mkdirSync('assets', { recursive: true })

const iconSize = 1024
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#000000"/>
  <circle cx="512" cy="512" r="380" fill="#000000" stroke="#FFFFFF" stroke-width="48"/>
</svg>`

const splash = 2732
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${splash}" height="${splash}" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#000000"/>
  <circle cx="1366" cy="1366" r="220" fill="none" stroke="#FFFFFF" stroke-width="28"/>
</svg>`

await sharp(Buffer.from(iconSvg)).png().toFile('assets/icon.png')
await sharp(Buffer.from(iconSvg)).png().toFile('assets/icon-only.png')
await sharp(Buffer.from(splashSvg)).png().toFile('assets/splash.png')
await sharp(Buffer.from(splashSvg)).png().toFile('assets/splash-dark.png')
console.log('Wrote assets/icon.png and splash.png')
