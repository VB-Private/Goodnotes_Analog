import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getNotebook, getPages, updateNotebook, createPage } from '../storage/db'
import type { Notebook, Page, PageTemplate } from '../types'
import AddPageModal from '../components/AddPageModal'

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

  useEffect(() => {
    if (!notebookId) return
    Promise.all([getNotebook(notebookId), getPages(notebookId)]).then(([nb, p]) => {
      setNotebook(nb ?? null)
      setPages(p.sort((a, b) => a.createdAt - b.createdAt))
      setLoading(false)
    })
  }, [notebookId])

  async function handleAddPage(template: PageTemplate) {
    if (!notebookId || !notebook) return
    const pageId = generateId()
    const page: Page = {
      id: pageId,
      notebookId,
      template,
      strokes: [],
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
    navigate(`/notebook/${notebookId}/page/${pageId}`)
  }

  if (loading || !notebook) return <div>Loading…</div>

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={() => navigate('/')}>
          Back
        </button>
        <h1 style={{ margin: 0 }}>{notebook.title}</h1>
      </div>
      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        style={{ marginBottom: 24, padding: '8px 16px' }}
      >
        Add page
      </button>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {pages.map((p, i) => (
          <li key={p.id} style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => navigate(`/notebook/${notebookId}/page/${p.id}`)}
              style={{
                display: 'block',
                width: '100%',
                padding: 12,
                textAlign: 'left',
                cursor: 'pointer',
                border: '1px solid #ccc',
                borderRadius: 8,
                background: '#fff',
              }}
            >
              Page {i + 1} ({p.template})
            </button>
          </li>
        ))}
      </ul>
      {showAddModal && (
        <AddPageModal onClose={() => setShowAddModal(false)} onSelect={handleAddPage} />
      )}
    </div>
  )
}
