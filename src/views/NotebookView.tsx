import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getNotebook, getPages, updateNotebook, createPage, updatePage, deletePage, savePDFFile, getPDFFile, deletePDFFile, deletePDFAnnotationsForFile } from '../storage/db'
import type { Notebook, Page, PageTemplate, ToolType, PDFFile, Operation } from '../types'
import PdfFocusedView from '../components/PdfFocusedView'
import AddPageModal from '../components/AddPageModal'
import EditablePage from '../components/EditablePage'
import Toolkit from '../components/Toolkit'
import Loader from '../components/Loader'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import { exportNotebookToPDF } from '../utils/export'

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
  const [scale, setScale] = useState(1)
  const [focusedPDFId, setFocusedPDFId] = useState<string | null>(null)
  const [pdfMetadata, setPdfMetadata] = useState<Record<string, { name: string }>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    localStorage.setItem(TOOLKIT_STORAGE_KEY, JSON.stringify({
      activeTool,
      activeColor,
      penSize,
      eraserSize
    }))
  }, [activeTool, activeColor, penSize, eraserSize])

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
  const [isExporting, setIsExporting] = useState(false)
  const [pdfActions, setPdfActions] = useState<{ undo: () => void, redo: () => void, canUndo: boolean, canRedo: boolean } | null>(null)
  const hasAttemptedInitialScroll = useRef(false)

  useEffect(() => {
    function handleClickOutside() {
      setActiveMenuPageId(null)
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
        await Promise.all(notebook.pdfIds.map(async (id) => {
          const file = await getPDFFile(id)
          if (file) metadata[id] = { name: file.name }
        }))
        setPdfMetadata(metadata)
      }

      setLoading(false)
    })
  }, [notebookId])

  useEffect(() => {
    function updateScale() {
      const s = Math.min(
        1,
        (window.innerWidth - 80) / PAGE_WIDTH, // Adjusted for toolkit space
        (window.innerHeight - 32) / PAGE_HEIGHT // Further reduced subtraction for full height
      )
      setScale(Math.max(0.1, s))
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          if (focusedPDFId && pdfActions) {
            pdfActions.redo()
          } else {
            handleRedo()
          }
        } else {
          if (focusedPDFId && pdfActions) {
            pdfActions.undo()
          } else {
            handleUndo()
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (focusedPDFId && pdfActions) {
          pdfActions.redo()
        } else {
          handleRedo()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undoStack, redoStack, focusedPDFId, pdfActions])

  useEffect(() => {
    if (loading || pages.length === 0 || !notebook || hasAttemptedInitialScroll.current) return

    const targetPageId = notebook.lastPageId || pages[pages.length - 1].id

    // We wait a bit longer to ensure everything (Paper background, EditablePage, etc.) has rendered at the correct scale
    const scrollTimeout = setTimeout(() => {
      const pageElement = document.getElementById(`page-wrapper-${targetPageId}`)
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'auto', block: 'start' })
        hasAttemptedInitialScroll.current = true
      } else {
        // Fallback to last page if target is missing
        const lastPageEl = document.getElementById(`page-wrapper-${pages[pages.length - 1].id}`)
        lastPageEl?.scrollIntoView({ behavior: 'auto', block: 'start' })
        hasAttemptedInitialScroll.current = true
      }
    }, 300)

    return () => clearTimeout(scrollTimeout)
  }, [loading, notebook, pages, scale])

  function handlePageUpdate(updated: Page) {
    // Save last edited page
    if (notebook) {
      const updatedNb = { ...notebook, lastPageId: updated.id }
      updateNotebook(updatedNb)
      setNotebook(updatedNb)
    }

    updatePage(updated)
    setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
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
          textFields: op.newTextFields || pageToUpdate.textFields
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
          textFields: op.oldTextFields || pageToUndo.textFields
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
          textFields: op.newTextFields || pageToRedo.textFields
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

    setTimeout(() => {
      const el = scrollContainerRef.current
      if (el) el.scrollTop = el.scrollHeight
    }, 0)
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
      setPdfMetadata(prev => ({ ...prev, [pdfId]: { name: file.name } }))
      setShowAddModal(false)
      setFocusedPDFId(pdfId) // Open it immediately
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

      setPdfMetadata(prev => {
        const next = { ...prev }
        delete next[pdfId]
        return next
      })
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
        newTextFields: []
      })
    }
    setActiveMenuPageId(null)
  }

  async function handleExport() {
    if (!notebook || pages.length === 0) return
    setIsExporting(true)
    try {
      await exportNotebookToPDF(notebook, pages)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  if (loading || !notebook) return <Loader />

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      width: '100vw',
      background: '#0000006f', // Dark background for the entire view
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header Container */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
            padding: '4px 16px 4px 4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '20px',
              border: 'none',
              background: '#f1f5f9',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Back
          </button>
          <h1 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
            {notebook.title}
          </h1>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '20px',
              border: 'none',
              background: '#020617',
              color: '#fff',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.7 : 1,
              marginLeft: '4px'
            }}
          >
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <Toolkit
        activeTool={activeTool}
        activeColor={activeColor}
        activeSize={activeSize}
        onToolChange={setActiveTool}
        onColorChange={setActiveColor}
        onSizeChange={onSizeChange}
        onUndo={focusedPDFId && pdfActions ? pdfActions.undo : handleUndo}
        onRedo={focusedPDFId && pdfActions ? pdfActions.redo : handleRedo}
        canUndo={focusedPDFId && pdfActions ? pdfActions.canUndo : undoStack.length > 0}
        canRedo={focusedPDFId && pdfActions ? pdfActions.canRedo : redoStack.length > 0}
      />

      {/* Main Scroll Container */}
      <div
        ref={scrollContainerRef}
        style={{
          // flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          // scrollSnapType: 'y mandatory',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          // paddingRight: 60, // Space for toolkit
          // paddingTop: 80, // Space for header
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: '100%',
            padding: '80px 40px 0 40px', // Added padding for header and side spacing
          }}
        >
          {/* PDF Elements Section */}
          {notebook.pdfIds && notebook.pdfIds.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24, justifyContent: 'center' }}>
              {notebook.pdfIds.map(pdfId => (
                <div
                  key={pdfId}
                  onClick={() => setFocusedPDFId(pdfId)}
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
          )}

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
                  color: '#888',
                  fontSize: 15,
                  minHeight: '400px'
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
                    minHeight: PAGE_HEIGHT * scale,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    paddingTop: 8,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: `calc(50% - ${(PAGE_WIDTH * scale) / 2}px - 40px)`,
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
                      left: `calc(50% + ${(PAGE_WIDTH * scale) / 2}px + 10px)`,
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
                    scale={scale}
                    activeTool={activeTool}
                    activeColor={activeColor}
                    activeSize={activeSize}
                    onUpdate={handlePageUpdate}
                    onOperation={handleOperation}
                    onInputTypeChange={() => { }} // Dummy as it was removed
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        style={{
          position: 'fixed',
          bottom: 'calc(24px + env(safe-area-inset-bottom))',
          left: 24,
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: '1px solid #ddd',
          background: '#fff',
          fontSize: 20,
          lineHeight: 1,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Add page"
      >
        +
      </button>

      {showAddModal && (
        <AddPageModal
          onClose={() => setShowAddModal(false)}
          onSelect={handleAddPage}
          onImportPDF={handleImportPDF}
        />
      )}

      {focusedPDFId && (
        <PdfFocusedView
          pdfFileId={focusedPDFId}
          onClose={() => setFocusedPDFId(null)}
          activeTool={activeTool}
          activeColor={activeColor}
          activeSize={activeSize}
          onActionsUpdate={setPdfActions}
        />
      )}
    </div>
  )
}
