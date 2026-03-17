import { Stroke, StrokePoint } from '../types'

export interface Rect {
    minX: number
    minY: number
    maxX: number
    maxY: number
}

/**
 * Checks if a point is inside a polygon using ray-casting algorithm.
 */
export function isPointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y
        const xj = polygon[j].x, yj = polygon[j].y

        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)
        if (intersect) inside = !inside
    }
    return inside
}

/**
 * Gets the bounding box for a set of points.
 */
export function getBoundingBox(points: { x: number; y: number }[]): Rect {
    if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }

    let minX = points[0].x
    let minY = points[0].y
    let maxX = points[0].x
    let maxY = points[0].y

    for (let i = 1; i < points.length; i++) {
        minX = Math.min(minX, points[i].x)
        minY = Math.min(minY, points[i].y)
        maxX = Math.max(maxX, points[i].x)
        maxY = Math.max(maxY, points[i].y)
    }

    return { minX, minY, maxX, maxY }
}

/**
 * Checks if a point is within a rectangle.
 */
export function isPointInBox(point: { x: number; y: number }, box: Rect, padding = 0): boolean {
    return point.x >= box.minX - padding &&
        point.x <= box.maxX + padding &&
        point.y >= box.minY - padding &&
        point.y <= box.maxY + padding
}

/**
 * Checks if a stroke is "selected" by a lasso polygon.
 * Currently, it checks if any point of the stroke is inside the polygon.
 */
export function isStrokeInPolygon(stroke: Stroke, polygon: { x: number; y: number }[]): boolean {
    if (polygon.length < 3) return false

    // Quick check: if any point is in, it's selected
    // Optimization: we could check center or a subset of points
    return stroke.points.some(p => isPointInPolygon(p, polygon))
}

/**
 * Gets the center of a bounding box.
 */
export function getBoxCenter(box: Rect): { x: number; y: number } {
    return {
        x: (box.minX + box.maxX) / 2,
        y: (box.minY + box.maxY) / 2
    }
}

/**
 * Calculates the shortest distance squared from a point to a line segment.
 */
export function distToSegmentSq(p: { x: number, y: number }, v: { x: number, y: number }, w: { x: number, y: number }) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2
    if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
    t = Math.max(0, Math.min(1, t))
    return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2
}

/**
 * Checks if a point is "covered" by an eraser stroke.
 */
export function isPointErased(point: { x: number, y: number }, eraserStroke: Stroke): boolean {
    // Use fixed eraser size
    const radius = eraserStroke.size

    for (let i = 0; i < eraserStroke.points.length - 1; i++) {
        const p1 = eraserStroke.points[i]
        const p2 = eraserStroke.points[i + 1]

        // We add a tiny bit of padding to match visual erasure which might be slightly anti-aliased or rounded
        const distSq = distToSegmentSq(point, p1, p2)
        if (distSq <= (radius * 1.05) ** 2) {
            return true
        }
    }
    return false
}

/**
 * Splits a stroke into multiple strokes based on eraser intersections.
 * Effectively 'bakes' the erasure into the stroke geometry.
 */
export function splitStroke(original: Stroke, erasers: Stroke[]): Stroke[] {
    const visibleSegments: StrokePoint[][] = []
    let currentSegment: StrokePoint[] = []

    for (const point of original.points) {
        // Check if point is erased by ANY relevant eraser
        // Optimization: check bounding box first? Probably fine for now.
        const isErased = erasers.some(eraser => isPointErased(point, eraser))

        if (isErased) {
            if (currentSegment.length > 0) {
                visibleSegments.push(currentSegment)
                currentSegment = []
            }
        } else {
            currentSegment.push(point)
        }
    }

    if (currentSegment.length > 0) {
        visibleSegments.push(currentSegment)
    }

    // If no change in segments (still 1 segment of same length), return original
    if (visibleSegments.length === 1 && visibleSegments[0].length === original.points.length) {
        return [original]
    }

    // Convert segments to new strokes
    return visibleSegments
        .filter(seg => seg.length >= 2)
        .map(points => ({
            ...original,
            id: crypto.randomUUID(),
            points
        }))
}
/**
 * Checks if a stroke is hit by a circle (e.g., eraser).
 * Checks distance from circle center to each segment of the stroke.
 */
export function isStrokeHitByCircle(stroke: Stroke, center: { x: number, y: number }, radius: number): boolean {
    const radiusSq = radius ** 2
    for (let i = 0; i < stroke.points.length - 1; i++) {
        const v = stroke.points[i]
        const w = stroke.points[i + 1]
        if (distToSegmentSq(center, v, w) <= radiusSq) {
            return true
        }
    }
    // Also check single points if any (though strokes usually have >= 2 points)
    if (stroke.points.length === 1) {
        const p = stroke.points[0]
        const d2 = (p.x - center.x) ** 2 + (p.y - center.y) ** 2
        if (d2 <= radiusSq) return true
    }
    return false
}

/**
 * Checks if a shape is inside a lasso polygon.
 */
export function isShapeInPolygon(shape: import('../types').Shape, polygon: { x: number; y: number }[]): boolean {
    if (polygon.length < 3) return false

    // Check corners and center
    const points = [
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.width, y: shape.y },
        { x: shape.x + shape.width, y: shape.y + shape.height },
        { x: shape.x, y: shape.y + shape.height },
        { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }
    ]

    return points.some(p => isPointInPolygon(p, polygon))
}

