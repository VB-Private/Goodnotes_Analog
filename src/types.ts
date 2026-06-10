export type PageTemplate = "blank" | "squared" | "lined" | "pdf";
export type ToolType =
  | "pen"
  | "crayon"
  | "eraser"
  | "text"
  | "laser"
  | "lasso"
  | "figures"
  | "select";
export type ShapeType = "circle" | "square" | "triangle";

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;
  tool: ToolType;
  size: number;
}

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fillColor?: string;
  strokeWidth: number;
  rotation?: number;
}

export interface TextField {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
}

export interface Folder {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: number;
}

export interface Notebook {
  id: string;
  folderId: string;
  title: string;
  createdAt: number;
  pageIds: string[];
  pdfIds: string[];
  lastPageId?: string;
}

export interface Page {
  id: string;
  notebookId: string;
  template: PageTemplate;
  strokes: Stroke[];
  textFields: TextField[];
  shapes: Shape[];
  createdAt: number;
  pdfFileId?: string;
  pdfPageNumber?: number;
}

export interface PDFFile {
  id: string;
  blob: Blob;
  name: string;
  createdAt: number;
}
export interface PDFAnnotation {
  id: string; // Format: `${pdfFileId}_${pageNumber}`
  pdfFileId: string;
  pageNumber: number;
  strokes: Stroke[];
  textFields: TextField[];
  shapes: Shape[];
}

export type Operation =
  | { type: "add"; pageId: string; stroke: Stroke }
  | { type: "delete"; pageId: string; stroke: Stroke }
  | {
      type: "bulk-update";
      pageId: string;
      oldStrokes: Stroke[];
      newStrokes: Stroke[];
      oldTextFields?: TextField[];
      newTextFields?: TextField[];
      oldShapes?: Shape[];
      newShapes?: Shape[];
    };

export interface Tab {
  id: string;
  type: "notes" | "pdf";
  title: string;
}
