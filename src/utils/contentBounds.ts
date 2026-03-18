import type { Page, Stroke, Shape, TextField } from '../types'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'

export interface ContentRect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * The layout constants that match NotebookView's transform container.
 * Pages are stacked vertically with these spacings in "scene" coordinates.
 */
const PAGE_PADDING_TOP = 60    // container padding-top
const PAGE_PADDING_LEFT = 40   // container padding-left
const PAGE_ITEM_PADDING_TOP = 8 // each page-wrapper paddingTop
const PAGE_GAP = 16            // gap between page wrappers

/**
 * Returns the scene-space Y origin of the i-th page (0-indexed).
 */
export function getPageSceneOrigin(pageIndex: number): { x: number; y: number } {
  const x = PAGE_PADDING_LEFT
  const y = PAGE_PADDING_TOP + pageIndex * (PAGE_HEIGHT + PAGE_ITEM_PADDING_TOP + PAGE_GAP) + PAGE_ITEM_PADDING_TOP
  return { x, y }
}

/**
 * Returns the bounding box of all drawable elements across all pages,
 * in scene (transform-container) coordinates. Returns null if nothing exists.
 */
export function getContentBounds(pages: Page[]): ContentRect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let hasContent = false

  pages.forEach((page, pageIndex) => {
    const origin = getPageSceneOrigin(pageIndex)

    // Include the page frame itself so we always have at least the page area
    minX = Math.min(minX, origin.x)
    minY = Math.min(minY, origin.y)
    maxX = Math.max(maxX, origin.x + PAGE_WIDTH)
    maxY = Math.max(maxY, origin.y + PAGE_HEIGHT)
    hasContent = true

    /*   page.strokes.forEach((stroke: Stroke) => {
        stroke.points.forEach(pt => {
          minX = Math.min(minX, origin.x + pt.x)
          minY = Math.min(minY, origin.y + pt.y)
          maxX = Math.max(maxX, origin.x + pt.x)
          maxY = Math.max(maxY, origin.y + pt.y)
        })
      })
  
      ;(page.shapes || []).forEach((shape: Shape) => {
        minX = Math.min(minX, origin.x + shape.x)
        minY = Math.min(minY, origin.y + shape.y)
        maxX = Math.max(maxX, origin.x + shape.x + shape.width)
        maxY = Math.max(maxY, origin.y + shape.y + shape.height)
      })
  
      ;(page.textFields || []).forEach((tf: TextField) => {
        const estimatedWidth = Math.max(100, tf.fontSize * tf.text.length * 0.6)
        const estimatedHeight = tf.fontSize * 1.5
        minX = Math.min(minX, origin.x + tf.x)
        minY = Math.min(minY, origin.y + tf.y)
        maxX = Math.max(maxX, origin.x + tf.x + estimatedWidth)
        maxY = Math.max(maxY, origin.y + tf.y + estimatedHeight)
      }) */
  })

  if (!hasContent) return null

  return { minX, minY, maxX, maxY }
}
