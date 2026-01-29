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
    updatePage(updated)
    setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', backgroundColor: '#f5f5f7' }}>
      {/* Unified Toolbar */}
      <Toolkit
        activeTool={activeTool}
        activeColor={activeColor}
        activeSize={activeSize}
        onToolChange={setActiveTool}
        onColorChange={setActiveColor}
        onSizeChange={setActiveSize}
        onBack={() => navigate('/')}
        onAddPage={() => setShowAddModal(true)}
      />

      {/* Floating Info Overlay (Status/Debug) */}
      <div
        style={{
          position: 'fixed',
          top: 70,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        {inputType && (
          <div
            style={{
              padding: '4px 10px',
              fontSize: '10px',
              fontWeight: 600,
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              color: '#333',
              border: '1px solid rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              pointerEvents: 'none',
            }}
          >
            <span>{inputType === 'pen' ? '✏️' : '☝️'}</span>
            {inputType.toUpperCase()}
          </div>
        )}
        <div id="debug-info" style={{ display: 'flex', gap: 12, fontSize: '10px', color: '#999' }}>
          <span id="force"></span>
          <span id="touches"></span>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          paddingTop: 80, // Space for the top toolkit
          paddingBottom: 40,
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
              Tap + in the toolbar to add your first page
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

      {showAddModal && (
        <AddPageModal onClose={() => setShowAddModal(false)} onSelect={handleAddPage} />
      )}
    </div>
  )
}
