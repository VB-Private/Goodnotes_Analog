import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getNotebook, getPages, updateNotebook, createPage, updatePage } from '../storage/db'
import type { Notebook, Page, PageTemplate, ToolType } from '../types'
import AddPageModal from '../components/AddPageModal'
import EditablePage from '../components/EditablePage'
import Toolkit from '../components/Toolkit'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'

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
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Toolkit state
  const [activeTool, setActiveTool] = useState<ToolType>('pen')
  const [activeColor, setActiveColor] = useState('#000000')
  const [activeSize, setActiveSize] = useState(20)
  const [inputType, setInputType] = useState<'pen' | 'touch' | null>(null)
  const [modifiedStack, setModifiedStack] = useState<string[]>([])

  useEffect(() => {
    if (!notebookId) return
    Promise.all([getNotebook(notebookId), getPages(notebookId)]).then(([nb, p]) => {
      setNotebook(nb ?? null)
      setPages(p.sort((a, b) => a.createdAt - b.createdAt))
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
    if (!loading) scrollContainerRef.current?.scrollTo(0, 0)
  }, [loading])

  function handlePageUpdate(updated: Page) {
    const original = pages.find(p => p.id === updated.id)
    if (original && original.strokes.length < updated.strokes.length) {
      setModifiedStack(prev => [...prev, updated.id])
    }
    updatePage(updated)
    setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  function handleUndo() {
    if (modifiedStack.length === 0) return

    const newStack = [...modifiedStack]
    const lastPageId = newStack.pop()
    setModifiedStack(newStack)

    const pageToUndo = pages.find(p => p.id === lastPageId)
    if (pageToUndo && pageToUndo.strokes.length > 0) {
      const updatedPage = {
        ...pageToUndo,
        strokes: pageToUndo.strokes.slice(0, -1)
      }
      handlePageUpdate(updatedPage)
      // Since handlePageUpdate will add it back to stack if strokes length increased, 
      // but here it decreased, so it's fine. 
      // Wait, handlePageUpdate checks if length increased. Correct.
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
    setTimeout(() => {
      const el = scrollContainerRef.current
      if (el) el.scrollTop = el.scrollHeight
    }, 0)
  }

  if (loading || !notebook) return <div>Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            pointerEvents: 'auto',
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <h1 style={{ margin: 0, fontSize: '14px', color: '#666', pointerEvents: 'auto' }}>
          {notebook.title}
        </h1>
        {inputType && (
          <div
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '20px',
              background: inputType === 'pen' ? '#E3F2FD' : '#F5F5F5',
              color: inputType === 'pen' ? '#1976D2' : '#616161',
              border: `1px solid ${inputType === 'pen' ? '#90CAF9' : '#E0E0E0'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.3s ease',
              pointerEvents: 'auto',
            }}
          >
            <span style={{ fontSize: '14px' }}>{inputType === 'pen' ? '✏️' : '☝️'}</span>
            {inputType.toUpperCase()}
          </div>
        )}
        <div id="debug-info" style={{ display: 'flex', gap: 12, fontSize: '10px', color: '#999', pointerEvents: 'none' }}>
          <span id="force"></span>
          <span id="touches"></span>
        </div>
      </div>

      <Toolkit
        activeTool={activeTool}
        activeColor={activeColor}
        activeSize={activeSize}
        onToolChange={setActiveTool}
        onColorChange={setActiveColor}
        onSizeChange={setActiveSize}
        onUndo={handleUndo}
        canUndo={modifiedStack.length > 0}
      />

      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'y mandatory',
          paddingBottom: 24, // Reduced from 56
          paddingRight: 60, // Space for toolkit
        }}
      >
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
                minHeight: 'calc(100vh - 120px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#888',
                fontSize: 15,
              }}
            >
              Tap + to add your first page
            </div>
          ) : (
            pages.map((p) => (
              <div
                key={p.id}
                style={{
                  scrollSnapAlign: 'start',
                  scrollSnapStop: 'always',
                  minHeight: PAGE_HEIGHT * scale,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  paddingTop: 8,
                }}
              >
                <EditablePage
                  page={p}
                  scale={scale}
                  activeTool={activeTool}
                  activeColor={activeColor}
                  activeSize={activeSize}
                  onUpdate={handlePageUpdate}
                  onInputTypeChange={setInputType}
                />
              </div>
            ))
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          width: 40,
          height: 40,
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
        <AddPageModal onClose={() => setShowAddModal(false)} onSelect={handleAddPage} />
      )}
    </div>
  )
}
