import { PAGE_WIDTH, PAGE_HEIGHT } from "../constants";
import type { Stroke, StrokePoint, ToolType, Shape } from "../types";

export function getCanvasPoint(
  evt: { clientX: number; clientY: number; pressure?: number },
  canvas: HTMLCanvasElement,
): { x: number; y: number; pressure: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = PAGE_WIDTH / rect.width;
  const scaleY = PAGE_HEIGHT / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY,
    pressure: typeof evt.pressure === "number" ? evt.pressure : 0.5,
  };
}

export interface DrawOptions {
  color?: string;
  size?: number;
  tool?: ToolType;
}

export function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  options: DrawOptions = {},
) {
  const { color = "#000", size = 2, tool = "pen" } = options;
  if (points.length < 2) return;

  ctx.globalAlpha = 1.0;
  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
    if (tool === "crayon") {
      ctx.globalAlpha = 0.4;
    }
  }

  ctx.strokeStyle = tool === "eraser" ? "rgba(0,0,0,1)" : color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = size;

  ctx.beginPath();

  if (points.length === 2) {
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
  } else if (points.length > 2) {
    ctx.moveTo(points[0].x, points[0].y);

    // Draw smooth curve through points
    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }

    // Connect to the last point
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  ctx.stroke();

  // Reset state
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1.0;
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  const {
    type,
    x,
    y,
    width,
    height,
    color,
    strokeWidth,
    fillColor,
    rotation = 0,
  } = shape;
  const cx = x + width / 2;
  const cy = y + height / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.translate(-cx, -cy);
  ctx.beginPath();

  if (type === "circle") {
    ctx.ellipse(
      x + width / 2,
      y + height / 2,
      Math.abs(width / 2),
      Math.abs(height / 2),
      0,
      0,
      Math.PI * 2,
    );
  } else if (type === "square") {
    ctx.rect(x, y, width, height);
  } else if (type === "triangle") {
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
  }

  if (fillColor) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.restore();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

export function drawAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  currentPoints: StrokePoint[] | null,
  currentOptions?: DrawOptions,
  shapes: Shape[] = [],
) {
  ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  // Draw saved shapes
  for (const shape of shapes) {
    drawShape(ctx, shape);
  }

  // Draw saved strokes
  for (const s of strokes) {
    drawStrokePath(ctx, s.points, {
      color: s.color,
      size: s.size,
      tool: s.tool,
    });
  }

  // Draw current stroke being drawn
  if (currentPoints && currentPoints.length >= 2 && currentOptions) {
    drawStrokePath(ctx, currentPoints, currentOptions);
  }
}
