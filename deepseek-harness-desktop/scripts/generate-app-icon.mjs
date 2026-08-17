/** Generate the cross-platform application icon from the repository-owned brand SVG. */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const buildRoot = join(packageRoot, 'build')
const sourcePath = join(buildRoot, 'tray-icon.svg')
const outputPath = join(buildRoot, 'app-icon.png')

const BRAND_BLUE = '#4D6BFE'
const source = await readFile(sourcePath, 'utf8')
if (!source.includes(`fill="${BRAND_BLUE}"`) || /<style\b/iu.test(source)) {
  throw new Error(`generate-app-icon: tray-icon.svg must use the fixed brand color ${BRAND_BLUE}`)
}

/** Pixel width and height of the generated cross-platform application icon canvas. */
export const APP_ICON_CANVAS_SIZE = 1024

/**
 * Derive the Windows/Linux application icon from the brand SVG without changing
 * the shared source. The macOS Dock icon is generated separately from this
 * output by `generate-mac-app-icon.mjs`.
 * @param {string} inputPath - absolute path to the brand SVG.
 * @param {string} output - absolute path for the generated application PNG.
 * @returns {Promise<void>} Resolves after the complete PNG has been written.
 */
export async function generateAppIcon(inputPath = sourcePath, output = outputPath) {
  if (resolve(inputPath) === resolve(output)) {
    throw new Error('generate-app-icon: output must not overwrite the source icon')
  }
  const input = await readFile(inputPath)

  const rendered = await sharp(input, { density: 96 })
    .resize({
      width: APP_ICON_CANVAS_SIZE,
      height: APP_ICON_CANVAS_SIZE,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toColourspace('rgb16')
    .withIccProfile('srgb')
    .png({
      compressionLevel: 9,
      progressive: false,
      adaptiveFiltering: false,
      palette: false,
    })
    .toBuffer()

  const generated = await sharp(rendered).metadata()
  if (
    generated.format !== 'png'
    || generated.width !== APP_ICON_CANVAS_SIZE
    || generated.height !== APP_ICON_CANVAS_SIZE
    || generated.space !== 'rgb16'
    || generated.depth !== 'ushort'
    || generated.bitsPerSample !== 16
    || generated.channels !== 4
    || generated.hasAlpha !== true
  ) {
    throw new Error('generate-app-icon: generated icon did not preserve the source color data')
  }

  await writeFile(output, rendered)
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  await generateAppIcon()
}
