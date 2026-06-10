import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Set up worker locally via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

/**
 * Loads a PDF from a Blob and returns the document object.
 */
export async function loadPDF(blob: Blob): Promise<pdfjsLib.PDFDocumentProxy> {
    const arrayBuffer = await blob.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    return loadingTask.promise
}

// In-memory cache of loading promises to prevent redundant parsing
const documentCache = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>()

/**
 * Gets a cached PDF loading promise or creates a new one if it doesn't exist.
 */
export async function getCachedPDF(pdfFileId: string, blob: Blob): Promise<pdfjsLib.PDFDocumentProxy> {
    let promise = documentCache.get(pdfFileId)
    if (!promise) {
        promise = loadPDF(blob)
        documentCache.set(pdfFileId, promise)
    }
    return promise
}

/**
 * Clears the cached promise for a specific PDF.
 */
export function clearPDFCache(pdfFileId: string): void {
    documentCache.delete(pdfFileId)
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

/**
 * Loads a PDF from a Blob, retrieves its page count and the dimensions of all pages in a single pass.
 */
export async function getPDFPageCountAndDimensions(pdfFileId: string, blob: Blob): Promise<{ pageCount: number, dimensions: Record<number, { width: number, height: number }> }> {
    try {
        const pdf = await getCachedPDF(pdfFileId, blob)
        const pageCount = pdf.numPages
        const dimensions: Record<number, { width: number, height: number }> = {}

        // Fetch all page dimensions sequentially using the same loaded doc
        for (let i = 1; i <= pageCount; i++) {
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: 1 })
            dimensions[i] = { width: viewport.width, height: viewport.height }
        }

        return { pageCount, dimensions }
    } catch (error) {
        console.error('Error getting PDF page count and dimensions:', error)
        return { pageCount: 0, dimensions: {} }
    }
}
