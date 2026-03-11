import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getNotebooks, createNotebook, updateNotebook, deleteNotebook, getPages, deletePage } from '../storage/db'
import type { Notebook } from '../types'
import Loader from '../components/Loader'
import PromptModal from '../components/PromptModal'

function generateId(): string {
  return crypto.randomUUID()
}

export default function NotebooksList() {
  const navigate = useNavigate()
  const { workspaceId, folderId } = useParams<{ workspaceId: string; folderId: string }>()
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [renamingNotebook, setRenamingNotebook] = useState<Notebook | null>(null)

  useEffect(() => {
    function handleClickOutside() {
      setActiveMenuId(null)
    }
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!folderId) return
    getNotebooks(folderId).then((list) => {
      setNotebooks(list.sort((a, b) => a.createdAt - b.createdAt))
      setLoading(false)
    })
  }, [folderId])

  async function handleCreateNotebook(title: string) {
    if (!folderId) return
    const id = generateId()
    const notebook: Notebook = {
      id,
      folderId,
      title,
      createdAt: Date.now(),
      pageIds: [],
      pdfIds: [],
    }
    await createNotebook(notebook)
    setNotebooks((prev) => [...prev, notebook].sort((a, b) => a.createdAt - b.createdAt))
    setShowCreateModal(false)
    navigate(`/notebook/${id}`)
  }

  async function handleRename(notebook: Notebook, newTitle: string) {
    const updated = { ...notebook, title: newTitle }
    await updateNotebook(updated)
    setNotebooks((prev) => prev.map((nb) => (nb.id === notebook.id ? updated : nb)))
    setActiveMenuId(null)
    setRenamingNotebook(null)
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

  if (loading) return <Loader />

  return (
    <div style={{
      height: '100dvh',
      overflowY: 'auto',
      padding: '24px 24px calc(24px + env(safe-area-inset-bottom)) 24px',
      maxWidth: 720,
      margin: '0 auto',
      background: '#ffffffff',
    }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => navigate(`/workspace/${workspaceId}`)} style={{ cursor: 'pointer', padding: '4px 8px' }}>← Back</button>
        <h1 style={{ margin: 0, color: '#000000ff' }}>Notebooks</h1>
      </div>
      <button
        type="button"
        onClick={() => setShowCreateModal(true)}
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
                  border: '1px solid #ef1c1cff',
                  borderRadius: 8,
                  background: '#8c0b0bff',
                  color: '#fff',
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
                    background: '#ffffffff',
                    border: '1px solid #333',
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
                      background: '#ffffffff',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      padding: '4px 0',
                      minWidth: '120px',
                      zIndex: 20,
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setRenamingNotebook(nb)
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
                        color: '#eee',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#3d3d3d'}
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
                        color: '#ff4d4d',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#3d3d3d'}
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
      {showCreateModal && (
        <PromptModal
          title="Notebook Title"
          placeholder="e.g. Math Notes"
          onSubmit={handleCreateNotebook}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
      {renamingNotebook && (
        <PromptModal
          title="Rename Notebook"
          defaultValue={renamingNotebook.title}
          onSubmit={(newTitle) => handleRename(renamingNotebook, newTitle)}
          onCancel={() => setRenamingNotebook(null)}
        />
      )}
    </div>
  )
}
