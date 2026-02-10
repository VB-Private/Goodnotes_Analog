import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Set up worker locally via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

/**
 * Loads a PDF from a Blob and returns the document object.
 */
export async function loadPDF(blob: Blob) {
    const arrayBuffer = await blob.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    return loadingTask.promise
}

/**
 * Gets the number of pages in a PDF.
 */
export async function getPDFPageCount(blob: Blob): Promise<number> {
    try {
        const pdf = await loadPDF(blob)
        return pdf.numPages
    } catch (error) {
        console.error('Error getting PDF page count:', error)
        return 0
    }
}
/**
 * Gets the dimensions of a specific page in a PDF.
 */
export async function getPDFPageDimensions(blob: Blob, pageNumber: number): Promise<{ width: number, height: number } | null> {
    try {
        const pdf = await loadPDF(blob)
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 1 })
        return { width: viewport.width, height: viewport.height }
    } catch (error) {
        console.error('Error getting PDF page dimensions:', error)
        return null
    }
}
