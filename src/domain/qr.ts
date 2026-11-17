import { encode } from 'uqr'

export type QrEyeShape = 'square' | 'rounded' | 'circle' | 'leaf'
export type QrColorMode = 'brand' | 'monochrome'

export interface QrStyle {
  color: QrColorMode
  eyeShape: QrEyeShape
  eyeColor: QrColorMode
  logo: boolean
}

export interface QrPalette {
  primary: string
  accent: string
}

export const QR_EYE_SHAPES: QrEyeShape[] = ['square', 'rounded', 'circle', 'leaf']
export const QR_COLOR_MODES: QrColorMode[] = ['brand', 'monochrome']

export const defaultQrStyle: QrStyle = {
  color: 'brand',
  eyeShape: 'rounded',
  eyeColor: 'brand',
  logo: true,
}

const MONOCHROME = '#111111'
const MIN_CONTRAST = 4.5
const EYE_SIZE = 7

export interface QrGeometry {
  size: number
  modules: string
  eyes: { frame: string; ball: string }[]
  logoBox?: { x: number; y: number; size: number }
}

export interface QrRender extends QrGeometry {
  moduleColor: string
  eyeColor: string
}

function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(full.slice(index, index + 2), 16) / 255
    return channel <= 0.039_28 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const isHex = (value: unknown): value is string =>
  typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)

function safeColor(mode: QrColorMode, color: string | undefined): string {
  if (mode === 'monochrome' || !isHex(color)) return MONOCHROME
  const contrast = 1.05 / (luminance(color) + 0.05)
  return contrast >= MIN_CONTRAST ? color : MONOCHROME
}

const fmt = (value: number) => String(Math.round(value * 1000) / 1000)

function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  [tl, tr, br, bl]: number[],
  reverse: boolean,
): string {
  const arc = (r: number, toX: number, toY: number) =>
    r > 0
      ? `A${fmt(r)} ${fmt(r)} 0 0 ${reverse ? 0 : 1} ${fmt(toX)} ${fmt(toY)}`
      : `L${fmt(toX)} ${fmt(toY)}`
  if (reverse) {
    return [
      `M${fmt(x + tl!)} ${fmt(y)}`,
      arc(tl!, x, y + tl!),
      `L${fmt(x)} ${fmt(y + h - bl!)}`,
      arc(bl!, x + bl!, y + h),
      `L${fmt(x + w - br!)} ${fmt(y + h)}`,
      arc(br!, x + w, y + h - br!),
      `L${fmt(x + w)} ${fmt(y + tr!)}`,
      arc(tr!, x + w - tr!, y),
      'Z',
    ].join('')
  }
  return [
    `M${fmt(x + tl!)} ${fmt(y)}`,
    `L${fmt(x + w - tr!)} ${fmt(y)}`,
    arc(tr!, x + w, y + tr!),
    `L${fmt(x + w)} ${fmt(y + h - br!)}`,
    arc(br!, x + w - br!, y + h),
    `L${fmt(x + bl!)} ${fmt(y + h)}`,
    arc(bl!, x, y + h - bl!),
    `L${fmt(x)} ${fmt(y + tl!)}`,
    arc(tl!, x + tl!, y),
    'Z',
  ].join('')
}

function circle(cx: number, cy: number, r: number, reverse: boolean): string {
  const sweep = reverse ? 0 : 1
  return `M${fmt(cx - r)} ${fmt(cy)}A${fmt(r)} ${fmt(r)} 0 1 ${sweep} ${fmt(cx + r)} ${fmt(cy)}A${fmt(r)} ${fmt(r)} 0 1 ${sweep} ${fmt(cx - r)} ${fmt(cy)}Z`
}

function eyeShapes(shape: QrEyeShape, x: number, y: number): { frame: string; ball: string } {
  if (shape === 'circle') {
    return {
      frame: circle(x + 3.5, y + 3.5, 3.5, false) + circle(x + 3.5, y + 3.5, 2.5, true),
      ball: circle(x + 3.5, y + 3.5, 1.5, false),
    }
  }

  const [outer, hole, ball] = {
    square: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    rounded: [
      [2, 2, 2, 2],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ],
    leaf: [
      [2.5, 0, 2.5, 0],
      [1.5, 0, 1.5, 0],
      [1.5, 0, 1.5, 0],
    ],
  }[shape]!

  return {
    frame: roundedRect(x, y, 7, 7, outer!, false) + roundedRect(x + 1, y + 1, 5, 5, hole!, true),
    ball: roundedRect(x + 2, y + 2, 3, 3, ball!, false),
  }
}

export function qrGeometry(text: string, style: Pick<QrStyle, 'eyeShape' | 'logo'>): QrGeometry {
  const { data, size } = encode(text, { ecc: style.logo ? 'H' : 'M', border: 0 })

  const logoSide = style.logo ? Math.max(5, Math.round(size * 0.24) | 1) : 0
  const logoStart = Math.floor((size - logoSide) / 2)
  const insideLogo = (x: number, y: number) =>
    logoSide > 0 &&
    x >= logoStart &&
    x < logoStart + logoSide &&
    y >= logoStart &&
    y < logoStart + logoSide
  const insideEye = (x: number, y: number) =>
    (x < EYE_SIZE && y < EYE_SIZE) ||
    (x >= size - EYE_SIZE && y < EYE_SIZE) ||
    (x < EYE_SIZE && y >= size - EYE_SIZE)

  const runs: string[] = []
  for (let y = 0; y < size; y++) {
    let start = -1
    for (let x = 0; x <= size; x++) {
      const dark = x < size && data[y]![x]! && !insideEye(x, y) && !insideLogo(x, y)
      if (dark && start === -1) start = x
      if (!dark && start !== -1) {
        runs.push(`M${start} ${y}h${x - start}v1h${start - x}z`)
        start = -1
      }
    }
  }

  return {
    size,
    modules: runs.join(''),
    eyes: [
      eyeShapes(style.eyeShape, 0, 0),
      eyeShapes(style.eyeShape, size - EYE_SIZE, 0),
      eyeShapes(style.eyeShape, 0, size - EYE_SIZE),
    ],
    ...(logoSide > 0 && { logoBox: { x: logoStart, y: logoStart, size: logoSide } }),
  }
}

export function buildQr(text: string, style: QrStyle, palette: Partial<QrPalette>): QrRender {
  return {
    ...qrGeometry(text, style),
    moduleColor: safeColor(style.color, palette.primary),
    eyeColor: safeColor(style.eyeColor, palette.accent ?? palette.primary),
  }
}

export function normalizeQrStyle(input: unknown): QrStyle {
  const value = (input && typeof input === 'object' ? input : {}) as Partial<
    Record<keyof QrStyle, unknown>
  >
  return {
    color: QR_COLOR_MODES.includes(value.color as QrColorMode)
      ? (value.color as QrColorMode)
      : defaultQrStyle.color,
    eyeShape: QR_EYE_SHAPES.includes(value.eyeShape as QrEyeShape)
      ? (value.eyeShape as QrEyeShape)
      : defaultQrStyle.eyeShape,
    eyeColor: QR_COLOR_MODES.includes(value.eyeColor as QrColorMode)
      ? (value.eyeColor as QrColorMode)
      : defaultQrStyle.eyeColor,
    logo: typeof value.logo === 'boolean' ? value.logo : defaultQrStyle.logo,
  }
}

export function renderQrSvg(
  render: QrRender,
  options: { quietZone?: number; background?: string } = {},
): string {
  const { quietZone = 2, background = '#ffffff' } = options
  const total = render.size + quietZone * 2
  const eyes = render.eyes
    .map(
      (eye) =>
        `<path d="${eye.frame}" fill="${render.eyeColor}"/><path d="${eye.ball}" fill="${render.eyeColor}"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}"><rect width="${total}" height="${total}" fill="${background}"/><g transform="translate(${quietZone} ${quietZone})"><path d="${render.modules}" fill="${render.moduleColor}"/>${eyes}</g></svg>`
}