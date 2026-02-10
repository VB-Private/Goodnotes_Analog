import type { StrokePoint } from '../types'

/**
 * Detects if the drawn points represent a circle and returns replacement "perfected" points.
 */
export function generateCirclePoints(points: StrokePoint[]): StrokePoint[] | null {
    if (points.length < 5) return null

    // Calculate center (average of all points)
    let sumX = 0
    let sumY = 0
    for (const p of points) {
        sumX += p.x
        sumY += p.y
    }
    const centerX = sumX / points.length
    const centerY = sumY / points.length

    // Calculate average radius
    let sumRadius = 0
    for (const p of points) {
        const dx = p.x - centerX
        const dy = p.y - centerY
        sumRadius += Math.sqrt(dx * dx + dy * dy)
    }
    const avgRadius = sumRadius / points.length

    // Heuristic: Check "circularity"
    // If points are very far from the average radius, it's not a circle
    let variance = 0
    for (const p of points) {
        const dx = p.x - centerX
        const dy = p.y - centerY
        const r = Math.sqrt(dx * dx + dy * dy)
        variance += Math.pow(r - avgRadius, 2)
    }
    const stdDev = Math.sqrt(variance / points.length)

    // If variation is more than 40% of radius, it's definitely not a circle
    // (Relaxed from 25% to better handle stylus jitter)
    if (stdDev > avgRadius * 0.4) return null

    // Check "closed-ness": Start and end points should be relatively close
    const startP = points[0]
    const endP = points[points.length - 1]
    const distStartEnd = Math.sqrt(Math.pow(startP.x - endP.x, 2) + Math.pow(startP.y - endP.y, 2))

    // If gap is more than 80% of radius, it's probably just an arc, not a circle
    if (distStartEnd > avgRadius * 0.8) return null

    // Generate perfected points
    const perfectPoints: StrokePoint[] = []
    const steps = 64 // Slightly more steps for smoothness

    // Find average pressure to maintain the analog look
    let avgPressure = 0
    for (const p of points) avgPressure += p.pressure
    avgPressure /= points.length

    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2
        // Add a tiny bit of jitter to radius (0.5%) to keep it looking "analog"
        const jitter = 1 + (Math.random() - 0.5) * 0.005
        perfectPoints.push({
            x: centerX + Math.cos(angle) * avgRadius * jitter,
            y: centerY + Math.sin(angle) * avgRadius * jitter,
            pressure: avgPressure
        })
    }

    return perfectPoints
}
