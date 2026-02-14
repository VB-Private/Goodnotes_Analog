import { PDFDocument, rgb } from 'pdf-lib'
import download from 'downloadjs'
import type { Notebook, Page, Stroke, TextField, PDFFile, Shape } from '../types'
import { getPDFFile } from '../storage/db'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import { splitStroke } from './geometry'

const LINE_COLOR = rgb(0, 0, 0)
const LINE_OPACITY = 0.12
const GRID_SPACING = 20
const LINE_SPACING = 24
const PAPER_BG = rgb(0.98, 0.98, 0.97) // #fafaf8

// ----------------------------------------------------------------------
//  Apple Pencil optimized stroke rendering
// ----------------------------------------------------------------------

/**
 * Converts hex to RGB
 */
function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
        ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255,
        }
        : { r: 0, g: 0, b: 0 }
}

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
    return a * (1 - t) + b * t
}

/**
 * Adaptive Catmull-Rom spline interpolation.
 * Inserts points so that the maximum distance between consecutive points
 * is less than half the minimum stroke width. This guarantees smooth,
 * gapless strokes when drawing overlapping circles.
 */
function interpolateStrokePointsForHandwriting(
    points: { x: number; y: number; pressure: number }[],
    strokeSize: number,
    scale: { x: number; y: number }
): typeof points {
    if (points.length < 2) return points

    const result: typeof points = []
    const minThickness = strokeSize * 0.3 * Math.min(scale.x, scale.y) // minimum radius ~0.3 * size
    const targetSpacing = minThickness * 0.8 // circles overlap when spacing < 2*radius

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i]
        const p2 = points[i + 1]

        // Euclidean distance in scaled coordinates
        const dx = (p2.x - p1.x) * scale.x
        const dy = (p2.y - p1.y) * scale.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Number of segments needed so that segment length <= targetSpacing
        const segments = Math.max(1, Math.ceil(distance / targetSpacing))

        for (let s = 0; s < segments; s++) {
            const t = s / segments

            // Catmull-Rom requires 4 points; for boundaries we duplicate first/last
            const p0 = i === 0 ? points[i] : points[i - 1]
            const p3 = i === points.length - 2 ? points[i + 1] : points[i + 2]

            const x = catmullRom(p0.x, p1.x, p2.x, p3.x, t)
            const y = catmullRom(p0.y, p1.y, p2.y, p3.y, t)
            const pressure = lerp(p1.pressure, p2.pressure, t)

            result.push({ x, y, pressure })
        }
    }

    // Add the very last point
    result.push(points[points.length - 1])
    return result
}

/**
 * Catmull-Rom for one coordinate
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const v0 = (p2 - p0) * 0.5
    const v1 = (p3 - p1) * 0.5
    const t2 = t * t
    const t3 = t2 * t
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 +
        (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 +
        v0 * t +
        p1
}

// ----------------------------------------------------------------------
//  Core drawing – handwriting optimized
// ----------------------------------------------------------------------

/**
 * Draws strokes using overlapping filled circles.
 * This method produces smooth, continuous handwriting strokes
 * with natural pressure variation and perfect joins.
 * 
 * Key optimizations for Apple Pencil:
 * - Linear pressure mapping with a minimum thickness (never too thin)
 * - Adaptive point density to guarantee circle overlap
 * - No double-drawing (circles only, no lines)
 * - Circles are drawn at every interpolated point
 */
function drawAnnotationsOnPage(
    pdfPage: any,
    pageContent: { strokes: Stroke[]; textFields?: TextField[]; shapes?: Shape[] },
    scale: { x: number; y: number } = { x: 1, y: 1 }
) {
    const { height } = pdfPage.getSize()
    const { x: scaleX, y: scaleY } = scale

    // --------------------------------------------------------------------
    //  Draw Strokes – handwriting optimized
    // --------------------------------------------------------------------
    for (let i = 0; i < pageContent.strokes.length; i++) {
        const stroke = pageContent.strokes[i]
        if (stroke.points.length < 2) continue
        if (stroke.tool === 'eraser') continue

        // Eraser splitting (unchanged)
        const relevantErasers = pageContent.strokes.slice(i + 1).filter(e => e.tool === 'eraser')
        const fragments = relevantErasers.length > 0 ? splitStroke(stroke, relevantErasers) : [stroke]

        const color = hexToRgb(stroke.color)
        let opacity = 1.0
        if (stroke.tool === 'pencil') opacity = 0.6
        if (stroke.tool === 'crayon') opacity = 0.4

        for (const fragment of fragments) {
            if (fragment.points.length < 2) continue

            // Step 1: Interpolate points adaptively so circles overlap seamlessly
            const smoothPoints = interpolateStrokePointsForHandwriting(
                fragment.points,
                stroke.size,
                { x: scaleX, y: scaleY }
            )

            // Step 2: Draw a filled circle at every point
            for (const point of smoothPoints) {
                // Apple Pencil pressure mapping: linear, with a minimum of 30% of stroke size
                // This ensures very light touches are still visible and smooth.
                const pressureFactor = 0.3 + point.pressure * 0.3 // range 0.3–1.0
                const radius = stroke.size * pressureFactor * scaleX

                pdfPage.drawEllipse({
                    x: point.x * scaleX,
                    y: height - point.y * scaleY,
                    xScale: radius,
                    yScale: radius,
                    color: rgb(color.r, color.g, color.b),
                    opacity: opacity,
                    borderWidth: 0, // filled ellipse
                })
            }
        }
    }

    // --------------------------------------------------------------------
    //  Draw Text Fields (unchanged)
    // --------------------------------------------------------------------
    for (const tf of pageContent.textFields || []) {
        if (!tf.text) continue
        const color = hexToRgb(tf.color)
        pdfPage.drawText(tf.text, {
            x: tf.x * scaleX,
            y: height - tf.y * scaleY - tf.fontSize * scaleY,
            size: tf.fontSize * scaleY,
            color: rgb(color.r, color.g, color.b),
        })
    }

    // --------------------------------------------------------------------
    //  Draw Shapes
    // --------------------------------------------------------------------
    for (const shape of pageContent.shapes || []) {
        const color = hexToRgb(shape.color)
        const pdfColor = rgb(color.r, color.g, color.b)
        const fillOpacity = 0.25
        const strokeOpacity = 1.0

        if (shape.type === 'rect') {
            // Draw fill
            if (shape.isFilled !== false) {
                pdfPage.drawRectangle({
                    x: shape.x * scaleX,
                    y: height - (shape.y + shape.height) * scaleY,
                    width: shape.width * scaleX,
                    height: shape.height * scaleY,
                    color: pdfColor,
                    opacity: fillOpacity,
                })
            }
            // Draw border
            pdfPage.drawRectangle({
                x: shape.x * scaleX,
                y: height - (shape.y + shape.height) * scaleY,
                width: shape.width * scaleX,
                height: shape.height * scaleY,
                borderColor: pdfColor,
                borderWidth: shape.size * scaleX,
                opacity: 0, // No fill for border call
                borderOpacity: strokeOpacity,
            })
        } else if (shape.type === 'circle') {
            const centerX = (shape.x + shape.width / 2) * scaleX
            const centerY = height - (shape.y + shape.height / 2) * scaleY
            const rx = Math.abs(shape.width / 2) * scaleX
            const ry = Math.abs(shape.height / 2) * scaleY

            if (shape.isFilled !== false) {
                pdfPage.drawEllipse({
                    x: centerX,
                    y: centerY,
                    xScale: rx,
                    yScale: ry,
                    color: pdfColor,
                    opacity: fillOpacity,
                })
            }
            pdfPage.drawEllipse({
                x: centerX,
                y: centerY,
                xScale: rx,
                yScale: ry,
                borderColor: pdfColor,
                borderWidth: shape.size * scaleX,
                opacity: 0,
                borderOpacity: strokeOpacity,
            })
        } else if (shape.type === 'triangle') {
            const p1 = { x: (shape.x + shape.width / 2) * scaleX, y: height - shape.y * scaleY }
            const p2 = { x: (shape.x + shape.width) * scaleX, y: height - (shape.y + shape.height) * scaleY }
            const p3 = { x: shape.x * scaleX, y: height - (shape.y + shape.height) * scaleY }

            if (shape.isFilled !== false) {
                pdfPage.drawPolygon({
                    points: [p1, p2, p3],
                    color: pdfColor,
                    opacity: fillOpacity,
                })
            }
            pdfPage.drawPolygon({
                points: [p1, p2, p3],
                borderColor: pdfColor,
                borderWidth: shape.size * scaleX,
                opacity: 0,
                borderOpacity: strokeOpacity,
            })
        }
    }
}


// ----------------------------------------------------------------------
//  Public export functions (unchanged)
// ----------------------------------------------------------------------

export async function exportNotebookToPDF(notebook: Notebook, pages: Page[]) {
    const pdfDoc = await PDFDocument.create()
    const pdfFileCache: Record<string, Uint8Array> = {}

    for (const page of pages) {
        let pdfPage

        if (page.template === 'pdf' && page.pdfFileId && page.pdfPageNumber) {
            let pdfBytes = pdfFileCache[page.pdfFileId]
            if (!pdfBytes) {
                const pdfFile = await getPDFFile(page.pdfFileId)
                if (pdfFile) {
                    pdfBytes = new Uint8Array(await pdfFile.blob.arrayBuffer())
                    pdfFileCache[page.pdfFileId] = pdfBytes
                }
            }

            if (pdfBytes) {
                const sourceDoc = await PDFDocument.load(pdfBytes)
                const [embeddedPage] = await pdfDoc.copyPages(sourceDoc, [page.pdfPageNumber - 1])
                pdfPage = pdfDoc.addPage(embeddedPage)
            } else {
                pdfPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
            }
        } else {
            pdfPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
            pdfPage.drawRectangle({
                x: 0,
                y: 0,
                width: PAGE_WIDTH,
                height: PAGE_HEIGHT,
                color: PAPER_BG,
            })

            if (page.template === 'squared') {
                for (let x = 0; x <= PAGE_WIDTH; x += GRID_SPACING) {
                    pdfPage.drawLine({
                        start: { x, y: 0 },
                        end: { x, y: PAGE_HEIGHT },
                        thickness: 1,
                        color: LINE_COLOR,
                        opacity: LINE_OPACITY,
                    })
                }
                for (let y = 0; y <= PAGE_HEIGHT; y += GRID_SPACING) {
                    pdfPage.drawLine({
                        start: { x: 0, y },
                        end: { x: PAGE_WIDTH, y },
                        thickness: 1,
                        color: LINE_COLOR,
                        opacity: LINE_OPACITY,
                    })
                }
            } else if (page.template === 'lined') {
                for (let y = LINE_SPACING; y < PAGE_HEIGHT; y += LINE_SPACING) {
                    pdfPage.drawLine({
                        start: { x: 0, y: PAGE_HEIGHT - y },
                        end: { x: PAGE_WIDTH, y: PAGE_HEIGHT - y },
                        thickness: 1,
                        color: LINE_COLOR,
                        opacity: LINE_OPACITY,
                    })
                }
            }
        }

        const { width, height } = pdfPage.getSize()
        drawAnnotationsOnPage(pdfPage, page, { x: width / PAGE_WIDTH, y: height / PAGE_HEIGHT })
    }

    const pdfBytes = await pdfDoc.save()
    download(pdfBytes, `${notebook.title || 'Notebook'}.pdf`, 'application/pdf')
}

export async function exportAnnotatedPDF(
    pdfFile: PDFFile,
    annotationsMap: Record<number, { strokes: Stroke[]; textFields: TextField[]; shapes?: Shape[] }>
) {
    const pdfBytes = new Uint8Array(await pdfFile.blob.arrayBuffer())
    const sourceDoc = await PDFDocument.load(pdfBytes)
    const pdfDoc = await PDFDocument.create()
    const pageIndices = Array.from({ length: sourceDoc.getPageCount() }, (_, i) => i)
    const copiedPages = await pdfDoc.copyPages(sourceDoc, pageIndices)

    for (let i = 0; i < copiedPages.length; i++) {
        const pdfPage = pdfDoc.addPage(copiedPages[i])
        const pageNumber = i + 1
        const ann = annotationsMap[pageNumber]

        if (ann) {
            drawAnnotationsOnPage(pdfPage, ann, { x: 1, y: 1 })
        }
    }

    const outputBytes = await pdfDoc.save()
    download(outputBytes, `Annotated_${pdfFile.name}`, 'application/pdf')
}