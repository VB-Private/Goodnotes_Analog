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
        (window.innerHeight - 120) / PAGE_HEIGHT
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div
        style={{
          marginBottom: 16,
          padding: '16px 24px 0',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={() => navigate('/')}>
          Back
        </button>
        <h1 style={{ margin: 0 }}>{notebook.title}</h1>
      </div>

      <Toolkit
        activeTool={activeTool}
        activeColor={activeColor}
        activeSize={activeSize}
        onToolChange={setActiveTool}
        onColorChange={setActiveColor}
        onSizeChange={setActiveSize}
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
          paddingBottom: 56,
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
                />
              </div>
            ))
          )}
        </div>
      </div>
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#fff',
          borderTop: '1px solid #eee',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            border: '1px solid #ccc',
            background: '#fff',
            fontSize: 24,
            lineHeight: 1,
            cursor: 'pointer',
          }}
          aria-label="Add page"
        >
          +
        </button>
      </div>
      {showAddModal && (
        <AddPageModal onClose={() => setShowAddModal(false)} onSelect={handleAddPage} />
      )}
    </div>
  )
}
