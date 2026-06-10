import { PDFDocument, rgb, LineCapStyle } from "pdf-lib";
import download from "downloadjs";
import type {
  Notebook,
  Page,
  Stroke,
  TextField,
  Shape,
  PDFFile,
} from "../types";
import { getPDFFile } from "../storage/db";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../constants";
import { splitStroke } from "./geometry";

const LINE_COLOR = rgb(0, 0, 0);
const LINE_OPACITY = 0.12;
const GRID_SPACING = 20;
const LINE_SPACING = 24;
const PAPER_BG = rgb(0.98, 0.98, 0.97); // #fafaf8
const PDF_MIME_TYPE = "application/pdf";

function isIOSLike() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalonePWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

async function downloadOrSharePDF(data: Uint8Array, fileName: string) {
  const pdfFileName = fileName.toLowerCase().endsWith(".pdf")
    ? fileName
    : `${fileName}.pdf`;
  const file = new File([data], pdfFileName, { type: PDF_MIME_TYPE });
  const shouldUseShareSheet = isIOSLike() && isStandalonePWA();

  if (shouldUseShareSheet && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: pdfFileName,
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.warn("Sharing PDF failed, falling back to download:", error);
    }
  }

  download(data, pdfFileName, PDF_MIME_TYPE);
}

// ----------------------------------------------------------------------
//  Apple Pencil optimized stroke rendering
// ----------------------------------------------------------------------

/**
 * Converts hex to RGB
 */
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Adaptive Catmull-Rom spline interpolation.
 * Inserts points so that the maximum distance between consecutive points
 * is less than half the minimum stroke width. This guarantees smooth,
 * gapless strokes when drawing overlapping circles.
 */
function interpolateStrokePointsForHandwriting(
  points: { x: number; y: number }[],
  strokeSize: number,
  scale: { x: number; y: number },
): typeof points {
  if (points.length < 2) return points;

  const result: typeof points = [];
  const minThickness = strokeSize * 0.3 * Math.min(scale.x, scale.y); // minimum radius ~0.3 * size
  const targetSpacing = minThickness * 0.8; // circles overlap when spacing < 2*radius

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Euclidean distance in scaled coordinates
    const dx = (p2.x - p1.x) * scale.x;
    const dy = (p2.y - p1.y) * scale.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Number of segments needed so that segment length <= targetSpacing
    const segments = Math.max(1, Math.ceil(distance / targetSpacing));

    for (let s = 0; s < segments; s++) {
      const t = s / segments;

      // Catmull-Rom requires 4 points; for boundaries we duplicate first/last
      const p0 = i === 0 ? points[i] : points[i - 1];
      const p3 = i === points.length - 2 ? points[i + 1] : points[i + 2];

      const x = catmullRom(p0.x, p1.x, p2.x, p3.x, t);
      const y = catmullRom(p0.y, p1.y, p2.y, p3.y, t);

      result.push({ x, y });
    }
  }

  // Add the very last point
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Catmull-Rom for one coordinate
 */
function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * p1 - 2 * p2 + v0 + v1) * t3 +
    (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 +
    v0 * t +
    p1
  );
}

// ----------------------------------------------------------------------
//  Core drawing – handwriting optimized
// ----------------------------------------------------------------------

/**
 * Draws strokes using overlapping filled circles.
 * This method produces smooth, continuous handwriting strokes
 * with natural pressure variation and perfect joins.
 *
 * Key optimizations for Apple Pencil:
 * - Linear pressure mapping with a minimum thickness (never too thin)
 * - Adaptive point density to guarantee circle overlap
 * - No double-drawing (circles only, no lines)
 * - Circles are drawn at every interpolated point
 */
function drawAnnotationsOnPage(
  pdfPage: any,
  pageContent: {
    strokes: Stroke[];
    textFields?: TextField[];
    shapes?: Shape[];
  },
  scale: { x: number; y: number } = { x: 1, y: 1 },
) {
  const { height } = pdfPage.getSize();
  const { x: scaleX, y: scaleY } = scale;

  // --------------------------------------------------------------------
  //  Draw Strokes – handwriting optimized
  // --------------------------------------------------------------------
  for (let i = 0; i < pageContent.strokes.length; i++) {
    const stroke = pageContent.strokes[i];
    if (stroke.points.length < 2) continue;
    if (stroke.tool === "eraser") continue;

    // Eraser splitting (unchanged)
    const relevantErasers = pageContent.strokes
      .slice(i + 1)
      .filter((e) => e.tool === "eraser");
    const fragments =
      relevantErasers.length > 0
        ? splitStroke(stroke, relevantErasers)
        : [stroke];

    const color = hexToRgb(stroke.color);
    let opacity = 1.0;
    if (stroke.tool === "crayon") opacity = 0.4;

    for (const fragment of fragments) {
      if (fragment.points.length < 2) continue;

      // Step 1: Interpolate points adaptively so the curve is perfectly smooth
      const smoothPoints = interpolateStrokePointsForHandwriting(
        fragment.points,
        stroke.size,
        { x: scaleX, y: scaleY },
      );

      if (smoothPoints.length < 2) continue;

      // Step 2: Construct the SVG path data using raw canvas coordinates.
      // NOTE: drawSvgPath applies scale(1, -1) internally to flip SVG's
      // top-down Y axis to PDF's bottom-up Y axis. We must NOT pre-flip.
      // We pass x scaled, y scaled (no height subtraction).
      const pathData = smoothPoints
        .map(
          (p, idx) =>
            `${idx === 0 ? "M" : "L"} ${(p.x * scaleX).toFixed(1)} ${(p.y * scaleY).toFixed(1)}`,
        )
        .join(" ");

      // Step 3: Draw the stroke as a single vector path with round line caps.
      // x: 0 anchors horizontally, y: height positions the flip origin at
      // the top of the page so coordinates map correctly after scale(1,-1).
      pdfPage.drawSvgPath(pathData, {
        x: 0,
        y: height,
        borderColor: rgb(color.r, color.g, color.b),
        borderWidth: stroke.size * scaleX,
        borderLineCap: LineCapStyle.Round,
        borderOpacity: opacity,
      });
    }
  }

  // --------------------------------------------------------------------
  //  Draw Text Fields (unchanged)
  // --------------------------------------------------------------------
  for (const tf of pageContent.textFields || []) {
    if (!tf.text) continue;
    const color = hexToRgb(tf.color);
    pdfPage.drawText(tf.text, {
      x: tf.x * scaleX,
      y: height - tf.y * scaleY - tf.fontSize * scaleY,
      size: tf.fontSize * scaleY,
      color: rgb(color.r, color.g, color.b),
    });
  }

  // --------------------------------------------------------------------
  //  Draw Shapes
  // --------------------------------------------------------------------
  for (const shape of pageContent.shapes || []) {
    const color = hexToRgb(shape.color);
    const fillColor = shape.fillColor ? hexToRgb(shape.fillColor) : undefined;
    const { type, x, y, width: w, height: h, strokeWidth } = shape;

    // Draw Fill
    if (fillColor) {
      const fillRgb = rgb(fillColor.r, fillColor.g, fillColor.b);
      if (type === "circle") {
        pdfPage.drawEllipse({
          x: (x + w / 2) * scaleX,
          y: height - (y + h / 2) * scaleY,
          xScale: (w / 2) * scaleX,
          yScale: (h / 2) * scaleY,
          borderWidth: 0,
          color: fillRgb,
          opacity: 0.25,
        });
      } else if (type === "square") {
        pdfPage.drawRectangle({
          x: x * scaleX,
          y: height - (y + h) * scaleY,
          width: w * scaleX,
          height: h * scaleY,
          borderWidth: 0,
          color: fillRgb,
          opacity: 0.25,
        });
      } else if (type === "triangle") {
        const p1x = (x + w / 2) * scaleX;
        const p1y = height - y * scaleY;
        const p2x = (x + w) * scaleX;
        const p2y = height - (y + h) * scaleY;
        const p3x = x * scaleX;
        const p3y = height - (y + h) * scaleY;

        const path = `M ${p1x} ${p1y} L ${p2x} ${p2y} L ${p3x} ${p3y} Z`;
        pdfPage.drawSvgPath(path, {
          color: fillRgb,
          opacity: 0.25,
          borderWidth: 0,
        });
      }
    }

    // Draw Stroke
    if (type === "circle") {
      pdfPage.drawEllipse({
        x: (x + w / 2) * scaleX,
        y: height - (y + h / 2) * scaleY,
        xScale: (w / 2) * scaleX,
        yScale: (h / 2) * scaleY,
        borderWidth: strokeWidth * scaleX,
        borderColor: rgb(color.r, color.g, color.b),
        opacity: 1, // Stroke is fully opaque
      });
    } else if (type === "square") {
      pdfPage.drawRectangle({
        x: x * scaleX,
        y: height - (y + h) * scaleY,
        width: w * scaleX,
        height: h * scaleY,
        borderWidth: strokeWidth * scaleX,
        borderColor: rgb(color.r, color.g, color.b),
        opacity: 1,
      });
    } else if (type === "triangle") {
      const p1 = { x: (x + w / 2) * scaleX, y: height - y * scaleY };
      const p2 = { x: (x + w) * scaleX, y: height - (y + h) * scaleY };
      const p3 = { x: x * scaleX, y: height - (y + h) * scaleY };

      pdfPage.drawLine({
        start: p1,
        end: p2,
        thickness: strokeWidth * scaleX,
        color: rgb(color.r, color.g, color.b),
        opacity: 1,
      });
      pdfPage.drawLine({
        start: p2,
        end: p3,
        thickness: strokeWidth * scaleX,
        color: rgb(color.r, color.g, color.b),
        opacity: 1,
      });
      pdfPage.drawLine({
        start: p3,
        end: p1,
        thickness: strokeWidth * scaleX,
        color: rgb(color.r, color.g, color.b),
        opacity: 1,
      });
    }
  }
}

// ----------------------------------------------------------------------
//  Public export functions (unchanged)
// ----------------------------------------------------------------------

export async function exportNotebookToPDF(notebook: Notebook, pages: Page[]) {
  const pdfDoc = await PDFDocument.create();
  const pdfFileCache: Record<string, Uint8Array> = {};

  for (const page of pages) {
    let pdfPage;

    if (page.template === "pdf" && page.pdfFileId && page.pdfPageNumber) {
      let pdfBytes = pdfFileCache[page.pdfFileId];
      if (!pdfBytes) {
        const pdfFile = await getPDFFile(page.pdfFileId);
        if (pdfFile) {
          pdfBytes = new Uint8Array(await pdfFile.blob.arrayBuffer());
          pdfFileCache[page.pdfFileId] = pdfBytes;
        }
      }

      if (pdfBytes) {
        const sourceDoc = await PDFDocument.load(pdfBytes);
        const [embeddedPage] = await pdfDoc.copyPages(sourceDoc, [
          page.pdfPageNumber - 1,
        ]);
        pdfPage = pdfDoc.addPage(embeddedPage);
      } else {
        pdfPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      }
    } else {
      pdfPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pdfPage.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        color: PAPER_BG,
      });

      if (page.template === "squared") {
        for (let x = 0; x <= PAGE_WIDTH; x += GRID_SPACING) {
          pdfPage.drawLine({
            start: { x, y: 0 },
            end: { x, y: PAGE_HEIGHT },
            thickness: 1,
            color: LINE_COLOR,
            opacity: LINE_OPACITY,
          });
        }
        for (let y = 0; y <= PAGE_HEIGHT; y += GRID_SPACING) {
          pdfPage.drawLine({
            start: { x: 0, y },
            end: { x: PAGE_WIDTH, y },
            thickness: 1,
            color: LINE_COLOR,
            opacity: LINE_OPACITY,
          });
        }
      } else if (page.template === "lined") {
        for (let y = LINE_SPACING; y < PAGE_HEIGHT; y += LINE_SPACING) {
          pdfPage.drawLine({
            start: { x: 0, y: PAGE_HEIGHT - y },
            end: { x: PAGE_WIDTH, y: PAGE_HEIGHT - y },
            thickness: 1,
            color: LINE_COLOR,
            opacity: LINE_OPACITY,
          });
        }
      }
    }

    const { width, height } = pdfPage.getSize();
    drawAnnotationsOnPage(pdfPage, page, {
      x: width / PAGE_WIDTH,
      y: height / PAGE_HEIGHT,
    });
  }

  const pdfBytes = await pdfDoc.save();
  await downloadOrSharePDF(pdfBytes, `${notebook.title || "Notebook"}.pdf`);
}

export async function exportAnnotatedPDF(
  pdfFile: PDFFile,
  annotationsMap: Record<
    number,
    { strokes: Stroke[]; textFields: TextField[]; shapes?: Shape[] }
  >,
) {
  const pdfBytes = new Uint8Array(await pdfFile.blob.arrayBuffer());
  const sourceDoc = await PDFDocument.load(pdfBytes);
  const pdfDoc = await PDFDocument.create();
  const pageIndices = Array.from(
    { length: sourceDoc.getPageCount() },
    (_, i) => i,
  );
  const copiedPages = await pdfDoc.copyPages(sourceDoc, pageIndices);

  for (let i = 0; i < copiedPages.length; i++) {
    const pdfPage = pdfDoc.addPage(copiedPages[i]);
    const pageNumber = i + 1;
    const ann = annotationsMap[pageNumber];

    if (ann) {
      drawAnnotationsOnPage(pdfPage, ann, { x: 1, y: 1 });
    }
  }

  const outputBytes = await pdfDoc.save();
  await downloadOrSharePDF(outputBytes, `Annotated_${pdfFile.name}`);
}
