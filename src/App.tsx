import { Routes, Route } from 'react-router-dom'
import NotebooksList from './views/NotebooksList.tsx'
import NotebookView from './views/NotebookView.tsx'
import WorkspacesView from './views/WorkspacesView.tsx'
import FoldersView from './views/FoldersView.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WorkspacesView />} />
      <Route path="/workspace/:workspaceId" element={<FoldersView />} />
      <Route path="/workspace/:workspaceId/folder/:folderId" element={<NotebooksList />} />
      <Route path="/notebook/:notebookId" element={<NotebookView />} />
    </Routes>
  )
}
