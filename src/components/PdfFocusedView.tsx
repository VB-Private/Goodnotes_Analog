import React, { useEffect, useState } from 'react'
import { getPDFFile, getPDFAnnotation, savePDFAnnotation } from '../storage/db'
import type { PDFFile, PDFAnnotation, ToolType, Stroke, TextField } from '../types'
import { getPDFPageCount, getPDFPageDimensions } from '../utils/pdf'
import { exportAnnotatedPDF } from '../utils/export'
import EditablePage from './EditablePage'

interface PdfFocusedViewProps {
    pdfFileId: string
    onClose: () => void
    activeTool: ToolType
    activeColor: string
    activeSize: number
}

const PdfFocusedView: React.FC<PdfFocusedViewProps> = ({
    pdfFileId,
    onClose,
    activeTool,
    activeColor,
    activeSize
}) => {
    const [pdfFile, setPdfFile] = useState<PDFFile | null>(null)
    const [pageCount, setPageCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [annotations, setAnnotations] = useState<Record<number, PDFAnnotation>>({})
    const [pageDimensions, setPageDimensions] = useState<Record<number, { width: number, height: number }>>({})
    const [isExporting, setIsExporting] = useState(false)

    useEffect(() => {
        async function init() {
            const file = await getPDFFile(pdfFileId)
            if (!file) {
                onClose()
                return
            }
            setPdfFile(file)
            const count = await getPDFPageCount(file.blob)
            setPageCount(count)

            const dims: Record<number, { width: number, height: number }> = {}
            const initialAnnotations: Record<number, PDFAnnotation> = {}

            for (let i = 1; i <= count; i++) {
                const [dim, ann] = await Promise.all([
                    getPDFPageDimensions(file.blob, i),
                    getPDFAnnotation(`${pdfFileId}_${i}`)
                ])
                if (dim) dims[i] = dim
                if (ann) initialAnnotations[i] = ann
            }
            setPageDimensions(dims)
            setAnnotations(initialAnnotations)
            setLoading(false)
        }
        init()
    }, [pdfFileId])

    const handleUpdateAnnotation = async (pageNumber: number, strokes: Stroke[], textFields: TextField[]) => {
        const id = `${pdfFileId}_${pageNumber}`
        const annotation: PDFAnnotation = {
            id,
            pdfFileId,
            pageNumber,
            strokes,
            textFields
        }
        await savePDFAnnotation(annotation)
        setAnnotations((prev: Record<number, PDFAnnotation>) => ({ ...prev, [pageNumber]: annotation }))
    }

    const handleExport = async () => {
        if (!pdfFile) return
        setIsExporting(true)
        try {
            await exportAnnotatedPDF(pdfFile, annotations)
        } catch (error) {
            console.error('Standalone PDF export failed:', error)
            alert('Failed to export PDF.')
        } finally {
            setIsExporting(false)
        }
    }

    if (loading) return null

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
            background: '#000',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            <div style={{
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#1e293b',
                color: '#fff'
            }}>
                <h2 style={{ fontSize: '16px', margin: 0 }}>{pdfFile?.name}</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        style={{
                            padding: '8px 16px',
                            background: '#020617',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: isExporting ? 'not-allowed' : 'pointer',
                            opacity: isExporting ? 0.7 : 1,
                            fontSize: '14px',
                            fontWeight: 600
                        }}
                    >
                        {isExporting ? 'Exporting...' : 'Export PDF'}
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 600
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px'
            }}>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(pageNumber => (
                    <div key={pageNumber} style={{ position: 'relative' }}>
                        <EditablePage
                            page={{
                                id: `${pdfFileId}_${pageNumber}`,
                                notebookId: 'pdf', // Dummy
                                template: 'pdf',
                                strokes: annotations[pageNumber]?.strokes || [],
                                textFields: annotations[pageNumber]?.textFields || [],
                                createdAt: 0,
                                pdfFileId,
                                pdfPageNumber: pageNumber
                            }}
                            scale={0.8} // We can adjust this later
                            width={pageDimensions[pageNumber]?.width}
                            height={pageDimensions[pageNumber]?.height}
                            activeTool={activeTool}
                            activeColor={activeColor}
                            activeSize={activeSize}
                            onUpdate={(updated) => handleUpdateAnnotation(pageNumber, updated.strokes, updated.textFields)}
                            onInputTypeChange={() => { }}
                        />
                    </div>
                ))}
            </div>
        </div >
    )
}

export default PdfFocusedView
