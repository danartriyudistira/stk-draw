import { EASING_PRESETS } from '../data/easingPresets.js'

function cubicBezier(x1, y1, x2, y2) {
  return function easing(t) {
    if (t <= 0) return 0
    if (t >= 1) return 1

    function sampleCurveX(t) {
      return 3 * x1 * (1 - t) ** 2 * t + 3 * x2 * (1 - t) * t ** 2 + t ** 3
    }

    function sampleCurveDerivativeX(t) {
      return 3 * (1 - t) ** 2 * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t ** 2 * (1 - x2)
    }

    let t0 = t
    for (let i = 0; i < 8; i++) {
      const x = sampleCurveX(t0) - t
      if (Math.abs(x) < 1e-7) break
      const dx = sampleCurveDerivativeX(t0)
      if (Math.abs(dx) < 1e-7) break
      t0 -= x / dx
    }
    t0 = Math.max(0, Math.min(1, t0))
    return 3 * y1 * (1 - t0) ** 2 * t0 + 3 * y2 * (1 - t0) * t0 ** 2 + t0 ** 3
  }
}

function springSolver(tension, friction) {
  return function easing(t) {
    if (t <= 0) return 0
    if (t >= 1) return 1
    const mass = 1
    const k = tension * 1000
    const d = friction * 40
    const w0 = Math.sqrt(k / mass)
    const zeta = d / (2 * Math.sqrt(mass * k))
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta)
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t))
    }
    return 1 - Math.exp(-w0 * t)
  }
}

const bezierCache = new Map()
const springCache = new Map()

function getBezierEasing(x1, y1, x2, y2) {
  const key = `${x1},${y1},${x2},${y2}`
  if (!bezierCache.has(key)) {
    bezierCache.set(key, cubicBezier(x1, y1, x2, y2))
  }
  return bezierCache.get(key)
}

function getSpringEasing(tension, friction) {
  const key = `${tension},${friction}`
  if (!springCache.has(key)) {
    springCache.set(key, springSolver(tension, friction))
  }
  return springCache.get(key)
}

export function getEasing(name) {
  const preset = EASING_PRESETS.find((p) => p.name === name)
  if (!preset) return null
  if (preset.type === 'spring') {
    return getSpringEasing(preset.params.tension, preset.params.friction)
  }
  return getBezierEasing(preset.params[0], preset.params[1], preset.params[2], preset.params[3])
}

export function getEasingNames() {
  return EASING_PRESETS.map((p) => p.name)
}

export function getEasingCategories() {
  const cats = []
  let current = null
  for (const p of EASING_PRESETS) {
    if (p.category !== current) {
      current = p.category
      cats.push({ category: current, header: true })
    }
    cats.push({ name: p.name, header: false })
  }
  return cats
}

export function applyEasing(t, easingName) {
  const fn = getEasing(easingName)
  if (!fn) return t
  return fn(Math.max(0, Math.min(1, t)))
}
