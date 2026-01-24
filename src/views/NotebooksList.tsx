import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNotebooks, createNotebook } from '../storage/db'
import type { Notebook } from '../types'

function generateId(): string {
  return crypto.randomUUID()
}

export default function NotebooksList() {
  const navigate = useNavigate()
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading, setLoading] = useState(true)

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
    navigate(`/notebook/${id}`)
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
          <li key={nb.id} style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => navigate(`/notebook/${nb.id}`)}
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
              {nb.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
