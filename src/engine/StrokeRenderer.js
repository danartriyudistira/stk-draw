function hslToCss(h, s, l) {
  return `hsl(${h},${s}%,${l}%)`
}

function dist(ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  return Math.sqrt(dx * dx + dy * dy)
}

function safeLen(l) {
  return l < 0.0001 ? 1 : l
}

function miterOffset(px, py, prevX, prevY, nextX, nextY, halfWidth, sign) {
  const d1x = px - prevX
  const d1y = py - prevY
  const l1 = dist(prevX, prevY, px, py)
  const d2x = nextX - px
  const d2y = nextY - py
  const l2 = dist(px, py, nextX, nextY)

  const t1x = d1x / safeLen(l1)
  const t1y = d1y / safeLen(l1)
  const t2x = d2x / safeLen(l2)
  const t2y = d2y / safeLen(l2)

  const tx = t1x + t2x
  const ty = t1y + t2y
  const tl = dist(0, 0, tx, ty)

  if (tl < 0.001) {
    const nx = -t1y * sign
    const ny = t1x * sign
    return { x: px + nx * halfWidth, y: py + ny * halfWidth }
  }

  const bx = tx / tl
  const by = ty / tl

  const n1x = -t1y * sign
  const n1y = t1x * sign

  const mx = -by * sign
  const my = bx * sign

  const dot = n1x * mx + n1y * my

  if (dot <= 0) {
    return { x: px + n1x * halfWidth, y: py + n1y * halfWidth }
  }

  const miterLen = halfWidth / dot
  const cap = Math.min(miterLen, halfWidth * 4)

  return {
    x: px + mx * cap,
    y: py + my * cap,
  }
}

function cutOffset(px, py, dirX, dirY, halfWidth, sign) {
  const len = safeLen(dist(0, 0, dirX, dirY))
  const nx = -(dirY / len) * sign
  const ny = (dirX / len) * sign
  return {
    x: px + nx * halfWidth,
    y: py + ny * halfWidth,
  }
}

export function renderStroke(ctx, points) {
  if (points.length < 1) return
  if (points.length === 1) {
    const p = points[0]
    const w = (p.thickness || 4) / 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, w, 0, Math.PI * 2)
    ctx.fillStyle = hslToCss(p.hue || 200, p.saturation ?? 70, p.lightness ?? 50)
    ctx.fill()
    return
  }

  const n = points.length

  for (let i = 1; i < n; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    const w1 = (p1.thickness || 2) / 2
    const w2 = (p2.thickness || 2) / 2
    const h1 = p1.hue ?? 200
    const h2 = p2.hue ?? 200
    const s1 = p1.saturation ?? 70
    const s2 = p2.saturation ?? 70
    const l1 = p1.lightness ?? 50
    const l2 = p2.lightness ?? 50

    const dirX = p2.x - p1.x
    const dirY = p2.y - p1.y

    let o1, i1, o2, i2

    if (i > 1) {
      const prev = points[i - 2]
      o1 = miterOffset(p1.x, p1.y, prev.x, prev.y, p2.x, p2.y, w1, 1)
      i1 = miterOffset(p1.x, p1.y, prev.x, prev.y, p2.x, p2.y, w1, -1)
    } else {
      o1 = cutOffset(p1.x, p1.y, dirX, dirY, w1, 1)
      i1 = cutOffset(p1.x, p1.y, dirX, dirY, w1, -1)
    }

    if (i < n - 1) {
      const next = points[i + 1]
      o2 = miterOffset(p2.x, p2.y, p1.x, p1.y, next.x, next.y, w2, 1)
      i2 = miterOffset(p2.x, p2.y, p1.x, p1.y, next.x, next.y, w2, -1)
    } else {
      o2 = cutOffset(p2.x, p2.y, dirX, dirY, w2, 1)
      i2 = cutOffset(p2.x, p2.y, dirX, dirY, w2, -1)
    }

    const len = safeLen(dist(0, 0, dirX, dirY))
    const unx = dirX / len
    const uny = dirY / len
    const overlap = 1

    if (i > 1) {
      o1.x -= unx * overlap
      o1.y -= uny * overlap
      i1.x -= unx * overlap
      i1.y -= uny * overlap
    }
    if (i < n - 1) {
      o2.x += unx * overlap
      o2.y += uny * overlap
      i2.x += unx * overlap
      i2.y += uny * overlap
    }

    const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y)
    grad.addColorStop(0, hslToCss(h1, s1, l1))
    grad.addColorStop(1, hslToCss(h2, s2, l2))

    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(o1.x, o1.y)
    ctx.lineTo(o2.x, o2.y)
    ctx.lineTo(i2.x, i2.y)
    ctx.lineTo(i1.x, i1.y)
    ctx.closePath()
    ctx.fill()
  }
}
