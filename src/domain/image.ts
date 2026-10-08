export const LOGO_MAX_SIDE = 256

export function fitWithin(
  width: number,
  height: number,
  max: number = LOGO_MAX_SIDE,
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: max, height: max }
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not read that image.'))
    image.src = url
  })
}

export async function rasterizeLogo(file: Blob, max: number = LOGO_MAX_SIDE): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await load(objectUrl)
    const size = fitWithin(image.naturalWidth, image.naturalHeight, max)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not process that image.')
    context.drawImage(image, 0, 0, size.width, size.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}