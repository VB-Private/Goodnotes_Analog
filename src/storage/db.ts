import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Notebook, Page, PDFFile, PDFAnnotation, Workspace, Folder } from '../types'

const DB_NAME = 'goodnotes-analog'
const DB_VERSION = 5

interface GoodnotesDB extends DBSchema {
  workspaces: { key: string; value: Workspace }
  folders: { key: string; value: Folder }
  notebooks: { key: string; value: Notebook }
  pages: { key: string; value: Page }
  pdfFiles: { key: string; value: PDFFile }
  pdfAnnotations: { key: string; value: PDFAnnotation }
}

let dbPromise: Promise<IDBPDatabase<GoodnotesDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<GoodnotesDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          database.createObjectStore('notebooks', { keyPath: 'id' })
          database.createObjectStore('pages', { keyPath: 'id' })
        }
        if (oldVersion < 3) {
          if (!database.objectStoreNames.contains('pdfFiles')) {
            database.createObjectStore('pdfFiles', { keyPath: 'id' })
          }
        }
        if (oldVersion < 4) {
          if (!database.objectStoreNames.contains('pdfAnnotations')) {
            database.createObjectStore('pdfAnnotations', { keyPath: 'id' })
          }
        }
        if (oldVersion < 5) {
          if (!database.objectStoreNames.contains('workspaces')) {
            database.createObjectStore('workspaces', { keyPath: 'id' })
          }
          if (!database.objectStoreNames.contains('folders')) {
            database.createObjectStore('folders', { keyPath: 'id' })
          }
        }
      },
    })
  }
  return dbPromise
}

// --- Workspaces ---

export async function getWorkspaces(): Promise<Workspace[]> {
  const db = await getDB()
  return db.getAll('workspaces')
}

export async function createWorkspace(workspace: Workspace): Promise<void> {
  const db = await getDB()
  await db.add('workspaces', workspace)
}

export async function deleteWorkspace(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('workspaces', id)
}

// --- Folders ---

export async function getFolders(workspaceId: string): Promise<Folder[]> {
  const db = await getDB()
  const all = await db.getAll('folders')
  return all.filter((f) => f.workspaceId === workspaceId)
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  const db = await getDB()
  return db.get('folders', id)
}

export async function createFolder(folder: Folder): Promise<void> {
  const db = await getDB()
  await db.add('folders', folder)
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('folders', id)
}

// --- Notebooks ---

export async function getNotebooks(folderId?: string): Promise<Notebook[]> {
  const db = await getDB()
  const all = await db.getAll('notebooks')
  if (folderId) {
    return all.filter((n) => n.folderId === folderId)
  }
  return all
}

export async function getNotebook(id: string): Promise<Notebook | undefined> {
  const db = await getDB()
  return db.get('notebooks', id)
}

export async function createNotebook(notebook: Notebook): Promise<void> {
  const db = await getDB()
  await db.add('notebooks', notebook)
}

export async function updateNotebook(notebook: Notebook): Promise<void> {
  const db = await getDB()
  await db.put('notebooks', notebook)
}

export async function deleteNotebook(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('notebooks', id)
}

// --- Pages ---

export async function getPages(notebookId: string): Promise<Page[]> {
  const db = await getDB()
  const all = await db.getAll('pages')
  return all.filter((p) => p.notebookId === notebookId)
}

export async function getPage(id: string): Promise<Page | undefined> {
  const db = await getDB()
  return db.get('pages', id)
}

export async function createPage(page: Page): Promise<void> {
  const db = await getDB()
  await db.add('pages', page)
}


export async function updatePage(page: Page): Promise<void> {
  const db = await getDB()
  await db.put('pages', page)
}

export async function deletePage(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('pages', id)
}

// --- PDF Files ---

export async function getPDFFile(id: string): Promise<PDFFile | undefined> {
  const db = await getDB()
  return db.get('pdfFiles', id)
}

export async function savePDFFile(file: PDFFile): Promise<void> {
  const db = await getDB()
  await db.put('pdfFiles', file)
}

export async function deletePDFFile(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('pdfFiles', id)
}

// --- PDF Annotations ---

export async function getPDFAnnotation(id: string): Promise<PDFAnnotation | undefined> {
  const db = await getDB()
  return db.get('pdfAnnotations', id)
}

export async function savePDFAnnotation(annotation: PDFAnnotation): Promise<void> {
  const db = await getDB()
  await db.put('pdfAnnotations', annotation)
}

export async function getPDFAnnotationsForFile(pdfFileId: string): Promise<PDFAnnotation[]> {
  const db = await getDB()
  const all = await db.getAll('pdfAnnotations')
  return all.filter(a => a.pdfFileId === pdfFileId)
}

export async function deletePDFAnnotationsForFile(pdfFileId: string): Promise<void> {
  const db = await getDB()
  const annotations = await getPDFAnnotationsForFile(pdfFileId)
  const tx = db.transaction('pdfAnnotations', 'readwrite')
  await Promise.all([
    ...annotations.map(a => tx.store.delete(a.id)),
    tx.done
  ])
}
