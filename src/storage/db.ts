import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Notebook, Page } from '../types'

const DB_NAME = 'goodnotes-analog'
const DB_VERSION = 1

interface GoodnotesDB extends DBSchema {
  notebooks: { key: string; value: Notebook }
  pages: { key: string; value: Page }
}

let dbPromise: Promise<IDBPDatabase<GoodnotesDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<GoodnotesDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore('notebooks', { keyPath: 'id' })
        database.createObjectStore('pages', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

// --- Notebooks ---

export async function getNotebooks(): Promise<Notebook[]> {
  const db = await getDB()
  return db.getAll('notebooks')
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
