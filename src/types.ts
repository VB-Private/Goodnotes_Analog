export type PageTemplate = 'blank' | 'squared' | 'lined'
export type ToolType = 'pen' | 'pencil' | 'crayon' | 'eraser' | 'text' | 'laser' | 'lasso' | 'figures'

export type FigureType = 'circle'

export interface Figure {
  id: string
  type: FigureType
  x: number
  y: number
  width: number
  height: number
  color: string
  strokeWidth: number
}

export interface StrokePoint {
  // ... existing types ...
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

export interface TextField {
  id: string
  x: number
  y: number
  text: string
  color: string
  fontSize: number
}

export interface Notebook {
  id: string
  title: string
  createdAt: number
  pageIds: string[]
  lastPageId?: string
}

export interface Page {
  id: string
  notebookId: string
  template: PageTemplate
  strokes: Stroke[]
  textFields: TextField[]
  figures?: Figure[]
  createdAt: number
}
