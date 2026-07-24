function rgbToHue(r, g, b) {
  const rf = r / 255
  const gf = g / 255
  const bf = b / 255
  const max = Math.max(rf, gf, bf)
  const min = Math.min(rf, gf, bf)
  const delta = max - min
  if (delta === 0) return 0
  let h = 0
  if (max === rf) h = ((gf - bf) / delta) % 6
  else if (max === gf) h = (bf - rf) / delta + 2
  else h = (rf - gf) / delta + 4
  h = Math.round(h * 60)
  if (h < 0) h += 360
  return h
}

function rgbToLightness(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return (max + min) / 2 / 255
}

export function imageToStrokes(image, { maxWidth = 400, step = 3, minThick = 1, maxThick = 6 } = {}) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const scale = Math.min(1, maxWidth / image.width)
  const w = Math.round(image.width * scale)
  const h = Math.round(image.height * scale)

  canvas.width = w
  canvas.height = h
  ctx.drawImage(image, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data
  const ox = -w / 2
  const oy = -h / 2

  const strokes = []

  for (let y = 0; y < h; y += step) {
    const rowPoints = []
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]

      if (a < 30) continue

      const hue = rgbToHue(r, g, b)
      const lightness = rgbToLightness(r, g, b)
      const thickness = minThick + (1 - lightness) * (maxThick - minThick)

      rowPoints.push({
        x: x + ox,
        y: y + oy,
        thickness,
        hue,
        time: 0,
        distance: y * w + x,
      })
    }

    if (rowPoints.length === 1) {
      strokes.push({ points: [rowPoints[0]] })
    } else if (rowPoints.length > 1) {
      strokes.push({ points: rowPoints })
    }
  }

  return { strokes, w, h }
}
