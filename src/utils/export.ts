import { PDFDocument, rgb } from 'pdf-lib'
import download from 'downloadjs'
import type { Notebook, Page, Stroke, TextField, PDFFile } from '../types'
import { getPDFFile } from '../storage/db'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import { splitStroke } from './geometry'

const LINE_COLOR = rgb(0, 0, 0)
const LINE_OPACITY = 0.12
const GRID_SPACING = 20
const LINE_SPACING = 24
const PAPER_BG = rgb(0.98, 0.98, 0.97) // #fafaf8

// ----------------------------------------------------------------------
//  Helper functions for smooth stroke interpolation
// ----------------------------------------------------------------------

/**
 * Converts a hex color string to pdf-lib RGB object
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
 * Catmull‑Rom spline interpolation for a single value
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

/**
 * Linear interpolation between two numbers
 */
function lerp(a: number, b: number, t: number): number {
    return a * (1 - t) + b * t
}

/**
 * Inserts extra points along a stroke using Catmull‑Rom spline.
 * This smooths the path and increases point density for better circle coverage.
 */
function interpolateStrokePoints(
    points: { x: number; y: number; pressure: number }[],
    segmentsPerSegment = 4
): typeof points {
    if (points.length < 3) return points
    const result: typeof points = []

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(i - 1, 0)]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = points[Math.min(i + 2, points.length - 1)]

        for (let s = 0; s < segmentsPerSegment; s++) {
            const t = s / segmentsPerSegment
            const x = catmullRom(p0.x, p1.x, p2.x, p3.x, t)
            const y = catmullRom(p0.y, p1.y, p2.y, p3.y, t)
            const pressure = lerp(p1.pressure, p2.pressure, t)
            result.push({ x, y, pressure })
        }
    }

    // Add the last point explicitly
    result.push(points[points.length - 1])
    return result
}

// ----------------------------------------------------------------------
//  Core drawing function – improved for smooth, high‑quality strokes
// ----------------------------------------------------------------------

/**
 * Draws strokes and text fields on a pdf-lib PDFPage with high quality.
 * - Interpolates points to eliminate jagged edges
 * - Draws overlapping filled circles to create smooth joins and ends
 * - Interpolates thickness/pressure along each segment
 */
function drawAnnotationsOnPage(
    pdfPage: any,
    pageContent: { strokes: Stroke[]; textFields?: TextField[] },
    scale: { x: number; y: number } = { x: 1, y: 1 }
) {
    const { height } = pdfPage.getSize()
    const { x: scaleX, y: scaleY } = scale

    // --------------------------------------------------------------------
    //  Draw Strokes
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

            // 1. Increase point density and smooth the path
            const smoothPoints = interpolateStrokePoints(fragment.points, 4) // 4x density

            // 2. Draw a filled circle at every point (gives smooth joins and ends)
            for (const point of smoothPoints) {
                // Radius = half of the previous line thickness (thickness = log(p+1)*size*2*scaleX)
                const radius = Math.log(point.pressure + 1) * stroke.size * scaleX
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

            // 3. (Optional) Draw connecting lines with averaged thickness
            //    This reinforces the shape and helps with very low‑density input.
            for (let j = 1; j < smoothPoints.length; j++) {
                const p1 = smoothPoints[j - 1]
                const p2 = smoothPoints[j]
                const avgPressure = (p1.pressure + p2.pressure) / 2
                const thickness = Math.log(avgPressure + 1) * (stroke.size * 2) * scaleX

                pdfPage.drawLine({
                    start: { x: p1.x * scaleX, y: height - p1.y * scaleY },
                    end: { x: p2.x * scaleX, y: height - p2.y * scaleY },
                    thickness: thickness,
                    color: rgb(color.r, color.g, color.b),
                    opacity: opacity,
                    lineCap: 1, // round cap
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
    annotationsMap: Record<number, { strokes: Stroke[]; textFields: TextField[] }>
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
            // Standalone PDFs use their own coordinate system (1:1 scale)
            drawAnnotationsOnPage(pdfPage, ann, { x: 1, y: 1 })
        }
    }

    const outputBytes = await pdfDoc.save()
    download(outputBytes, `Annotated_${pdfFile.name}`, 'application/pdf')
}