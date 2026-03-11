import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getFolders, createFolder, deleteFolder } from '../storage/db'
import type { Folder } from '../types'
import Loader from '../components/Loader'
import PromptModal from '../components/PromptModal'

function generateId(): string {
    return crypto.randomUUID()
}

export default function FoldersView() {
    const navigate = useNavigate()
    const { workspaceId } = useParams<{ workspaceId: string }>()
    const [folders, setFolders] = useState<Folder[]>([])
    const [loading, setLoading] = useState(true)
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)

    useEffect(() => {
        function handleClickOutside() {
            setActiveMenuId(null)
        }
        window.addEventListener('click', handleClickOutside)
        return () => window.removeEventListener('click', handleClickOutside)
    }, [])

    useEffect(() => {
        if (!workspaceId) return
        getFolders(workspaceId).then((list) => {
            setFolders(list.sort((a, b) => a.createdAt - b.createdAt))
            setLoading(false)
        })
    }, [workspaceId])

    async function handleCreateFolder(title: string) {
        if (!workspaceId) return
        const id = generateId()
        const folder: Folder = {
            id,
            workspaceId,
            name: title,
            createdAt: Date.now(),
        }
        await createFolder(folder)
        setFolders((prev) => [...prev, folder].sort((a, b) => a.createdAt - b.createdAt))
        setShowCreateModal(false)
    }

    async function handleDelete(folderId: string) {
        if (!confirm('Are you sure? This will delete the folder.')) return

        // Optimistic update
        setFolders((prev) => prev.filter((f) => f.id !== folderId))
        await deleteFolder(folderId)
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
                <button onClick={() => navigate('/')} style={{ cursor: 'pointer', padding: '4px 8px' }}>← Back</button>
                <h1 style={{ margin: 0, color: '#000000ff' }}>Folders</h1>
            </div>

            <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{ marginBottom: 24, padding: '8px 16px' }}
            >
                Create Folder
            </button>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {folders.map((folder) => (
                    <li key={folder.id} style={{ marginBottom: 8, position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => navigate(`/workspace/${workspaceId}/folder/${folder.id}`)}
                                style={{
                                    flex: 1,
                                    display: 'block',
                                    padding: 12,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    border: '1px solid #17a2b8',
                                    borderRadius: 8,
                                    background: '#138496',
                                    color: '#fff',
                                }}
                            >
                                {folder.name}
                            </button>
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setActiveMenuId(activeMenuId === folder.id ? null : folder.id)
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
                                {activeMenuId === folder.id && (
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
                                                handleDelete(folder.id)
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
                    title="Folder Name"
                    placeholder="e.g. Math, History"
                    onSubmit={handleCreateFolder}
                    onCancel={() => setShowCreateModal(false)}
                />
            )}
        </div>
    )
}
