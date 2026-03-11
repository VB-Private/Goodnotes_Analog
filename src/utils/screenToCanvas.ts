export function screenToCanvas(
    screenX: number,
    screenY: number,
    containerRect: DOMRect,
    zoom: number,
    offsetX: number,
    offsetY: number
) {
    // 1. Convert screen coordinates to container-relative coordinates
    const containerX = screenX - containerRect.left
    const containerY = screenY - containerRect.top

    // 2. Invert the transform: 
    // containerPt = canvasPt * zoom + offset
    // canvasPt = (containerPt - offset) / zoom
    const canvasX = (containerX - offsetX) / zoom
    const canvasY = (containerY - offsetY) / zoom

    return { x: canvasX, y: canvasY }
}
