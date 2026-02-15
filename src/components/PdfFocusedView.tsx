import React, { useEffect, useState } from 'react'
import Loader from './Loader'
import { getPDFFile, getPDFAnnotation, savePDFAnnotation } from '../storage/db'
import type { PDFFile, PDFAnnotation, ToolType, Stroke, TextField, Shape, Operation, ShapeType } from '../types'
import { getPDFPageCount, getPDFPageDimensions } from '../utils/pdf'
import { exportAnnotatedPDF } from '../utils/export'
import EditablePage from './EditablePage'

interface PdfFocusedViewProps {
    pdfFileId: string
    onClose: () => void
    activeTool: ToolType
    activeColor: string
    activeSize: number
    selectedShapeType?: ShapeType
    onToolChange?: (tool: ToolType) => void
    onActionsUpdate?: (actions: { undo: () => void, redo: () => void, canUndo: boolean, canRedo: boolean }) => void
}

const PdfFocusedView: React.FC<PdfFocusedViewProps> = ({
    pdfFileId,
    onClose,
    activeTool,
    activeColor,
    activeSize,
    selectedShapeType,
    onToolChange,
    onActionsUpdate
}) => {
    const [pdfFile, setPdfFile] = useState<PDFFile | null>(null)
    const [pageCount, setPageCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [annotations, setAnnotations] = useState<Record<number, PDFAnnotation>>({})
    const [pageDimensions, setPageDimensions] = useState<Record<number, { width: number, height: number }>>({})
    const [isExporting, setIsExporting] = useState(false)
    const [undoStack, setUndoStack] = useState<Operation[]>([])
    const [redoStack, setRedoStack] = useState<Operation[]>([])

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

    const handleUpdateAnnotation = async (pageNumber: number, strokes: Stroke[], textFields: TextField[], shapes: Shape[]) => {
        const id = `${pdfFileId}_${pageNumber}`
        const annotation: PDFAnnotation = {
            id,
            pdfFileId,
            pageNumber,
            strokes,
            textFields,
            shapes
        }
        await savePDFAnnotation(annotation)
        setAnnotations((prev: Record<number, PDFAnnotation>) => ({ ...prev, [pageNumber]: annotation }))
    }

    const handleOperation = async (op: Operation) => {
        // Extract pageNumber from pageId (which is `${pdfFileId}_${pageNumber}`)
        const match = op.pageId.match(/_(\d+)$/)
        if (!match) return
        const pageNumber = parseInt(match[1])

        const currentAnnotations = annotations[pageNumber] || {
            id: op.pageId,
            pdfFileId,
            pageNumber,
            strokes: [],
            textFields: [],
            shapes: []
        }

        let updatedStrokes = [...currentAnnotations.strokes]
        let updatedTextFields = [...currentAnnotations.textFields]
        let updatedShapes = [...currentAnnotations.shapes]

        if (op.type === 'add') {
            updatedStrokes.push(op.stroke)
        } else if (op.type === 'bulk-update') {
            updatedStrokes = op.newStrokes
            updatedTextFields = op.newTextFields || updatedTextFields
            updatedShapes = op.newShapes || updatedShapes
        }

        await handleUpdateAnnotation(pageNumber, updatedStrokes, updatedTextFields, updatedShapes)
        setUndoStack(prev => [...prev, op])
        setRedoStack([])
    }

    const handleUndo = async () => {
        if (undoStack.length === 0) return
        const newUndoStack = [...undoStack]
        const op = newUndoStack.pop()!
        setUndoStack(newUndoStack)

        const match = op.pageId.match(/_(\d+)$/)
        if (!match) return
        const pageNumber = parseInt(match[1])
        const currentAnnotations = annotations[pageNumber]

        if (!currentAnnotations) return

        let updatedStrokes = [...currentAnnotations.strokes]
        let updatedTextFields = [...currentAnnotations.textFields]
        let updatedShapes = [...currentAnnotations.shapes]

        if (op.type === 'add') {
            updatedStrokes = updatedStrokes.filter(s => s.id !== op.stroke.id)
        } else if (op.type === 'bulk-update') {
            updatedStrokes = op.oldStrokes
            updatedTextFields = op.oldTextFields || updatedTextFields
            updatedShapes = op.oldShapes || updatedShapes
        }

        await handleUpdateAnnotation(pageNumber, updatedStrokes, updatedTextFields, updatedShapes)
        setRedoStack(prev => [...prev, op])
    }

    const handleRedo = async () => {
        if (redoStack.length === 0) return
        const newRedoStack = [...redoStack]
        const op = newRedoStack.pop()!
        setRedoStack(newRedoStack)

        const match = op.pageId.match(/_(\d+)$/)
        if (!match) return
        const pageNumber = parseInt(match[1])
        const currentAnnotations = annotations[pageNumber] || {
            id: op.pageId,
            pdfFileId,
            pageNumber,
            strokes: [],
            textFields: [],
            shapes: []
        }

        let updatedStrokes = [...currentAnnotations.strokes]
        let updatedTextFields = [...currentAnnotations.textFields]
        let updatedShapes = [...currentAnnotations.shapes]

        if (op.type === 'add') {
            updatedStrokes.push(op.stroke)
        } else if (op.type === 'bulk-update') {
            updatedStrokes = op.newStrokes
            updatedTextFields = op.newTextFields || updatedTextFields
            updatedShapes = op.newShapes || updatedShapes
        }

        await handleUpdateAnnotation(pageNumber, updatedStrokes, updatedTextFields, updatedShapes)
        setUndoStack(prev => [...prev, op])
    }

    useEffect(() => {
        if (onActionsUpdate) {
            onActionsUpdate({
                undo: handleUndo,
                redo: handleRedo,
                canUndo: undoStack.length > 0,
                canRedo: redoStack.length > 0
            })
        }
    }, [undoStack.length, redoStack.length, onActionsUpdate])

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    handleRedo()
                } else {
                    handleUndo()
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                handleRedo()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [undoStack, redoStack])

    /*  const handleExport = async () => {
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
     } */

    if (loading) return <Loader />

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
            background: '#ffffff05',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Legacy top bar */}
            {/*  <div style={{
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
 */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '80px 0',
                display: 'flex',
                flexDirection: 'column',
                /* row is also a good option for big pdfs */
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
                                shapes: annotations[pageNumber]?.shapes || [],
                                createdAt: 0,
                                pdfFileId,
                                pdfPageNumber: pageNumber
                            }}
                            scale={0.79} // We can adjust this later
                            width={pageDimensions[pageNumber]?.width}
                            height={pageDimensions[pageNumber]?.height}
                            activeTool={activeTool}
                            activeColor={activeColor}
                            activeSize={activeSize}
                            selectedShapeType={selectedShapeType}
                            onUpdate={(updated) => handleUpdateAnnotation(pageNumber, updated.strokes, updated.textFields, updated.shapes)}
                            onOperation={handleOperation}
                            onToolChange={onToolChange}
                            onInputTypeChange={() => { }}
                        />
                    </div>
                ))}
            </div>
        </div >
    )
}

export default PdfFocusedView
