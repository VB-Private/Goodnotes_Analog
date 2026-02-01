import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNotebooks, createNotebook, updateNotebook, deleteNotebook, getPages, deletePage } from '../storage/db'
import type { Notebook } from '../types'

function generateId(): string {
  return crypto.randomUUID()
}

export default function NotebooksList() {
  const navigate = useNavigate()
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  useEffect(() => {
    function handleClickOutside() {
      setActiveMenuId(null)
    }
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    getNotebooks().then((list) => {
      setNotebooks(list.sort((a, b) => a.createdAt - b.createdAt))
      setLoading(false)
    })
  }, [])

  async function handleCreateNotebook() {
    const title = window.prompt('Notebook title')
    if (!title?.trim()) return
    const id = generateId()
    const notebook: Notebook = {
      id,
      title: title.trim(),
      createdAt: Date.now(),
      pageIds: [],
    }
    await createNotebook(notebook)
    setNotebooks((prev) => [...prev, notebook].sort((a, b) => a.createdAt - b.createdAt))
    await createNotebook(notebook)
    setNotebooks((prev) => [...prev, notebook].sort((a, b) => a.createdAt - b.createdAt))
    navigate(`/notebook/${id}`)
  }

  async function handleRename(notebook: Notebook) {
    const newTitle = window.prompt('Rename notebook', notebook.title)
    if (!newTitle || newTitle.trim() === notebook.title) return

    const updated = { ...notebook, title: newTitle.trim() }
    await updateNotebook(updated)
    setNotebooks((prev) => prev.map((nb) => (nb.id === notebook.id ? updated : nb)))
    setActiveMenuId(null)
  }

  async function handleDelete(notebookId: string) {
    if (!confirm('Are you sure you want to delete this notebook and all its pages?')) return

    // Optimistic update
    setNotebooks((prev) => prev.filter((nb) => nb.id !== notebookId))

    // Delete all pages associated with this notebook
    const pages = await getPages(notebookId)
    await Promise.all(pages.map(p => deletePage(p.id)))

    // Delete the notebook itself
    await deleteNotebook(notebookId)
    setActiveMenuId(null)
  }

  if (loading) return <div>Loading…</div>

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>Notebooks</h1>
      <button
        type="button"
        onClick={handleCreateNotebook}
        style={{ marginBottom: 24, padding: '8px 16px' }}
      >
        Create notebook
      </button>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {notebooks.map((nb) => (
          <li key={nb.id} style={{ marginBottom: 8, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate(`/notebook/${nb.id}`)}
                style={{
                  flex: 1,
                  display: 'block',
                  padding: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: '1px solid #ccc',
                  borderRadius: 8,
                  background: '#fff',
                }}
              >
                {nb.title}
              </button>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveMenuId(activeMenuId === nb.id ? null : nb.id)
                  }}
                  style={{
                    padding: '8px',
                    background: 'none',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: 1,
                    color: '#666',
                  }}
                >
                  ⋮
                </button>
                {activeMenuId === nb.id && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
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
                        handleRename(nb)
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
                        color: '#333',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      Rename
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(nb.id)
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
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
