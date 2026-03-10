import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWorkspaces, createWorkspace, deleteWorkspace, getNotebooks, updateNotebook, getFolders, createFolder } from '../storage/db'
import type { Workspace } from '../types'
import Loader from '../components/Loader'

function generateId(): string {
    return crypto.randomUUID()
}

export default function WorkspacesView() {
    const navigate = useNavigate()
    const [workspaces, setWorkspaces] = useState<Workspace[]>([])
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
        getWorkspaces().then((list) => {
            setWorkspaces(list.sort((a, b) => a.createdAt - b.createdAt))
            setLoading(false)
        })
    }, [])

    // Migration for legacy notebooks
    useEffect(() => {
        async function checkMigration() {
            const allNotebooks = await getNotebooks()
            const uncategorized = allNotebooks.filter(n => !n.folderId)

            if (uncategorized.length > 0) {
                // Find or create default workspace
                let currentWorkspaces = await getWorkspaces()
                let defaultWorkspace = currentWorkspaces.find(w => w.name === 'Default Workspace')

                if (!defaultWorkspace) {
                    defaultWorkspace = { id: generateId(), name: 'Default Workspace', createdAt: Date.now() }
                    await createWorkspace(defaultWorkspace)
                }

                // Find or create default folder
                let folders = await getFolders(defaultWorkspace.id)
                let defaultFolder = folders.find(f => f.name === 'Default Folder')

                if (!defaultFolder) {
                    defaultFolder = { id: generateId(), workspaceId: defaultWorkspace.id, name: 'Default Folder', createdAt: Date.now() }
                    await createFolder(defaultFolder)
                }

                // Update notebooks
                await Promise.all(uncategorized.map(nb => {
                    return updateNotebook({ ...nb, folderId: defaultFolder!.id })
                }))

                // Refresh workspaces list if we created a new one
                getWorkspaces().then((list) => {
                    setWorkspaces(list.sort((a, b) => a.createdAt - b.createdAt))
                })
            }
        }

        checkMigration()
    }, [])

    async function handleCreateWorkspace() {
        const title = window.prompt('Workspace Name (e.g. School, Personal)')
        if (!title?.trim()) return
        const id = generateId()
        const workspace: Workspace = {
            id,
            name: title.trim(),
            createdAt: Date.now(),
        }
        await createWorkspace(workspace)
        setWorkspaces((prev) => [...prev, workspace].sort((a, b) => a.createdAt - b.createdAt))
    }

    async function handleDelete(workspaceId: string) {
        if (!confirm('Are you sure? This will delete the workspace and references to it.')) return

        // Optimistic update
        setWorkspaces((prev) => prev.filter((ws) => ws.id !== workspaceId))
        await deleteWorkspace(workspaceId)
        setActiveMenuId(null)
    }

    if (loading) return <Loader />

    return (
        <div style={{
            height: '100dvh',
            overflowY: 'auto',
            padding: 'calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom)) 24px',
            maxWidth: 720,
            margin: '0 auto',
            background: '#ffffffff',
        }}>
            <h1 style={{ marginBottom: 16, color: '#000000ff' }}>Workspaces</h1>
            <button
                type="button"
                onClick={handleCreateWorkspace}
                style={{ marginBottom: 24, padding: '8px 16px' }}
            >
                Create Workspace
            </button>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {workspaces.map((ws) => (
                    <li key={ws.id} style={{ marginBottom: 8, position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => navigate(`/workspace/${ws.id}`)}
                                style={{
                                    flex: 1,
                                    display: 'block',
                                    padding: 12,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    border: '1px solid #0056b3',
                                    borderRadius: 8,
                                    background: '#007bff',
                                    color: '#fff',
                                }}
                            >
                                {ws.name}
                            </button>
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setActiveMenuId(activeMenuId === ws.id ? null : ws.id)
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
                                {activeMenuId === ws.id && (
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
                                                handleDelete(ws.id)
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
            <h2 style={{ marginTop: 24, color: '#000000ff' }}>Shared Workspaces</h2>
            <p style={{ color: '#000000ff' }}>Will be added soon</p>
        </div>
    )
}
