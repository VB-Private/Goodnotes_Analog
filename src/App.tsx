import { Routes, Route } from 'react-router-dom'
import NotebooksList from './views/NotebooksList.tsx'
import NotebookView from './views/NotebookView.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<NotebooksList />} />
      <Route path="/notebook/:notebookId" element={<NotebookView />} />
    </Routes>
  )
}
