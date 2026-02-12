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

/**
 * Colors hex string to pdf-lib RGB
 */
function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
    } : { r: 0, g: 0, b: 0 }
}

/**
 * Draws strokes and text fields on a pdf-lib PDFPage
 */
function drawAnnotationsOnPage(
    pdfPage: any,
    pageContent: { strokes: Stroke[]; textFields?: TextField[] },
    scale: { x: number; y: number } = { x: 1, y: 1 }
) {
    const { height } = pdfPage.getSize()
    const { x: scaleX, y: scaleY } = scale

    // Draw Strokes
    for (let i = 0; i < pageContent.strokes.length; i++) {
        const stroke = pageContent.strokes[i]
        if (stroke.points.length < 2) continue
        if (stroke.tool === 'eraser') continue

        const relevantErasers = pageContent.strokes.slice(i + 1).filter(e => e.tool === 'eraser')
        const fragments = relevantErasers.length > 0 ? splitStroke(stroke, relevantErasers) : [stroke]

        const color = hexToRgb(stroke.color)
        let opacity = 1.0
        if (stroke.tool === 'pencil') opacity = 0.6
        if (stroke.tool === 'crayon') opacity = 0.4

        for (const fragment of fragments) {
            if (fragment.points.length < 2) continue
            for (let j = 1; j < fragment.points.length; j++) {
                const p1 = fragment.points[j - 1]
                const p2 = fragment.points[j]
                const thickness = Math.log(p2.pressure + 1) * (stroke.size * 2) * scaleX

                pdfPage.drawLine({
                    start: { x: p1.x * scaleX, y: height - (p1.y * scaleY) },
                    end: { x: p2.x * scaleX, y: height - (p2.y * scaleY) },
                    thickness: thickness,
                    color: rgb(color.r, color.g, color.b),
                    opacity: opacity,
                    lineCap: 1,
                })
            }
        }
    }

    // Draw Text Fields
    for (const tf of pageContent.textFields || []) {
        if (!tf.text) continue
        const color = hexToRgb(tf.color)
        pdfPage.drawText(tf.text, {
            x: tf.x * scaleX,
            y: height - (tf.y * scaleY) - (tf.fontSize * scaleY),
            size: tf.fontSize * scaleY,
            color: rgb(color.r, color.g, color.b),
        })
    }
}

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
                    pdfPage.drawLine({ start: { x: x, y: 0 }, end: { x: x, y: PAGE_HEIGHT }, thickness: 1, color: LINE_COLOR, opacity: LINE_OPACITY })
                }
                for (let y = 0; y <= PAGE_HEIGHT; y += GRID_SPACING) {
                    pdfPage.drawLine({ start: { x: 0, y: y }, end: { x: PAGE_WIDTH, y: y }, thickness: 1, color: LINE_COLOR, opacity: LINE_OPACITY })
                }
            } else if (page.template === 'lined') {
                for (let y = LINE_SPACING; y < PAGE_HEIGHT; y += LINE_SPACING) {
                    pdfPage.drawLine({ start: { x: 0, y: PAGE_HEIGHT - y }, end: { x: PAGE_WIDTH, y: PAGE_HEIGHT - y }, thickness: 1, color: LINE_COLOR, opacity: LINE_OPACITY })
                }
            }
        }

        const { width, height } = pdfPage.getSize()
        drawAnnotationsOnPage(pdfPage, page, { x: width / PAGE_WIDTH, y: height / PAGE_HEIGHT })
    }

    const pdfBytes = await pdfDoc.save()
    download(pdfBytes, `${notebook.title || 'Notebook'}.pdf`, 'application/pdf')
}

export async function exportAnnotatedPDF(pdfFile: PDFFile, annotationsMap: Record<number, { strokes: Stroke[]; textFields: TextField[] }>) {
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
            // Standalone PDFs use their own coordinate system (from EditablePage in PdfFocusedView)
            // But currently EditablePage in PdfFocusedView just uses the native dimensions.
            // Let's assume annotations were made on the native dimensions if width/height were passed.
            // In PdfFocusedView, we pass pageDimensions[pageNumber].width/height.
            // So scale for Standalone PDFs should be 1:1 if we use the same dimensions.
            drawAnnotationsOnPage(pdfPage, ann, { x: 1, y: 1 })
        }
    }

    const outputBytes = await pdfDoc.save()
    download(outputBytes, `Annotated_${pdfFile.name}`, 'application/pdf')
}
