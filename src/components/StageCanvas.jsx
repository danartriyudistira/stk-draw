import { useRef, useEffect, useCallback, useState } from 'react'
import { renderStroke } from '../engine/StrokeRenderer.js'
import { getLfoValue } from '../engine/LfoEngine.js'
import { globalTimeRef as sharedTimeRef } from '../App.jsx'
import { Point, Path, Animator, renderKineticPath, renderKineticParticles, MIN_DISTANCE, LINE_THICKNESS } from '../engine/KineticEngine.js'
import { ShaderLayerRenderer } from '../engine/ShaderLayerRenderer.js'

function useLfo(lfo) {
  return lfo && lfo.waveform !== 'none'
}

function computeTfValues(layer, time, keyPrefix) {
  const tf = layer[keyPrefix]
  if (!tf) return { x: 0, y: 0, rot: 0, sx: 1, sy: 1, op: 1 }
  const x = useLfo(tf.x.lfo) ? getLfoValue(time, tf.x.lfo, `${layer.id}_${keyPrefix}_x`) : tf.x.lfo.min
  const y = useLfo(tf.y.lfo) ? getLfoValue(time, tf.y.lfo, `${layer.id}_${keyPrefix}_y`) : tf.y.lfo.min
  const rot = useLfo(tf.rotation.lfo) ? getLfoValue(time, tf.rotation.lfo, `${layer.id}_${keyPrefix}_rot`) : tf.rotation.lfo.min
  const sxVal = useLfo(tf.scaleX.lfo) ? getLfoValue(time, tf.scaleX.lfo, `${layer.id}_${keyPrefix}_sx`) : tf.scaleX.lfo.min
  const sx = isNaN(sxVal) ? tf.scaleX.lfo.min : sxVal
  const syVal = tf.scaleY.linkToScaleX
    ? sx
    : (useLfo(tf.scaleY.lfo) ? getLfoValue(time, tf.scaleY.lfo, `${layer.id}_${keyPrefix}_sy`) : tf.scaleY.lfo.min)
  const sy = isNaN(syVal) ? tf.scaleY.lfo.min : syVal
  const opVal = useLfo(tf.opacity.lfo) ? getLfoValue(time, tf.opacity.lfo, `${layer.id}_${keyPrefix}_op`) : tf.opacity.lfo.min
  const op = isNaN(opVal) ? tf.opacity.lfo.min : Math.max(0, Math.min(1, opVal))
  return { x, y, rot, sx, sy, op }
}

export default function StageCanvas({
  layers,
  activeLayerId,
  setOriginMode,
  drawMode,
  onSetOrigin,
  onAddStroke,
  onUpdateTransformBase,
  onUpdateLayer,
  bgColor = '#111',
  showGrid = true,
  interactive = true,
  showFullscreenBtn = false,
  outputRect = null,
  onSetOutputRect = null,
  onSetAspectRatio = null,
  aspectRatio = 'free',
  isOutputView = false,
  onShaderCompileResult = null,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const drawingRef = useRef(false)
  const currentStrokeRef = useRef([])
  const distanceRef = useRef(0)
  const layersRef = useRef(layers)
  const activeLayerIdRef = useRef(activeLayerId)
  const setOriginModeRef = useRef(setOriginMode)
  const drawModeRef = useRef(drawMode)
  const strokeStartTimeRef = useRef(0)
  const cacheMapRef = useRef(new Map())
  const imageCacheRef = useRef(new Map())
  const transformDragRef = useRef(false)
  const transformBaseRef = useRef({ x: 0, y: 0, rot: 0, sx: 1, sy: 1 })
  const transformPointerRef = useRef({ x: 0, y: 0 })

  const zoomRef = useRef(1)
  const panXRef = useRef(0)
  const panYRef = useRef(0)
  const panningRef = useRef(false)
  const panStartScreenRef = useRef({ x: 0, y: 0 })
  const panStartPanRef = useRef({ x: 0, y: 0 })

  const parentChainOffsetRef = useRef({ x: 0, y: 0 })
  const chainInvMatRef = useRef(null)
  const chainFwdMatRef = useRef(null)
  const parentChainInvMatRef = useRef(null)
  const activeLayerTfRef = useRef({ x: 0, y: 0 })
  const activeLayerPfRef = useRef(null)

  const MIN_POINT_DIST = 3
  const SMOOTH_WINDOW = 3

  function smoothStroke(points) {
    if (points.length <= SMOOTH_WINDOW + 1) return points
    const result = [points[0]]
    const half = Math.floor(SMOOTH_WINDOW / 2)
    for (let i = 1; i < points.length - 1; i++) {
      let sumX = 0, sumY = 0, sumT = 0, sumH = 0, sumS = 0, sumL = 0, sumD = 0
      let count = 0
      for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
        sumX += points[j].x
        sumY += points[j].y
        sumT += points[j].thickness || 4
        sumH += points[j].hue || 200
        sumS += points[j].saturation || 70
        sumL += points[j].lightness || 50
        sumD += points[j].distance || 0
        count++
      }
      result.push({
        x: sumX / count,
        y: sumY / count,
        thickness: sumT / count,
        hue: sumH / count,
        saturation: sumS / count,
        lightness: sumL / count,
        time: points[i].time,
        distance: sumD / count,
      })
    }
    result.push(points[points.length - 1])
    return result
  }

  const cursorWorldRef = useRef({ x: 0, y: 0, active: false })
  const kineticAnimatorRef = useRef(new Animator())
  const kineticCurrentPathRef = useRef(null)
  const lastTimeRef = useRef(performance.now())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const outputRectDragRef = useRef(null)
  const outputRectRef = useRef(outputRect)
  const aspectRatioRef = useRef(aspectRatio)
  const isOutputViewRef = useRef(isOutputView)
  const isFrameActiveRef = useRef(false)
  const shaderRenderersRef = useRef(new Map())
  const shaderMetaRef = useRef(new Map())
  const onShaderCompileResultRef = useRef(null)

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen()
    }
  }, [])

  useEffect(() => {
    if (!showFullscreenBtn) return
    const el = containerRef.current
    if (!el) return
    const handler = (e) => {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
      }
    }
    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [toggleFullscreen, showFullscreenBtn])

  layersRef.current = layers
  activeLayerIdRef.current = activeLayerId
  setOriginModeRef.current = setOriginMode
  drawModeRef.current = drawMode
  outputRectRef.current = outputRect
  aspectRatioRef.current = aspectRatio
  isOutputViewRef.current = isOutputView
  const active = layers.find((l) => l.id === activeLayerId)
  isFrameActiveRef.current = active?.type === 'frame'
  onShaderCompileResultRef.current = onShaderCompileResult

  const getActiveLayer = useCallback(() => {
    return layersRef.current.find((l) => l.id === activeLayerIdRef.current)
  }, [])

  const resetCursor = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (setOriginModeRef.current) canvas.style.cursor = 'cell'
    else if (drawModeRef.current) canvas.style.cursor = 'crosshair'
    else canvas.style.cursor = 'grab'
  }, [])

  const getCanvasPos = useCallback((e, parentSpace = false) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.width / dpr
    const cssH = canvas.height / dpr
    const sx = (e.clientX - rect.left) - cssW / 2
    const sy = (e.clientY - rect.top) - cssH / 2
    const z = zoomRef.current
    const worldX = sx / z - panXRef.current
    const worldY = sy / z - panYRef.current

    const invMat = parentSpace ? parentChainInvMatRef.current : chainInvMatRef.current
    if (invMat) {
      const p = invMat.transformPoint({ x: worldX, y: worldY })
      return { x: p.x, y: p.y }
    }
    const po = parentChainOffsetRef.current
    return {
      x: worldX - po.x,
      y: worldY - po.y,
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let dpr = window.devicePixelRatio || 1
    let cw, ch

    const ctx = canvas.getContext('2d')

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      cw = container.clientWidth
      ch = container.clientHeight
      canvas.width = cw * dpr
      canvas.height = ch * dpr
      canvas.style.width = `${cw}px`
      canvas.style.height = `${ch}px`
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(container)

    const CACHE_THRESHOLD = 200

    const ensureCache = (layer) => {
      let entry = cacheMapRef.current.get(layer.id)
      if (entry && entry.strokesRef === layer.strokes) return entry

      const totalPoints = (layer.strokes || []).reduce((s, st) => s + (st.points?.length || 0), 0)
      if (totalPoints < CACHE_THRESHOLD) {
        const e = { strokesRef: layer.strokes, canvas: null }
        cacheMapRef.current.set(layer.id, e)
        return e
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const st of layer.strokes || []) {
        for (const p of st.points || []) {
          if (p.x < minX) minX = p.x
          if (p.y < minY) minY = p.y
          if (p.x > maxX) maxX = p.x
          if (p.y > maxY) maxY = p.y
        }
      }
      if (!isFinite(minX)) {
        minX = -100; minY = -100; maxX = 100; maxY = 100
      }

      const pad = 60
      const bw = Math.ceil(maxX - minX + pad * 2)
      const bh = Math.ceil(maxY - minY + pad * 2)
      const oc = document.createElement('canvas')
      oc.width = Math.min(bw, 4096)
      oc.height = Math.min(bh, 4096)
      const octx = oc.getContext('2d')
      octx.translate(-minX + pad, -minY + pad)
      for (const st of layer.strokes || []) {
        if (st.points?.length) renderStroke(octx, st.points)
      }

      entry = { strokesRef: layer.strokes, canvas: oc, ox: minX - pad, oy: minY - pad }
      cacheMapRef.current.set(layer.id, entry)
      return entry
    }

    const buildTree = (ls) => {
      const nodeMap = new Map()
      const roots = []
      for (const l of ls) {
        nodeMap.set(l.id, { layer: l, children: [] })
      }
      for (const l of ls) {
        const node = nodeMap.get(l.id)
        if (l.parentId && nodeMap.has(l.parentId)) {
          nodeMap.get(l.parentId).children.push(node)
        } else {
          roots.push(node)
        }
      }
      return { roots, nodeMap }
    }

    const renderNode = (node, tfComputed, pfComputed, dm, aid, inDraw, linkVisited) => {
      const layer = node.layer
      if (!layer.visible) return

      const tfc = tfComputed.get(layer.id)
      if (!tfc) return

      const ox = layer.origin?.x ?? 0
      const oy = layer.origin?.y ?? 0
      const isActive = layer.id === aid
      const isGroup = layer.type === 'group'

      const pfc = pfComputed.get(layer.id)
      const applyPlacement = !dm && !!pfc

      const visited = linkVisited ? new Set(linkVisited) : new Set()
      visited.add(layer.id)

      const linkStack = []
      let currId = layer.linkParentId
      while (currId) {
        if (visited.has(currId)) break
        const lp = layersRef.current.find((l) => l.id === currId)
        if (!lp) break
        visited.add(lp.id)
        linkStack.unshift(lp)
        currId = lp.linkParentId
      }

      ctx.save()
      ctx.globalAlpha = (applyPlacement ? Math.max(0, Math.min(1, pfc.op)) : 1) * Math.max(0, Math.min(1, tfc.op))
      if (layer.blendMode && layer.blendMode !== 'source-over') {
        ctx.globalCompositeOperation = layer.blendMode
      }

      for (const lp of linkStack) {
        const ltfc = tfComputed.get(lp.id)
        if (!ltfc) continue
        const lox = lp.origin?.x ?? 0
        const loy = lp.origin?.y ?? 0
        const lpfc = pfComputed.get(lp.id)
        const lpApply = !dm && !!lpfc
        if (lpApply) {
          ctx.translate(lpfc.x, lpfc.y)
          ctx.translate(lox, loy)
          ctx.rotate((lpfc.rot * Math.PI) / 180)
          ctx.scale(Math.max(0.01, lpfc.sx) * (lp.placement?.flipH ? -1 : 1), Math.max(0.01, lpfc.sy) * (lp.placement?.flipV ? -1 : 1))
          ctx.translate(-lox, -loy)
        }
        ctx.translate(ltfc.x, ltfc.y)
        ctx.translate(lox, loy)
        if (lp.type !== 'group') {
          ctx.rotate((ltfc.rot * Math.PI) / 180)
          ctx.scale(Math.max(0.01, ltfc.sx) * (lp.transform?.flipH ? -1 : 1), Math.max(0.01, ltfc.sy) * (lp.transform?.flipV ? -1 : 1))
        }
      }

      if (layer.type !== 'frame') {
        if (applyPlacement) {
          ctx.translate(pfc.x, pfc.y)
          ctx.translate(ox, oy)
          ctx.rotate((pfc.rot * Math.PI) / 180)
          ctx.scale(Math.max(0.01, pfc.sx) * (layer.placement?.flipH ? -1 : 1), Math.max(0.01, pfc.sy) * (layer.placement?.flipV ? -1 : 1))
          ctx.translate(-ox, -oy)
        }

        ctx.translate(tfc.x, tfc.y)
        ctx.translate(ox, oy)
        if (!isGroup) {
          ctx.rotate((tfc.rot * Math.PI) / 180)
          ctx.scale(Math.max(0.01, tfc.sx) * (layer.transform?.flipH ? -1 : 1), Math.max(0.01, tfc.sy) * (layer.transform?.flipV ? -1 : 1))
        }
      }

      if (layer.type === 'kinetic') {
        const paths = layer.paths || []
        const inProgressPath = kineticCurrentPathRef.current
        const allPaths = inProgressPath && inProgressPath.points.length > 0
          ? [...paths, inProgressPath]
          : paths
        for (const p of allPaths) {
          renderKineticPath(ctx, p, p.thickness || LINE_THICKNESS)
          renderKineticParticles(ctx, p.particles)
        }
      } else if (layer.type === 'image' && layer.src && layer.imgW && layer.imgH) {
        let entry = imageCacheRef.current.get(layer.id)
        if (!entry || entry.src !== layer.src) {
          const imgEl = new Image()
          imgEl.src = layer.src
          entry = { img: imgEl, src: layer.src }
          imageCacheRef.current.set(layer.id, entry)
        }
        ctx.drawImage(entry.img, -layer.imgW / 2, -layer.imgH / 2, layer.imgW, layer.imgH)
      } else if (layer.type === 'frame') {
      } else if (layer.type === 'shader') {
        const renderer = shaderRenderersRef.current.get(layer.id)
        if (renderer && renderer.getCanvas()) {
          const cvs = renderer.getCanvas()
          const cwCss = cvs.width / (window.devicePixelRatio || 1)
          const chCss = cvs.height / (window.devicePixelRatio || 1)
          ctx.drawImage(cvs, -cwCss / 2, -chCss / 2, cwCss, chCss)
        }
      } else if (!isGroup) {
        const cache = ensureCache(layer)
        if (cache.canvas) {
          ctx.drawImage(cache.canvas, cache.ox, cache.oy)
        } else {
          for (const stroke of layer.strokes) {
            if (stroke.points && stroke.points.length > 0) {
              renderStroke(ctx, stroke.points)
            }
          }
        }
      } else {
        drawGroupIndicator(ctx)
      }

      if (!isOutputViewRef.current) {
        if (drawingRef.current && isActive && inDraw) {
          const pts = currentStrokeRef.current
          if (pts.length > 0) {
            ctx.save()
            ctx.globalAlpha = Math.max(0, Math.min(1, layer.transform.opacity.lfo.min))
            renderStroke(ctx, pts)
            ctx.restore()
          }
        }

        if (isActive) {
          drawCrosshair(ctx)
        }

        if (!dm && isActive) {
          const bbox = computeTreeBbox(node, tfComputed, pfComputed, dm)
          if (bbox) {
            drawBoundingBox(ctx, bbox)
          }
        }
      }

      for (const child of node.children) {
        renderNode(child, tfComputed, pfComputed, dm, aid, inDraw, visited)
      }

      ctx.restore()
    }

    const drawGroupIndicator = (c) => {
      c.save()
      c.globalAlpha = 0.3
      c.strokeStyle = '#bb86fc'
      c.lineWidth = 1
      c.setLineDash([4, 4])
      c.beginPath()
      c.arc(0, 0, 20, 0, Math.PI * 2)
      c.stroke()
      c.setLineDash([])
      c.restore()
    }

    const drawCrosshair = (c) => {
      c.save()
      c.globalAlpha = 0.7
      c.strokeStyle = '#4fc3f7'
      c.lineWidth = 1.5
      c.beginPath()
      c.moveTo(-14, 0); c.lineTo(14, 0)
      c.moveTo(0, -14); c.lineTo(0, 14)
      c.stroke()
      c.beginPath()
      c.arc(0, 0, 6, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }

    const drawBoundingBox = (c, bbox) => {
      const cx = (bbox.minX + bbox.maxX) / 2
      const cy = (bbox.minY + bbox.maxY) / 2
      const bw = bbox.maxX - bbox.minX + 20
      const bh = bbox.maxY - bbox.minY + 20

      c.strokeStyle = '#4fc3f7'
      c.lineWidth = 1.5
      c.setLineDash([6, 3])
      c.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh)
      c.setLineDash([])

      const hs = 10
      c.fillStyle = '#4fc3f7'
      c.strokeStyle = '#1a1a1a'
      c.lineWidth = 1.5
      const corners = [
        { x: cx - bw / 2, y: cy - bh / 2 }, { x: cx + bw / 2, y: cy - bh / 2 },
        { x: cx - bw / 2, y: cy + bh / 2 }, { x: cx + bw / 2, y: cy + bh / 2 },
      ]
      for (const corner of corners) {
        c.beginPath()
        c.rect(corner.x - hs / 2, corner.y - hs / 2, hs, hs)
        c.fill()
        c.stroke()
      }
    }

    const computeTreeBbox = (node, tfComputed, pfComputed, dm) => {
      const layer = node.layer
      if (layer.type === 'frame') {
        const r = layer.frameRect || { x: 0, y: 0, w: 1600, h: 900 }
        return { minX: r.x, minY: r.y, maxX: r.x + r.w, maxY: r.y + r.h }
      }
      if (layer.type === 'image' && layer.imgW && layer.imgH) {
        const hw = layer.imgW / 2
        const hh = layer.imgH / 2
        return { minX: -hw, minY: -hh, maxX: hw, maxY: hh }
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

      if (layer.type !== 'group') {
        for (const st of layer.strokes || []) {
          for (const p of st.points || []) {
            if (p.x < minX) minX = p.x
            if (p.y < minY) minY = p.y
            if (p.x > maxX) maxX = p.x
            if (p.y > maxY) maxY = p.y
          }
        }
        for (const p of layer.paths || []) {
          for (const pt of p.points || []) {
            if (pt.x < minX) minX = pt.x
            if (pt.y < minY) minY = pt.y
            if (pt.x > maxX) maxX = pt.x
            if (pt.y > maxY) maxY = pt.y
          }
        }
      }

      for (const child of node.children) {
        const childBbox = computeChildWorldBbox(child, tfComputed, pfComputed, dm)
        if (childBbox) {
          if (childBbox.minX < minX) minX = childBbox.minX
          if (childBbox.minY < minY) minY = childBbox.minY
          if (childBbox.maxX > maxX) maxX = childBbox.maxX
          if (childBbox.maxY > maxY) maxY = childBbox.maxY
        }
      }

      if (!isFinite(minX)) return null
      return { minX, minY, maxX, maxY }
    }

    const computeChildWorldBbox = (node, tfComputed, pfComputed, dm) => {
      const layer = node.layer
      const tfc = tfComputed.get(layer.id)
      if (!tfc) return null

      const ox = layer.origin?.x ?? 0
      const oy = layer.origin?.y ?? 0
      const tx = (tfc.x || 0) + ox
      const ty = (tfc.y || 0) + oy

      const pfc = pfComputed.get(layer.id)
      const plTx = (!dm && pfc) ? (pfc.x || 0) : 0
      const plTy = (!dm && pfc) ? (pfc.y || 0) : 0

      let localBbox
      if (layer.type === 'frame') {
        const r = layer.frameRect || { x: 0, y: 0, w: 1600, h: 900 }
        localBbox = { minX: r.x, minY: r.y, maxX: r.x + r.w, maxY: r.y + r.h }
      } else if (layer.type === 'image' && layer.imgW && layer.imgH) {
        const hw = layer.imgW / 2
        const hh = layer.imgH / 2
        localBbox = { minX: -hw, minY: -hh, maxX: hw, maxY: hh }
      } else if (layer.type === 'group') {
        localBbox = computeTreeBbox(node, tfComputed, pfComputed, dm)
      } else {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const st of layer.strokes || []) {
          for (const p of st.points || []) {
            if (p.x < minX) minX = p.x
            if (p.y < minY) minY = p.y
            if (p.x > maxX) maxX = p.x
            if (p.y > maxY) maxY = p.y
          }
        }
        for (const path of layer.paths || []) {
          for (const pt of path.points || []) {
            if (pt.x < minX) minX = pt.x
            if (pt.y < minY) minY = pt.y
            if (pt.x > maxX) maxX = pt.x
            if (pt.y > maxY) maxY = pt.y
          }
        }
        if (!isFinite(minX)) localBbox = null
        else localBbox = { minX, minY, maxX, maxY }
      }

      if (!localBbox) return null
      return {
        minX: localBbox.minX + tx + plTx,
        minY: localBbox.minY + ty + plTy,
        maxX: localBbox.maxX + tx + plTx,
        maxY: localBbox.maxY + ty + plTy,
      }
    }

    const computeChainMatrices = (ls, tfComputed, pfComputed, layerId, dm, excludeSelf) => {
      const visited = new Set()
      const chain = []
      let currentId = layerId

      while (true) {
        if (visited.has(currentId)) break
        visited.add(currentId)
        const layer = ls.find((l) => l.id === currentId)
        if (!layer) break

        chain.push(layer)

        if (layer.linkParentId && !visited.has(layer.linkParentId)) {
          currentId = layer.linkParentId
        } else if (layer.parentId && !visited.has(layer.parentId)) {
          currentId = layer.parentId
        } else {
          break
        }
      }

      chain.reverse()

      const fwd = new DOMMatrix()
      for (const link of chain) {
        if (excludeSelf && link.id === layerId) continue
        const ltfc = tfComputed.get(link.id)
        if (!ltfc) continue
        const lox = link.origin?.x ?? 0
        const loy = link.origin?.y ?? 0

        fwd.translateSelf(ltfc.x, ltfc.y)
        fwd.translateSelf(lox, loy)
        if (link.type !== 'group') {
          fwd.rotateSelf(0, 0, ltfc.rot)
          fwd.scaleSelf(
            Math.max(0.01, ltfc.sx) * (link.transform?.flipH ? -1 : 1),
            Math.max(0.01, ltfc.sy) * (link.transform?.flipV ? -1 : 1),
          )
        }

        if (!dm) {
          const lpfc = pfComputed.get(link.id)
          if (lpfc) {
            fwd.translateSelf(lpfc.x, lpfc.y)
            fwd.translateSelf(lox, loy)
            fwd.rotateSelf(0, 0, lpfc.rot)
            fwd.scaleSelf(
              Math.max(0.01, lpfc.sx) * (link.placement?.flipH ? -1 : 1),
              Math.max(0.01, lpfc.sy) * (link.placement?.flipV ? -1 : 1),
            )
            fwd.translateSelf(-lox, -loy)
          }
        }
      }

      return fwd
    }

    const computeChainOffset = (ls, tfComputed, layerId) => {
      let ox = 0, oy = 0
      const visited = new Set()
      let currentId = layerId
      while (true) {
        const layer = ls.find((l) => l.id === currentId)
        if (!layer || visited.has(currentId)) break
        visited.add(currentId)
        const tfc = tfComputed.get(layer.id)
        if (tfc) {
          ox += (tfc.x || 0) + (layer.origin?.x ?? 0)
          oy += (tfc.y || 0) + (layer.origin?.y ?? 0)
        }
        if (layer.linkParentId && !visited.has(layer.linkParentId)) {
          currentId = layer.linkParentId
        } else if (layer.parentId && !visited.has(layer.parentId)) {
          currentId = layer.parentId
        } else {
          break
        }
      }
      return { x: ox, y: oy }
    }

    const renderFrame = () => {
      try {
        const now = performance.now()
        const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
        lastTimeRef.current = now

        const shaderRenderers = shaderRenderersRef.current
        const currentShaderIds = new Set(layersRef.current.filter(l => l.type === 'shader').map(l => l.id))
        for (const [id] of shaderRenderers) {
          if (!currentShaderIds.has(id)) {
            shaderRenderers.get(id)?.dispose()
            shaderRenderers.delete(id)
            shaderMetaRef.current.delete(id)
          }
        }

        for (const layer of layersRef.current) {
          if (layer.type !== 'shader' || !layer.visible) continue

          const meta = shaderMetaRef.current
          const prev = meta.get(layer.id)
          const currentMeta = { code: layer.code, rekey: layer.shaderRekey ?? 0 }
          if (!prev || prev.code !== currentMeta.code || prev.rekey !== currentMeta.rekey) {
            const old = shaderRenderersRef.current.get(layer.id)
            if (old) {
              old.dispose()
              shaderRenderersRef.current.delete(layer.id)
            }
            meta.set(layer.id, currentMeta)
          }

          let renderer = shaderRenderersRef.current.get(layer.id)
          if (!renderer) {
            renderer = new ShaderLayerRenderer()
            shaderRenderersRef.current.set(layer.id, renderer)
          }
          const ok = renderer.compile(layer.code, layer.shaderRekey ?? 0)
          if (ok) renderer.render(sharedTimeRef.current, cw, ch, undefined, undefined, layer.isfParams)
          if (onShaderCompileResultRef.current) {
            onShaderCompileResultRef.current(layer.id, ok ? null : renderer.getError())
          }
        }

        ctx.save()
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, cw, ch)
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, cw, ch)

        const z = zoomRef.current
      const px = panXRef.current
      const py = panYRef.current

      if (isOutputViewRef.current) {
        const rect = outputRectRef.current
        if (rect && rect.w > 0 && rect.h > 0) {
          const s = Math.min(cw / rect.w, ch / rect.h)
          ctx.translate(cw / 2, ch / 2)
          ctx.scale(s, s)
          ctx.translate(-rect.x - rect.w / 2, -rect.y - rect.h / 2)
        }
      } else {
        ctx.translate(cw / 2, ch / 2)
        ctx.scale(z, z)
        ctx.translate(px, py)
      }

      const worldLeft = -cw / 2 / z - px
      const worldRight = cw / 2 / z - px
      const worldTop = -ch / 2 / z - py
      const worldBottom = ch / 2 / z - py
      if (showGrid) {
        const gridSize = 50
        const gx0 = Math.floor(worldLeft / gridSize) * gridSize
        const gy0 = Math.floor(worldTop / gridSize) * gridSize
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let gx = gx0; gx <= worldRight; gx += gridSize) {
          ctx.moveTo(gx, worldTop)
          ctx.lineTo(gx, worldBottom)
        }
        for (let gy = gy0; gy <= worldBottom; gy += gridSize) {
          ctx.moveTo(worldLeft, gy)
          ctx.lineTo(worldRight, gy)
        }
        ctx.stroke()
      }

      const time = sharedTimeRef.current
      const ls = layersRef.current
      const aid = activeLayerIdRef.current
      const dm = drawModeRef.current

      const tfComputed = new Map()
      const pfComputed = new Map()
      for (const layer of ls) {
        if (!layer.visible) continue
        tfComputed.set(layer.id, computeTfValues(layer, time, 'transform'))
        if (layer.placement) {
          pfComputed.set(layer.id, computeTfValues(layer, time, 'placement'))
        }
      }

      parentChainOffsetRef.current = computeChainOffset(ls, tfComputed, aid)
      const chainMat = computeChainMatrices(ls, tfComputed, pfComputed, aid, dm)
      const parentChainMat = computeChainMatrices(ls, tfComputed, pfComputed, aid, dm, true)
      chainFwdMatRef.current = chainMat
      chainInvMatRef.current = chainMat.is2D ? chainMat.inverse() : null
      parentChainInvMatRef.current = parentChainMat.is2D ? parentChainMat.inverse() : null

      for (const layer of ls) {
        if (layer.type === 'kinetic' && layer.paths) {
          kineticAnimatorRef.current.step(layer.paths, dt)
        }
      }

      activeLayerTfRef.current = {
        x: tfComputed.get(aid)?.x ?? 0,
        y: tfComputed.get(aid)?.y ?? 0,
      }
      activeLayerPfRef.current = pfComputed.get(aid) ?? null

      const { roots } = buildTree(ls)
      const inDraw = dm && !!ls.find((l) => l.id === aid && !l.locked && l.type !== 'group' && l.type !== 'kinetic' && l.type !== 'frame' && l.type !== 'shader')

      for (const root of roots) {
        renderNode(root, tfComputed, pfComputed, dm, aid, inDraw)
      }

      if (!isOutputViewRef.current && cursorWorldRef.current.active && dm && !setOriginModeRef.current) {
        const aLayer = ls.find((l) => l.id === aid)
        if (aLayer && aLayer.type !== 'group' && aLayer.type !== 'kinetic' && aLayer.type !== 'frame' && aLayer.type !== 'shader') {
          let cx = cursorWorldRef.current.x
          let cy = cursorWorldRef.current.y
          const fwdMat = chainFwdMatRef.current
          if (fwdMat) {
            const p = fwdMat.transformPoint({ x: cx, y: cy })
            cx = p.x
            cy = p.y
          } else {
            const po = parentChainOffsetRef.current
            cx += po.x
            cy += po.y
          }
          const r = getPenLfoVal(aLayer, 'thickness', time, time * 100) / 2
          const h = getPenLfoVal(aLayer, 'hue', time, time * 100)
          const s = getPenLfoVal(aLayer, 'saturation', time, time * 100)
          const l = getPenLfoVal(aLayer, 'lightness', time, time * 100)

          ctx.save()
          ctx.globalAlpha = 0.45
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2)
          ctx.stroke()
          ctx.globalAlpha = 0.25
          ctx.fillStyle = `hsl(${h},${s}%,${l}%)`
          ctx.fill()
          ctx.restore()
        }
      }

      if (!isOutputViewRef.current && outputRectRef.current) {
        const rect = outputRectRef.current
        const active = isFrameActiveRef.current
        ctx.save()
        ctx.beginPath()
        ctx.rect(worldLeft - 9999, worldTop - 9999, 99999, 99999)
        ctx.rect(rect.x, rect.y, rect.w, rect.h)
        ctx.fillStyle = active ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)'
        ctx.fill('evenodd')
        ctx.restore()

        ctx.save()
        ctx.strokeStyle = active ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)'
        ctx.lineWidth = active ? 1.5 : 1
        ctx.setLineDash([active ? 6 : 4, active ? 4 : 4])
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
        ctx.setLineDash([])
        ctx.restore()

        if (active) {
          ctx.save()
          const hs = 8
          const handles = [
            { x: rect.x, y: rect.y },
            { x: rect.x + rect.w / 2, y: rect.y },
            { x: rect.x + rect.w, y: rect.y },
            { x: rect.x + rect.w, y: rect.y + rect.h / 2 },
            { x: rect.x + rect.w, y: rect.y + rect.h },
            { x: rect.x + rect.w / 2, y: rect.y + rect.h },
            { x: rect.x, y: rect.y + rect.h },
            { x: rect.x, y: rect.y + rect.h / 2 },
          ]
          ctx.fillStyle = '#fff'
          for (const h of handles) {
            ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs)
          }
          ctx.restore()
        }
      }

      ctx.restore()
      } catch (e) {
        console.error('[StageCanvas] render frame error:', e)
      }
      raf = requestAnimationFrame(renderFrame)
    }

    let raf = requestAnimationFrame(renderFrame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const handlePointerDown = useCallback((e) => {
    if (!interactive) return
    if (e.button === 1) {
      e.preventDefault()
      panningRef.current = true
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = 'grabbing'

      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.width / dpr
      const cssH = canvas.height / dpr
      panStartScreenRef.current = {
        x: (e.clientX - rect.left) - cssW / 2,
        y: (e.clientY - rect.top) - cssH / 2,
      }
      panStartPanRef.current = { x: panXRef.current, y: panYRef.current }

      const handleMove = (ev) => {
        if (!panningRef.current) return
        const sx = (ev.clientX - rect.left) - cssW / 2
        const sy = (ev.clientY - rect.top) - cssH / 2
        const dsx = sx - panStartScreenRef.current.x
        const dsy = sy - panStartScreenRef.current.y
        panXRef.current = panStartPanRef.current.x + dsx / zoomRef.current
        panYRef.current = panStartPanRef.current.y + dsy / zoomRef.current
      }

      const handleUp = () => {
        panningRef.current = false
        const cvs = canvasRef.current
        if (cvs) {
          if (setOriginModeRef.current) cvs.style.cursor = 'cell'
          else if (drawModeRef.current) cvs.style.cursor = 'crosshair'
          else cvs.style.cursor = 'grab'
        }
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      return
    }

    e.preventDefault()
    if (setOriginModeRef.current) {
      const pos = getCanvasPos(e)
      onSetOrigin(pos.x, pos.y)
      return
    }

    const outRect = outputRectRef.current
    const activeLayer = getActiveLayer()
    if (drawModeRef.current && !isOutputViewRef.current && activeLayer?.type === 'frame' && outRect && onSetOutputRect) {
      const pos = getCanvasPos(e)
      const hit = hitTestOutputRect(pos, outRect)
      if (hit) {
        outputRectDragRef.current = { ...hit, startRect: { ...outRect }, startPos: { ...pos } }
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = 'grabbing'
        return
      }
      return
    }

    if (!drawModeRef.current) {
      const layer = getActiveLayer()
      if (!layer) return
      transformDragRef.current = true
      const pos = getCanvasPos(e, true)
      transformPointerRef.current = { x: pos.x, y: pos.y }
      if (layer.type === 'frame') {
        const r = layer.frameRect || { x: 0, y: 0, w: 1600, h: 900 }
        transformBaseRef.current = { x: r.x, y: r.y, rot: 0, sx: 1, sy: 1 }
      } else {
        const pl = layer.placement
        if (pl) {
          transformBaseRef.current = {
            x: pl.x.lfo.min,
            y: pl.y.lfo.min,
            rot: pl.rotation.lfo.min,
            sx: pl.scaleX.lfo.min,
            sy: pl.scaleY.lfo.min,
          }
        }
      }
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = 'grabbing'
      return
    }

    const layer = getActiveLayer()
    if (!layer || layer.locked || layer.type === 'group' || layer.type === 'shader') return

    if (layer.type === 'kinetic') {
      const pos = getCanvasPos(e)
      const hue = getPenLfoVal(layer, 'hue', sharedTimeRef.current, 0)
      const sat = getPenLfoVal(layer, 'saturation', sharedTimeRef.current, 0)
      const lit = getPenLfoVal(layer, 'lightness', sharedTimeRef.current, 0)
      const color = `hsl(${hue},${sat}%,${lit}%)`
      const path = new Path(color, {
        thickness: layer.thickness,
        drawRate: layer.drawRate,
        maxVelocity: layer.maxVelocity,
        particleChance: layer.particleChance,
      })
      path.append(new Point(pos.x, pos.y))
      kineticCurrentPathRef.current = path
      drawingRef.current = true
      return
    }

    drawingRef.current = true
    distanceRef.current = 0
    strokeStartTimeRef.current = sharedTimeRef.current
    currentStrokeRef.current = []

    const pos = getCanvasPos(e)
    const thickness = getPenLfoVal(layer, 'thickness', sharedTimeRef.current, 0)
    const hue = getPenLfoVal(layer, 'hue', sharedTimeRef.current, 0)
    const sat = getPenLfoVal(layer, 'saturation', sharedTimeRef.current, 0)
    const lit = getPenLfoVal(layer, 'lightness', sharedTimeRef.current, 0)

    currentStrokeRef.current.push({
      x: pos.x, y: pos.y,
      thickness: isNaN(thickness) ? 4 : thickness,
      hue: isNaN(hue) ? 200 : hue,
      saturation: isNaN(sat) ? 70 : sat,
      lightness: isNaN(lit) ? 50 : lit,
      time: sharedTimeRef.current,
      distance: 0,
    })
  }, [getCanvasPos, onSetOrigin, getActiveLayer])


  const handlePointerMove = useCallback((e) => {
    if (!interactive) return
    if (panningRef.current) return

    const drag = outputRectDragRef.current
    if (drag) {
      const pos = getCanvasPos(e)
      updateOutputRectDrag(drag, pos, aspectRatioRef.current, onSetOutputRect)
      return
    }

    const pos = getCanvasPos(e)

    if (drawModeRef.current && !setOriginModeRef.current) {
      cursorWorldRef.current = { x: pos.x, y: pos.y, active: true }
    } else {
      cursorWorldRef.current.active = false
    }

    if (transformDragRef.current) {
      const dragPos = getCanvasPos(e, true)
      const dx = dragPos.x - transformPointerRef.current.x
      const dy = dragPos.y - transformPointerRef.current.y
      const tb = transformBaseRef.current
      onUpdateTransformBase((layer) => {
        if (layer.type === 'frame') {
          const r = layer.frameRect || { x: 0, y: 0, w: 1600, h: 900 }
          return { ...layer, frameRect: { ...r, x: tb.x + dx, y: tb.y + dy } }
        }
        const pl = layer.placement
        if (!pl) return layer
        return {
          ...layer,
          placement: {
            ...pl,
            x: { ...pl.x, lfo: { ...pl.x.lfo, min: tb.x + dx } },
            y: { ...pl.y, lfo: { ...pl.y.lfo, min: tb.y + dy } },
          },
        }
      })
      return
    }

    if (!drawingRef.current) return
    const layer = getActiveLayer()
    if (!layer) return

    if (kineticCurrentPathRef.current) {
      const kp = kineticCurrentPathRef.current
      const last = kp.points[kp.points.length - 1]
      if (last) {
        const dx = pos.x - last.x
        const dy = pos.y - last.y
        if (Math.sqrt(dx * dx + dy * dy) >= MIN_DISTANCE && kp.points.length < 400) {
          kp.append(new Point(pos.x, pos.y))
        }
      }
      return
    }

    const lx = pos.x
    const ly = pos.y

    if (e.shiftKey) {
      const start = currentStrokeRef.current[0]
      if (!start) return
      const lineDist = Math.sqrt((lx - start.x) ** 2 + (ly - start.y) ** 2)
      distanceRef.current = lineDist
      const thickness = getPenLfoVal(layer, 'thickness', sharedTimeRef.current, lineDist)
      const hue = getPenLfoVal(layer, 'hue', sharedTimeRef.current, lineDist)
      const sat = getPenLfoVal(layer, 'saturation', sharedTimeRef.current, lineDist)
      const lit = getPenLfoVal(layer, 'lightness', sharedTimeRef.current, lineDist)
      currentStrokeRef.current = [
        start,
        {
          x: lx, y: ly,
          thickness: isNaN(thickness) ? 4 : thickness,
          hue: isNaN(hue) ? 200 : hue,
          saturation: isNaN(sat) ? 70 : sat,
          lightness: isNaN(lit) ? 50 : lit,
          time: sharedTimeRef.current,
          distance: lineDist,
        },
      ]
      return
    }

    const last = currentStrokeRef.current[currentStrokeRef.current.length - 1]
    if (!last) return

    const dx = lx - last.x
    const dy = ly - last.y
    const segLen = Math.sqrt(dx * dx + dy * dy)
    if (segLen < MIN_POINT_DIST) return
    distanceRef.current += segLen

    const thickness = getPenLfoVal(layer, 'thickness', sharedTimeRef.current, distanceRef.current)
    const hue = getPenLfoVal(layer, 'hue', sharedTimeRef.current, distanceRef.current)
    const sat = getPenLfoVal(layer, 'saturation', sharedTimeRef.current, distanceRef.current)
    const lit = getPenLfoVal(layer, 'lightness', sharedTimeRef.current, distanceRef.current)

    currentStrokeRef.current.push({
      x: lx, y: ly,
      thickness: isNaN(thickness) ? 4 : thickness,
      hue: isNaN(hue) ? 200 : hue,
      saturation: isNaN(sat) ? 70 : sat,
      lightness: isNaN(lit) ? 50 : lit,
      time: sharedTimeRef.current,
      distance: distanceRef.current,
    })
  }, [getCanvasPos, getActiveLayer, onUpdateTransformBase])

  const handlePointerUp = useCallback(() => {
    if (!interactive) return
    if (panningRef.current) return

    if (outputRectDragRef.current) {
      outputRectDragRef.current = null
      resetCursor()
      return
    }

    if (transformDragRef.current) {
      transformDragRef.current = false
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = 'grab'
      return
    }
    if (!drawingRef.current) {
      cursorWorldRef.current.active = false
      return
    }
    drawingRef.current = false

    if (kineticCurrentPathRef.current) {
      const kp = kineticCurrentPathRef.current
      kineticCurrentPathRef.current = null
      if (kp.points.length >= 3) {
        kp.animate()
        if (typeof onUpdateLayer === 'function') {
          onUpdateLayer((layer) => ({
            ...layer,
            paths: [...(layer.paths || []), kp],
          }))
        }
      }
      return
    }

    if (currentStrokeRef.current.length > 0) {
      const smoothed = smoothStroke([...currentStrokeRef.current])
      onAddStroke(smoothed)
      currentStrokeRef.current = []
      distanceRef.current = 0
    }
  }, [onAddStroke, onUpdateLayer])

  const handleWheel = useCallback((e) => {
    if (!interactive) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.width / dpr
    const cssH = canvas.height / dpr
    const sx = (e.clientX - rect.left) - cssW / 2
    const sy = (e.clientY - rect.top) - cssH / 2

    const oldZoom = zoomRef.current
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.1, Math.min(10, oldZoom * factor))
    if (newZoom === oldZoom) return

    const wx = sx / oldZoom - panXRef.current
    const wy = sy / oldZoom - panYRef.current
    const ratio = oldZoom / newZoom
    zoomRef.current = newZoom
    panXRef.current = (wx + panXRef.current) * ratio - wx
    panYRef.current = (wy + panYRef.current) * ratio - wy
  }, [])

  useEffect(() => {
    resetCursor()
  }, [drawMode, setOriginMode, resetCursor])

  return (
    <div ref={containerRef} tabIndex={0} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, outline: 'none' }}>
      {showFullscreenBtn && (
        <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 10, display: 'flex', gap: 4 }}>
          <button
            onClick={toggleFullscreen}
            title="Fullscreen (F)"
            style={{
              background: 'rgba(0,0,0,0.5)', border: '1px solid #444',
              color: '#ccc', borderRadius: 3, padding: '2px 6px',
              fontSize: 11, cursor: 'pointer',
            }}
          >
            {isFullscreen ? '⛶ Exit FS' : '⛶ Fullscreen'}
          </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={interactive ? handlePointerDown : undefined}
        onPointerMove={interactive ? handlePointerMove : undefined}
        onPointerUp={interactive ? handlePointerUp : undefined}
        onPointerLeave={interactive ? () => { cursorWorldRef.current.active = false } : undefined}
        onWheel={interactive ? handleWheel : undefined}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
        }}
      />
    </div>
  )
}

function getPenLfoVal(layer, key, globalTime, distance) {
  const config = layer?.penLFOs?.[key]
  if (!config?.lfo || config.lfo.waveform === 'none') {
    if (key === 'thickness') return 4
    if (key === 'hue') return 200
    if (key === 'saturation') return 70
    if (key === 'lightness') return 50
    return 0
  }
  const lfo = config.lfo
  const phase = lfo.phaseSource === 'distance' ? distance / 100 : globalTime
  return getLfoValue(phase, lfo, `${layer.id}_pen_${key}`)
}

const HIT_RADIUS = 8
const EDGE_HIT = 6

function hitTestOutputRect(pos, rect) {
  const handles = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w / 2, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h / 2 },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x + rect.w / 2, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h / 2 },
  ]
  for (let i = 0; i < handles.length; i++) {
    if (Math.abs(pos.x - handles[i].x) < HIT_RADIUS && Math.abs(pos.y - handles[i].y) < HIT_RADIUS) {
      return { mode: 'resize', handleIndex: i }
    }
  }
  const onLeft = pos.x >= rect.x - EDGE_HIT && pos.x <= rect.x + EDGE_HIT && pos.y >= rect.y && pos.y <= rect.y + rect.h
  const onRight = pos.x >= rect.x + rect.w - EDGE_HIT && pos.x <= rect.x + rect.w + EDGE_HIT && pos.y >= rect.y && pos.y <= rect.y + rect.h
  const onTop = pos.y >= rect.y - EDGE_HIT && pos.y <= rect.y + EDGE_HIT && pos.x >= rect.x && pos.x <= rect.x + rect.w
  const onBottom = pos.y >= rect.y + rect.h - EDGE_HIT && pos.y <= rect.y + rect.h + EDGE_HIT && pos.x >= rect.x && pos.x <= rect.x + rect.w
  if (onLeft || onRight || onTop || onBottom) return { mode: 'move' }
  return null
}

const ASPECT_VALUES = { '16:9': 16 / 9, '4:3': 4 / 3, '3:2': 3 / 2, '1:1': 1 }

function updateOutputRectDrag(drag, pos, aspectRatio, onSet) {
  if (drag.mode === 'move') {
    const r = drag.startRect
    onSet({ x: r.x + pos.x - drag.startPos.x, y: r.y + pos.y - drag.startPos.y, w: r.w, h: r.h })
    return
  }
  const r = drag.startRect
  const fixed = [
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
    { x: r.x, y: r.y },
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y },
  ]
  const f = fixed[drag.handleIndex]
  let w = Math.abs(pos.x - f.x)
  let h = Math.abs(pos.y - f.y)
  w = Math.max(20, w)
  h = Math.max(20, h)
  const ratio = ASPECT_VALUES[aspectRatio]
  if (ratio) {
    if (w / h > ratio) h = w / ratio
    else w = h * ratio
  }
  const x = pos.x > f.x ? f.x : f.x - w
  const y = pos.y > f.y ? f.y : f.y - h
  onSet({ x, y, w, h })
}
