export const LINE_THICKNESS = 12
export const MIN_DISTANCE = 5
export const MAX_VELOCITY = 120
export const MAX_POINTS = 400
export const DRAW_RATE = 120
export const COLORS = [
  '#474954',
  '#FFBA49',
  '#20A39E',
  '#2176AE',
  '#F45B69',
  '#59CD90',
  '#9B5094',
]

const MAX_VELOCITY_SQ = MAX_VELOCITY * MAX_VELOCITY

const Random = Math.random
Random.float = (min, max) => {
  if (max == null) { max = min; min = 0 }
  return min + Random() * (max - min)
}
Random.bool = (chance = 0.5) => Random() < chance
Random.item = (list) => list[~~(Random() * list.length)]

export class Point {
  constructor(x = 0, y = 0) {
    this.stiffness = Random.float(0.65, 0.85)
    this.length = 1.0
    this.wander = Random.float(0.2, 0.95)
    this.jitter = Random.float(0.05, 0.1)
    this.force = Random.float(0.05, 0.3)
    this.speed = Random.float(0.5, 0.8)
    this.theta = Random.float(-Math.PI, Math.PI)
    this.turn = Random.float(0.1, 0.68)
    this.snap = Random.float(0.33)
    this.dragEase = Random.float(0.02, 0.03)
    this.dragMax = Random.float(0.82, 0.95)
    this.active = false
    this.drag = 0.0
    this.age = 0
    this.ox = x
    this.oy = y
    this.vx = 0
    this.vy = 0
    this.x = x
    this.y = y
    this.t = 1
    this.reset()
  }
  reset() {
    this.active = false
    this.drag = 0.0
    this.age = 0
    this.vx = 0
    this.vy = 0
    this.t = 1
    this.x = this.ox
    this.y = this.oy
  }
}

export class Particle {
  constructor(x = 0, y = 0, t = 1) {
    this.x = x
    this.y = y
    this.t = t
    this.vx = 0
    this.vy = 0
  }
}

export class Path {
  constructor(color, config = {}) {
    this.color = color
    this.animated = false
    this.drawProgress = 0
    this.particles = []
    this.points = []
    this.age = 0
    this.thickness = config.thickness || LINE_THICKNESS
    this.drawRate = config.drawRate || DRAW_RATE
    this.maxVelocity = config.maxVelocity || MAX_VELOCITY
    this.particleChance = config.particleChance ?? 0.05
  }
  animate() {
    this.animated = true
    this.reset()
  }
  append(point) {
    if (this.points.length > 0) {
      const prev = this.points[this.points.length - 1]
      const dx = prev.x - point.x
      const dy = prev.y - point.y
      point.length = Math.sqrt(dx * dx + dy * dy) * Random.float(0.5, 4.0)
      point.theta = Math.atan2(dy, dx) + Random.float(-Math.PI, Math.PI)
    }
    this.points.push(point)
  }
  spawn(point) {
    const { x, y, t } = point
    const particle = new Particle(x, y, t * Random.float(0.4, 1.0))
    particle.vx = Math.max(-5, Math.min(5, point.vx * Random.float(0.2, 1.5)))
    particle.vy = Math.max(-5, Math.min(5, point.vy * Random.float(0.2, 1.5)))
    this.particles.push(particle)
  }
  reset() {
    for (const point of this.points) point.reset()
    this.particles.length = 0
    this.drawProgress = 0
    this.age = 0
  }
}

export class Animator {
  step(paths, dt) {
    for (const path of paths) {
      this.updatePath(path, dt)
      this.animatePoints(path, dt)
      this.animateParticles(path.particles, dt)
    }
  }
  updatePath(path, dt) {
    if (path.animated) {
      const length = path.points.length
      if (path.drawProgress < length) {
        const progress = Math.min(length, Math.ceil(path.age * path.drawRate))
        for (let i = 0; i < path.points.length; i++) {
          path.points[i].active = i <= progress
        }
        path.drawProgress = progress
      } else {
        const active = path.points.filter((p) => p.active)
        if (active.length >= 3) {
          if (Random.bool(0.25)) {
            const point = active[0]
            point.active = false
          }
        } else {
          path.reset()
        }
      }
      path.age += dt
    }
  }
  animatePoints(path, dt) {
    const { animated, drawProgress } = path
    if (!animated || drawProgress <= 0) return
    const points = path.points.filter((p) => p.active)
    if (points.length < 2) return
    const maxV = path.maxVelocity
    const maxVSq = maxV * maxV
    let magSq, mag, dx, dy, ds, d, f, p, i, n
    let o = points[0]
    for (i = 1, n = points.length; i < n; i++) {
      p = points[i]
      if (!p.active) continue
      dx = o.x - p.x
      dy = o.y - p.y
      ds = dx * dx + dy * dy + 1
      d = Math.sqrt(ds)
      if (d > o.length + 200) {
        o.active = false
        continue
      }
      f = (d - p.length) / d * p.stiffness
      o.vx += dx * -f * o.force
      o.vy += dy * -f * o.force
      o.theta += Random.float(-o.turn, o.turn)
      o.vx += Math.cos(o.theta) * o.wander
      o.vy += Math.sin(o.theta) * o.wander
      o.vx += Random.float(-o.jitter, o.jitter)
      o.vy += Random.float(-o.jitter, o.jitter)
      magSq = o.vx * o.vx + o.vy * o.vy
      if (magSq > maxVSq) {
        mag = Math.sqrt(magSq)
        o.vx /= mag
        o.vy /= mag
        o.vx *= maxV
        o.vy *= maxV
        o.active = false
      }
      o.x -= dx * o.snap
      o.y -= dy * o.snap
      o.drag += (o.dragMax - o.drag) * o.dragEase
      o.vx *= o.drag
      o.vy *= o.drag
      o.x += o.vx * o.speed
      o.y += o.vy * o.speed
      o.age++
      if (i === n - 1) {
        p.vx += dx * -f * p.force
        p.vy += dy * -f * p.force
        p.theta += Random.float(-p.turn, p.turn)
        p.vx += Math.cos(p.theta) * p.wander
        p.vy += Math.sin(p.theta) * p.wander
        p.vx += Random.float(-p.jitter, p.jitter)
        p.vy += Random.float(-p.jitter, p.jitter)
        magSq = p.vx * p.vx + p.vy * p.vy
        if (magSq > maxVSq) {
          mag = Math.sqrt(magSq)
          p.vx /= mag
          p.vy /= mag
          p.vx *= maxV
          p.vy *= maxV
          p.active = false
        }
        p.drag += (p.dragMax - p.drag) * p.dragEase
        p.t = Math.pow(Math.sin((i / n) * Math.PI), 2) || 0.1
        p.t *= Math.min(1, Math.max(0.1, n / 40)) || 0.1
        p.vx *= p.drag
        p.vy *= p.drag
        p.x += p.vx * p.speed
        p.y += p.vy * p.speed
        p.age++
      }
      if (path.particles.length < 100 && Random.bool(path.particleChance)) {
        path.spawn(o)
      }
      o.t = Math.pow(Math.sin((i / n) * Math.PI), 2) || 0.1
      o.t *= Math.min(1, Math.max(0.1, n / 40)) || 0.1
      o = p
    }
  }
  animateParticles(particles, dt) {
    for (let p, i = particles.length - 1; i >= 0; i--) {
      p = particles[i]
      p.t *= 0.95
      p.vx += Random.float(-0.3, 0.3)
      p.vy += Random.float(-0.3, 0.3)
      p.vx *= 0.95
      p.vy *= 0.95
      p.x += p.vx
      p.y += p.vy
      if (p.t < 0.1) {
        particles.splice(i, 1)
      }
    }
  }
}

const TWO_PI = Math.PI * 2

function catmullRomToBezier(p0, p1, p2, p3) {
  const i6 = 1 / 6
  return {
    cp1x: p2.x * i6 + p1.x - p0.x * i6,
    cp1y: p2.y * i6 + p1.y - p0.y * i6,
    cp2x: p3.x * -i6 + p2.x + p1.x * i6,
    cp2y: p3.y * -i6 + p2.y + p1.y * i6,
  }
}

export function renderKineticPath(ctx, path, thickness) {
  const points = path.animated
    ? path.points.filter((p) => p.active)
    : path.points
  if (points.length < 3) return

  ctx.strokeStyle = path.color
  ctx.fillStyle = path.color

  if (path.animated) {
    ctx.save()
    ctx.globalAlpha = 0.5
    for (const p of points) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.t * 18, 0, TWO_PI)
      ctx.fill()
    }
    ctx.globalAlpha = 1.0
  }

  ctx.beginPath()
  let ox = points[0].x
  let oy = points[0].y
  let ct = Number.MAX_VALUE
  for (let i = 0; i < points.length - 3; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const p2 = points[i + 2]
    const p3 = points[i + 3]
    const { cp1x, cp1y, cp2x, cp2y } = catmullRomToBezier(p0, p1, p2, p3)
    ctx.moveTo(ox, oy)
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
    ox = p2.x
    oy = p2.y
    const t = (points[i + 3].t || 1) * thickness
    if (Math.abs(ct - t) > 1.5) {
      ctx.lineWidth = t
      ctx.stroke()
      ctx.beginPath()
      ct = t
    }
  }
  ctx.stroke()

  if (path.animated) {
    ctx.restore()
  }
}

export function renderKineticParticles(ctx, particles) {
  if (!particles || particles.length === 0) return
  ctx.save()
  ctx.globalAlpha = 0.5
  for (const p of particles) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.t * 12, 0, TWO_PI)
    ctx.fill()
  }
  ctx.restore()
}
