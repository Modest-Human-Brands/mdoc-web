export interface PageBox {
  top: number
  bottom: number
}

export function mostVisiblePage(pages: PageBox[], viewTop: number, viewBottom: number): number {
  let best = 1
  let bestVisible = 0
  pages.forEach((box, index) => {
    const visible = Math.min(box.bottom, viewBottom) - Math.max(box.top, viewTop)
    if (visible > bestVisible) {
      bestVisible = visible
      best = index + 1
    }
  })
  return best
}