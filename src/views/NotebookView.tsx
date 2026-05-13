import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getNotebook, getPages, updateNotebook, createPage, updatePage, deletePage, savePDFFile, getPDFFile, deletePDFFile, deletePDFAnnotationsForFile, getPDFAnnotation, getFolder } from '../storage/db'
import type { Notebook, Page, PageTemplate, ToolType, ShapeType, PDFFile, Operation, Tab, PDFAnnotation } from '../types'
import PdfFocusedView from '../components/PdfFocusedView'
import AddPageModal from '../components/AddPageModal'
import EditablePage from '../components/EditablePage'
import Toolkit from '../components/Toolkit'
import Loader from '../components/Loader'
import PagePreview from '../components/PagePreview'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import { exportNotebookToPDF, exportAnnotatedPDF } from '../utils/export'
import { getPDFPageCount } from '../utils/pdf'
import { useZoomPan } from '../hooks/useZoomPan'
import { useIsContentOffscreen, useFitToContent } from '../hooks/useBackToContent'
import BackToContentButton from '../components/BackToContentButton'

function generateId(): string {
  return crypto.randomUUID()
}

export default function NotebookView() {
  const { notebookId } = useParams<{ notebookId: string }>()
  const navigate = useNavigate()
  const [notebook, setNotebook] = useState<Notebook | null>(null)
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const { zoom, offsetX, offsetY, containerRef, screenToCanvas, setPan, setViewport, getViewport } = useZoomPan()

  // Track canvas container dimensions for offscreen detection
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)

  // Combined callback ref: feeds the same node to both useZoomPan and our size observer
  const mergedCanvasRef = useCallback((el: HTMLDivElement | null) => {
    containerRef(el)
    canvasContainerRef.current = el
  }, [containerRef])

  // Viewport object for the offscreen hook
  const viewport = useMemo(() => ({ zoom, offsetX, offsetY }), [zoom, offsetX, offsetY])

  const TOOLKIT_STORAGE_KEY = 'goodnotes-toolkit-settings'

  // Toolkit state
  const [activeTool, setActiveTool] = useState<ToolType>(() => {
    const saved = localStorage.getItem(TOOLKIT_STORAGE_KEY)
    return saved ? JSON.parse(saved).activeTool : 'pen'
  })
  const [activeColor, setActiveColor] = useState(() => {
    const saved = localStorage.getItem(TOOLKIT_STORAGE_KEY)
    return saved ? JSON.parse(saved).activeColor : '#000000'
  })
  const [penSize, setPenSize] = useState(() => {
    const saved = localStorage.getItem(TOOLKIT_STORAGE_KEY)
    return saved ? JSON.parse(saved).penSize : 5
  })
  const [eraserSize, setEraserSize] = useState(() => {
    const saved = localStorage.getItem(TOOLKIT_STORAGE_KEY)
    return saved ? JSON.parse(saved).eraserSize : 40
  })
  const [isShapeFilled, setIsShapeFilled] = useState(() => {
    const saved = localStorage.getItem(TOOLKIT_STORAGE_KEY)
    return saved && JSON.parse(saved).isShapeFilled !== undefined ? JSON.parse(saved).isShapeFilled : true
  })
  const [lassoPicksShapes, setLassoPicksShapes] = useState(() => {
    const saved = localStorage.getItem(TOOLKIT_STORAGE_KEY)
    return saved && JSON.parse(saved).lassoPicksShapes !== undefined ? JSON.parse(saved).lassoPicksShapes : false
  })

  useEffect(() => {
    localStorage.setItem(TOOLKIT_STORAGE_KEY, JSON.stringify({
      activeTool,
      activeColor,
      penSize,
      eraserSize,
      isShapeFilled,
      lassoPicksShapes
    }))
  }, [activeTool, activeColor, penSize, eraserSize, isShapeFilled, lassoPicksShapes])

  const activeSize = activeTool === 'eraser' ? eraserSize : penSize
  const onSizeChange = (size: number) => {
    if (activeTool === 'eraser') {
      setEraserSize(size)
    } else {
      setPenSize(size)
    }
  }
  // const [inputType, setInputType] = useState<'pen' | 'touch' | null>(null) // Removed to fix lint
  const [undoStack, setUndoStack] = useState<Operation[]>([])
  const [redoStack, setRedoStack] = useState<Operation[]>([])
  const [activeMenuPageId, setActiveMenuPageId] = useState<string | null>(null)
  const [activeTabMenuId, setActiveTabMenuId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [pdfActions, setPdfActions] = useState<{ undo: () => void, redo: () => void, canUndo: boolean, canRedo: boolean } | null>(null)
  const [openTabs, setOpenTabs] = useState<Tab[]>([{ id: 'notes', type: 'notes', title: 'Notes' }])
  const [activeTabId, setActiveTabId] = useState<string>('notes')
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([])
  const [selectedShapeType, setSelectedShapeType] = useState<ShapeType>('circle')
  const [copyTrigger, setCopyTrigger] = useState(0)
  const hasAttemptedInitialScroll = useRef(false)

  // Attach ResizeObserver to measure the notes canvas area
  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return
    setCanvasSize({ width: el.clientWidth, height: el.clientHeight })
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasContainerRef.current])

  const isContentOffscreen = useIsContentOffscreen(pages, viewport, canvasSize.width, canvasSize.height)
  const fitToContent = useFitToContent(pages, canvasSize.width, canvasSize.height, setViewport, getViewport)

  useEffect(() => {
    function handleClickOutside() {
      setActiveMenuPageId(null)
      setActiveTabMenuId(null)
    }
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!notebookId) return
    hasAttemptedInitialScroll.current = false
    Promise.all([getNotebook(notebookId), getPages(notebookId)]).then(async ([nb, p]) => {
      const notebook = nb ?? null
      setNotebook(notebook)
      setPages(p.sort((a, b) => a.createdAt - b.createdAt))

      if (notebook && notebook.pdfIds) {
        const metadata: Record<string, { name: string }> = {}
        const pdfFiles = await Promise.all(notebook.pdfIds.map(id => getPDFFile(id)))
        const pdfTabs: Tab[] = []

        pdfFiles.forEach((file, index) => {
          if (file) {
            const id = notebook.pdfIds[index]
            metadata[id] = { name: file.name }
            pdfTabs.push({ id, type: 'pdf', title: file.name })
          }
        })

        setOpenTabs([{ id: 'notes', type: 'notes', title: 'Notes' }, ...pdfTabs])
      } else {
        setOpenTabs([{ id: 'notes', type: 'notes', title: 'Notes' }])
      }

      setLoading(false)
    })
  }, [notebookId])

  // Scale is now managed by useZoomPan hook (zoom state)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          if (activeTabId !== 'notes' && pdfActions) {
            pdfActions.redo()
          } else {
            handleRedo()
          }
        } else {
          if (activeTabId !== 'notes' && pdfActions) {
            pdfActions.undo()
          } else {
            handleUndo()
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (activeTabId !== 'notes' && pdfActions) {
          pdfActions.redo()
        } else {
          handleRedo()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undoStack, redoStack, activeTabId, pdfActions])

  useEffect(() => {
    if (activeTabId !== 'notes') return
    if (loading || pages.length === 0 || !notebook || hasAttemptedInitialScroll.current) return

    const targetPageId = notebook.lastPageId || pages[pages.length - 1].id

    // We wait a bit longer to ensure everything (Paper background, EditablePage, etc.) has rendered at the correct scale
    const scrollTimeout = setTimeout(() => {
      let targetEl = document.getElementById(`page-wrapper-${targetPageId}`)
      
      // Fallback to last page if target is missing
      if (!targetEl) {
        targetEl = document.getElementById(`page-wrapper-${pages[pages.length - 1].id}`)
      }

      if (targetEl) {
        // Find the relative offset from the top of the transform container
        // Subtract a little padding (e.g. 60px) so the page isn't flushed hard against the top edge
        const topOffset = targetEl.offsetTop - 60
        
        // Use our Hook's internal pan state instead of native browser scroll
        setPan(0, -topOffset)
        hasAttemptedInitialScroll.current = true
      }
    }, 300)

    return () => clearTimeout(scrollTimeout)
  }, [loading, notebook, pages, zoom, activeTabId, setPan])

  // Reset scroll attempt when switching tabs so we scroll to last page again when returning to notes
  useEffect(() => {
    hasAttemptedInitialScroll.current = false
  }, [activeTabId])

  function handlePageUpdate(updatedPage: Page) {
    // Save last edited page
    if (!notebook) return
    const updatedNb = { ...notebook, lastPageId: updatedPage.id }
    updateNotebook(updatedNb)
    setNotebook(updatedNb)

    const updatedPages = pages.map(p => p.id === updatedPage.id ? updatedPage : p)
    setPages(updatedPages)
    updatePage(updatedPage)
  }

  function handleOperation(op: Operation) {
    if (op.type === 'add') {
      const pageToUpdate = pages.find(p => p.id === op.pageId)
      if (pageToUpdate) {
        const updatedPage = {
          ...pageToUpdate,
          strokes: [...pageToUpdate.strokes, op.stroke]
        }
        handlePageUpdate(updatedPage)
        setUndoStack(prev => [...prev, op])
        setRedoStack([])
      }
    } else if (op.type === 'bulk-update') {
      const pageToUpdate = pages.find(p => p.id === op.pageId)
      if (pageToUpdate) {
        const updatedPage = {
          ...pageToUpdate,
          strokes: op.newStrokes,
          textFields: op.newTextFields || pageToUpdate.textFields,
          shapes: op.newShapes || pageToUpdate.shapes
        }
        handlePageUpdate(updatedPage)
        setUndoStack(prev => [...prev, op])
        setRedoStack([])
      }
    }
  }

  function handleUndo() {
    if (undoStack.length === 0) return

    const newUndoStack = [...undoStack]
    const op = newUndoStack.pop()!
    setUndoStack(newUndoStack)

    if (op.type === 'add') {
      const pageToUndo = pages.find(p => p.id === op.pageId)
      if (pageToUndo) {
        const updatedPage = {
          ...pageToUndo,
          strokes: pageToUndo.strokes.filter(s => s.id !== op.stroke.id)
        }
        updatePage(updatedPage)
        setPages(prev => prev.map(p => p.id === updatedPage.id ? updatedPage : p))
        setRedoStack(prev => [...prev, op])
      }
    } else if (op.type === 'bulk-update') {
      const pageToUndo = pages.find(p => p.id === op.pageId)
      if (pageToUndo) {
        const updatedPage = {
          ...pageToUndo,
          strokes: op.oldStrokes,
          textFields: op.oldTextFields || pageToUndo.textFields,
          shapes: op.oldShapes || pageToUndo.shapes
        }
        updatePage(updatedPage)
        setPages(prev => prev.map(p => p.id === updatedPage.id ? updatedPage : p))
        setRedoStack(prev => [...prev, op])
      }
    }
  }

  function handleRedo() {
    if (redoStack.length === 0) return

    const newRedoStack = [...redoStack]
    const op = newRedoStack.pop()!
    setRedoStack(newRedoStack)

    if (op.type === 'add') {
      const pageToRedo = pages.find(p => p.id === op.pageId)
      if (pageToRedo) {
        const updatedPage = {
          ...pageToRedo,
          strokes: [...pageToRedo.strokes, op.stroke]
        }
        updatePage(updatedPage)
        setPages(prev => prev.map(p => p.id === updatedPage.id ? updatedPage : p))
        setUndoStack(prev => [...prev, op])
      }
    } else if (op.type === 'bulk-update') {
      const pageToRedo = pages.find(p => p.id === op.pageId)
      if (pageToRedo) {
        const updatedPage = {
          ...pageToRedo,
          strokes: op.newStrokes,
          textFields: op.newTextFields || pageToRedo.textFields,
          shapes: op.newShapes || pageToRedo.shapes
        }
        updatePage(updatedPage)
        setPages(prev => prev.map(p => p.id === updatedPage.id ? updatedPage : p))
        setUndoStack(prev => [...prev, op])
      }
    }
  }

  async function handleAddPage(template: PageTemplate) {
    if (!notebookId || !notebook) return
    const pageId = generateId()
    const page: Page = {
      id: pageId,
      notebookId,
      template,
      strokes: [],
      textFields: [],
      shapes: [],
      createdAt: Date.now(),
    }
    await createPage(page)
    const updated: Notebook = {
      ...notebook,
      pageIds: [...notebook.pageIds, pageId],
    }
    await updateNotebook(updated)
    setNotebook(updated)
    setPages((prev) => [...prev, page].sort((a, b) => a.createdAt - b.createdAt))
    setShowAddModal(false)

    // Scroll to the new page is already handled by the existing setTimeout below
    // but we should also update lastPageId for the notebook
    const notebookWithLastPage = { ...updated, lastPageId: pageId }
    await updateNotebook(notebookWithLastPage)
    setNotebook(notebookWithLastPage)

    // Scroll handled by zoom/pan now
  }

  async function handleImportPDF(file: File) {
    if (!notebookId || !notebook) return
    console.log('[NotebookView] Starting PDF import:', file.name)
    setLoading(true)

    try {
      const pdfId = generateId()
      const pdfFile: PDFFile = {
        id: pdfId,
        blob: file,
        name: file.name,
        createdAt: Date.now()
      }
      console.log('[NotebookView] Saving PDF file to DB:', pdfId)
      await savePDFFile(pdfFile)

      const updatedNotebook: Notebook = {
        ...notebook,
        pdfIds: [...(notebook.pdfIds || []), pdfId],
      }
      await updateNotebook(updatedNotebook)

      setNotebook(updatedNotebook)
      setShowAddModal(false)

      const newTab: Tab = { id: pdfId, type: 'pdf', title: file.name }
      setOpenTabs(prev => {
        if (prev.find(t => t.id === pdfId)) return prev
        return [...prev, newTab]
      })
      setActiveTabId(pdfId)
    } catch (error) {
      console.error('Failed to import PDF:', error)
      alert('Failed to import PDF. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeletePage(pageId: string) {
    if (!confirm('Are you sure you want to delete this page?')) return

    // Optimistic update
    const newPages = pages.filter(p => p.id !== pageId)
    setPages(newPages)

    if (notebook) {
      const newPageIds = notebook.pageIds.filter(id => id !== pageId)
      const updatedNb = { ...notebook, pageIds: newPageIds }
      // Update lastPageId if needed
      if (updatedNb.lastPageId === pageId) {
        updatedNb.lastPageId = newPageIds[newPageIds.length - 1] || undefined
      }
      setNotebook(updatedNb)
      updateNotebook(updatedNb)
    }

    await deletePage(pageId)
    setActiveMenuPageId(null)
  }

  async function handleDeletePDF(e: React.MouseEvent, pdfId: string) {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this PDF and all its annotations?')) return

    setLoading(true)
    try {
      if (notebook) {
        const updatedNb = {
          ...notebook,
          pdfIds: (notebook.pdfIds || []).filter(id => id !== pdfId)
        }
        await updateNotebook(updatedNb)
        setNotebook(updatedNb)
      }

      await deletePDFFile(pdfId)
      await deletePDFAnnotationsForFile(pdfId)

      setOpenTabs(prev => prev.filter(t => t.id !== pdfId))
      if (activeTabId === pdfId) setActiveTabId('notes')
    } catch (error) {
      console.error('Failed to delete PDF:', error)
      alert('Failed to delete PDF.')
    } finally {
      setLoading(false)
    }
  }

  async function handleClearPage(pageId: string) {
    if (!confirm('Are you sure you want to clear all content on this page?')) return

    const pageToClear = pages.find(p => p.id === pageId)
    if (pageToClear) {
      handleOperation({
        type: 'bulk-update',
        pageId,
        oldStrokes: pageToClear.strokes,
        newStrokes: [],
        oldTextFields: pageToClear.textFields,
        newTextFields: [],
        oldShapes: pageToClear.shapes,
        newShapes: []
      })
    }
    setActiveMenuPageId(null)
  }

  async function handleExport(specificPages?: Page[]) {
    if (!notebook || (specificPages ? specificPages.length === 0 : pages.length === 0)) return
    setIsExporting(true)
    try {
      await exportNotebookToPDF(notebook, specificPages || pages)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  function togglePageSelection(pageId: string) {
    setSelectedPageIds(prev =>
      prev.includes(pageId)
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId]
    )
  }
  /*   function selectAllPages() {
      setSelectedPageIds(pages.map(p => p.id))
    }
  
    function deselectAllPages() {
      setSelectedPageIds([])
    } */

  async function handleExportPDF(e: React.MouseEvent, pdfId: string) {
    e.stopPropagation()
    setActiveTabMenuId(null)
    const file = await getPDFFile(pdfId)
    if (!file) return

    setIsExporting(true)
    try {
      const count = await getPDFPageCount(file.blob)
      const annotations: Record<number, PDFAnnotation> = {}

      for (let i = 1; i <= count; i++) {
        const ann = await getPDFAnnotation(`${pdfId}_${i}`)
        if (ann) annotations[i] = ann
      }

      await exportAnnotatedPDF(file, annotations)
    } catch (error) {
      console.error('Failed to export PDF:', error)
      alert('Failed to export PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  if (loading || !notebook) return <Loader />

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        width: '100vw',
        background: '#0000006f',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Header Container */}
      {activeTabId === 'notes' && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            right: 6,
            zIndex: 200, // Higher than toolkit (20)
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          {/* Left: Back and Export */}
          <div
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '24px',
              padding: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            }}
          >
            <button
              type="button"
              onClick={async () => {
                if (notebook && notebook.folderId) {
                  const folder = await getFolder(notebook.folderId)
                  if (folder) {
                    navigate(`/workspace/${folder.workspaceId}/folder/${folder.id}`)
                    return
                  }
                }
                navigate('/')
              }}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '20px',
                border: 'none',
                background: '#f1f5f9',
                color: '#475569',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
            >
              Back
            </button>
            {/*  <button
              type="button"
              onClick={() => handleExport()}
              disabled={isExporting}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '20px',
                border: 'none',
                background: '#020617',
                color: '#fff',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                opacity: isExporting ? 0.7 : 1,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = isExporting ? '0.7' : '1'}
            >
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button> */}
          </div>

          {/* Right: Note Name (Burger Menu) */}
          <button
            type="button"
            onClick={() => setIsOverlayOpen(true)}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '24px',
              padding: '8px 20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              transition: 'transform 0.1s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.08)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <h1 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
              {notebook.title}
            </h1>
          </button>
        </div>
      )}

      {/* Side Overlay */}
      {isOverlayOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOverlayOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              transition: 'opacity 0.3s'
            }}
          />
          {/* Content */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              height: '100%',
              width: '30%',
              minWidth: '300px',
              background: '#fff',
              boxShadow: '-4px 0 15px rgba(0, 0, 0, 0.1)',
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideIn 0.2s ease-out'
            }}
          >
            <style>{`
              @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
            `}</style>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Notebook Settings</h2>
              <button
                onClick={() => setIsOverlayOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              {/* <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', gap: '8px' }}>
                <button
                  onClick={selectAllPages}
                  style={{
                    flex: 1,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '10px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllPages}
                  style={{
                    flex: 1,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '10px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
                >
                  Deselect All
                </button>
              </div> */}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pages.map((p, i) => (
                  <div
                    key={p.id}
                    onClick={() => togglePageSelection(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '8px',
                      borderRadius: '16px',
                      background: selectedPageIds.includes(p.id) ? '#f8fafc' : 'transparent',
                      border: `1px solid ${selectedPageIds.includes(p.id) ? '#cbd5e1' : 'transparent'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedPageIds.includes(p.id)) {
                        e.currentTarget.style.background = '#f1f5f9'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedPageIds.includes(p.id)) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <PagePreview page={p} width={70} height={91} />
                      <div style={{
                        position: 'absolute',
                        top: '-6px',
                        left: '-6px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '11px',
                        border: '2px solid #fff',
                        background: selectedPageIds.includes(p.id) ? '#020617' : '#fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        color: '#fff',
                        zIndex: 2,
                        transition: 'all 0.2s'
                      }}>
                        {selectedPageIds.includes(p.id) && '✓'}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                        Page {i + 1}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>
                        {p.template} template
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '24px', borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => {
                  if (selectedPageIds.length > 0) {
                    const selectedPages = pages.filter(p => selectedPageIds.includes(p.id))
                    handleExport(selectedPages)
                  } else {
                    handleExport()
                  }
                }}
                disabled={isExporting}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#020617',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  opacity: isExporting ? 0.7 : 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isExporting ? 'Exporting...' : (
                  selectedPageIds.length > 0
                    ? `Export Selected (${selectedPageIds.length})`
                    : 'Export All Pages'
                )}
              </button>
            </div>
          </div>
        </>
      )}

      <Toolkit
        activeTool={activeTool}
        activeColor={activeColor}
        activeSize={activeSize}
        onToolChange={setActiveTool}
        onColorChange={setActiveColor}
        onSizeChange={onSizeChange}
        onUndo={activeTabId !== 'notes' && pdfActions ? pdfActions.undo : handleUndo}
        onRedo={activeTabId !== 'notes' && pdfActions ? pdfActions.redo : handleRedo}
        canUndo={activeTabId !== 'notes' && pdfActions ? pdfActions.canUndo : undoStack.length > 0}
        canRedo={activeTabId !== 'notes' && pdfActions ? pdfActions.canRedo : redoStack.length > 0}
        selectedShapeType={selectedShapeType}
        onShapeTypeChange={setSelectedShapeType}
        isShapeFilled={isShapeFilled}
        onFillChange={setIsShapeFilled}
        lassoPicksShapes={lassoPicksShapes}
        onLassoPicksShapesChange={setLassoPicksShapes}
        onCopy={() => setCopyTrigger(prev => prev + 1)}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {activeTabId === 'notes' ? (
           <div
            ref={mergedCanvasRef}
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
              touchAction: 'none',
            }}
          >
            <div
              style={{
                transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
                transformOrigin: 'top left',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                padding: '60px 40px 0 40px',
              }}
            >
              {/* PDF Elements Section */}
              {/*   {notebook.pdfIds && notebook.pdfIds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24, justifyContent: 'center' }}>
                  {notebook.pdfIds.map(pdfId => (
                    <div
                      key={pdfId}
                      onClick={() => {
                        setOpenTabs(prev => {
                          if (prev.find(t => t.id === pdfId)) return prev
                          return [...prev, { id: pdfId, type: 'pdf', title: pdfMetadata[pdfId]?.name || 'PDF' }]
                        })
                        setActiveTabId(pdfId)
                      }}
                      style={{
                        width: '180px',
                        height: '240px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                      }}
                    >
                      <div style={{ flex: 1, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '48px' }}>📄</span>
                      </div>
                      <div style={{ padding: '12px', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#1e293b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}>
                          {pdfMetadata[pdfId]?.name || 'Loading...'}
                        </div>
                        <button
                          onClick={(e) => handleDeletePDF(e, pdfId)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: '#fee2e2',
                            color: '#ef4444',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '12px',
                            flexShrink: 0,
                            transition: 'background 0.2s, color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#ef4444'
                            e.currentTarget.style.color = '#fff'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fee2e2'
                            e.currentTarget.style.color = '#ef4444'
                          }}
                          title="Delete PDF"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )} */}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {pages.length === 0 ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffededff',
                      fontSize: 15,
                      minHeight: '600px'
                    }}
                  >
                    Tap + to add your first page
                  </div>
                ) : (
                  pages.map((p, i) => (
                    <div
                      key={p.id}
                      id={`page-wrapper-${p.id}`}
                      style={{
                        position: 'relative',
                        scrollSnapAlign: 'start',
                        scrollSnapStop: 'always',
                        minHeight: PAGE_HEIGHT,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        paddingTop: 8
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '12px',
                          left: `calc(50% - ${(PAGE_WIDTH) / 2}px - 40px)`,
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#ccc',
                          userSelect: 'none',
                          textAlign: 'right',
                          width: '30px',
                        }}
                      >
                        {i + 1}
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          top: '12px',
                          left: `calc(50% + ${(PAGE_WIDTH) / 2}px + 10px)`,
                          zIndex: 10,
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuPageId(activeMenuPageId === p.id ? null : p.id)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            fontSize: '25px',
                            lineHeight: 1,
                            color: '#5e5c5cff',
                            transition: 'color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#666'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#ccc'}
                        >
                          ⋮
                        </button>
                        {activeMenuPageId === p.id && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              background: 'white',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                              padding: '4px 0',
                              minWidth: '120px',
                              zIndex: 20,
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleClearPage(p.id)
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: '#475569',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              Clear Page
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeletePage(p.id)
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: '#d32f2f',
                                borderTop: '1px solid #f1f5f9',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              Delete Page
                            </button>
                          </div>
                        )}
                      </div>
                      <EditablePage
                        page={p}
                        scale={1}
                        activeTool={activeTool}
                        activeColor={activeColor}
                        activeSize={activeSize}
                        selectedShapeType={selectedShapeType}
                        onUpdate={handlePageUpdate}
                        onOperation={handleOperation}
                        onToolChange={setActiveTool}
                        isShapeFilled={isShapeFilled}
                        lassoPicksShapes={lassoPicksShapes}
                        onInputTypeChange={() => { }}
                        screenToCanvasFn={screenToCanvas}
                        copyTrigger={copyTrigger}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Back to Content button */}
            <BackToContentButton
              visible={isContentOffscreen}
              onClick={fitToContent}
            />
          </div>
        ) : (
          <PdfFocusedView
            key={activeTabId}
            pdfFileId={activeTabId}
            onClose={() => setActiveTabId('notes')}
            activeTool={activeTool}
            activeColor={activeColor}
            activeSize={activeSize}
            selectedShapeType={selectedShapeType}
            isShapeFilled={isShapeFilled}
            onToolChange={setActiveTool}
            onActionsUpdate={setPdfActions}
          />
        )}
      </div>

      {/* Global Bottom Tab Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 3,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          borderRadius: '24px',
          padding: '4px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          zIndex: 100,
          maxWidth: '90vw',
          // overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '18px',
            background: '#0f172a',
            color: '#fff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '20px',
            lineHeight: 1,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            flexShrink: 0,
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title="Add Page or PDF"
        >
          +
        </button>
        <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 8px' }} />
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px',
              background: activeTabId === tab.id ? '#fff' : 'transparent',
              borderRadius: '18px',
              boxShadow: activeTabId === tab.id ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              border: activeTabId === tab.id ? '1px solid #e2e8f0' : '1px solid transparent',
            }}
          >
            <button
              onClick={() => setActiveTabId(tab.id)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '16px',
                border: 'none',
                background: 'none',
                color: activeTabId === tab.id ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.2s',
              }}
            >
              {tab.type === 'notes' ? '📝 ' : '📄 '}
              {tab.title}
            </button>
            {tab.type === 'pdf' && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTabMenuId(activeTabMenuId === tab.id ? null : tab.id)
                  }}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '12px',
                    border: 'none',
                    background: activeTabMenuId === tab.id ? '#cbd5e1' : (activeTabId === tab.id ? '#f1f5f9' : 'transparent'),
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '12px',
                    lineHeight: 1,
                    transition: 'all 0.2s',
                    marginRight: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e2e8f0'
                    e.currentTarget.style.color = '#0f172a'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = activeTabMenuId === tab.id ? '#cbd5e1' : (activeTabId === tab.id ? '#f1f5f9' : 'transparent')
                    e.currentTarget.style.color = '#64748b'
                  }}
                >
                  ⋮
                </button>
                {activeTabMenuId === tab.id && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: '8px',
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      padding: '4px',
                      minWidth: '100px',
                      zIndex: 150,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <button
                      onClick={(e) => handleExportPDF(e, tab.id)}
                      style={{
                        padding: '8px 12px',
                        fontSize: '13px',
                        border: 'none',
                        background: 'transparent',
                        color: '#1e293b',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '14px' }}>📤</span> Export
                    </button>
                    <button
                      onClick={(e) => {
                        setActiveTabMenuId(null)
                        handleDeletePDF(e, tab.id)
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '13px',
                        border: 'none',
                        background: 'transparent',
                        color: '#ef4444',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fee2e2'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>🗑️</span> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>


      {showAddModal && (
        <AddPageModal
          onClose={() => setShowAddModal(false)}
          onSelect={handleAddPage}
          onImportPDF={handleImportPDF}
        />
      )}
    </div>
  )
}
