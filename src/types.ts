export type PageTemplate = 'blank' | 'squared' | 'lined'
export type ToolType = 'pen' | 'eraser'

export interface StrokePoint {
  x: number
  y: number
  pressure: number
}

export interface Stroke {
  id: string
  points: StrokePoint[]
  color: string
  tool: ToolType
  size: number
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
