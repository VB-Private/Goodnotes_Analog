export type PageTemplate = 'blank' | 'squared' | 'lined'

export interface StrokePoint {
  x: number
  y: number
  pressure: number
}

export interface Stroke {
  points: StrokePoint[]
}

export interface Notebook {
  id: string
  title: string
  createdAt: number
  pageIds: string[]
}

export interface Page {
  id: string
  notebookId: string
  template: PageTemplate
  strokes: Stroke[]
  createdAt: number
}
