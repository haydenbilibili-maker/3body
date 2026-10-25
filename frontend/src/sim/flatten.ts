/**
 * 二向箔——纯逻辑。
 * 一个三维物体跌进二维时，它的每一层都要摊开在同一个平面上：厚度变成零，面积变得极大。
 * 这里把图像切成 n 层，跌落后首尾相接排成一条。
 */
export const LAYERS = 12

export interface Slice {
  /** 这一层在原图里的纵向偏移 */
  srcY: number
  x: number
  y: number
}

export function slices(size: number, flat: boolean, n = LAYERS): Slice[] {
  const h = size / n
  return Array.from({ length: n }, (_, i) => ({
    srcY: i * h,
    x: flat ? i * size : 0,
    y: flat ? 0 : i * h,
  }))
}

/** 跌落后的外形：宽、高 */
export function flatExtent(size: number, n = LAYERS) {
  return { width: size * n, height: size / n }
}

export const SPECIMENS = [
  { id: 'earth', name: '地球' },
  { id: 'saturn', name: '土星' },
  { id: 'city', name: '一座太空城' },
] as const
export type SpecimenId = (typeof SPECIMENS)[number]['id']
