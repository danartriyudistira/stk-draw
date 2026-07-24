import { useRef, useEffect, useCallback } from 'react'
import { renderStroke } from '../engine/StrokeRenderer.js'
import { getLfoValue } from '../engine/LfoEngine.js'

export default function StageCanvas({
  layers,
  activeLayerId,
  setOriginMode,
  onSetOrigin,
  onAddStroke,
  globalTime,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const drawingRef = useRef(false)
  const currentStrokeRef = useRef([])
  const distanceRef = useRef(0)
  const layersRef = useRef(layers)
  const activeLayerIdRef = useRef(activeLayerId)
  const globalTimeRef = useRef(globalTime)
  const setOriginModeRef = useRef(setOriginMode)
  const strokeStartTimeRef = useRef(0)

  layersRef.current = layers
  activeLayerIdRef.current = activeLayerId
  globalTimeRef.current = globalTime
  setOriginModeRef.current = setOriginMode

  const getActiveLayer = useCallback(() => {
    return layersRef.current.find((l) => l.id === activeLayerIdRef.current)
  }, [])

  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    return {
      x: (e.clientX - rect.left) - (canvas.width / dpr) / 2,
      y: (e.clientY - rect.top) - (canvas.height / dpr) / 2,
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let dpr = window.devicePixelRatio || 1
    let cw, ch

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

    const renderFrame = () => {
      const ctx = canvas.getContext('2d')
      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cw, ch)
      ctx.fillStyle = '#111'
      ctx.fillRect(0, 0, cw, ch)

      ctx.save()
      ctx.strokeStyle = '#222'
      ctx.lineWidth = 0.5
      const gridSize = 50
      const offsetX = (cw / 2) % gridSize
      const offsetY = (ch / 2) % gridSize
      for (let gx = -offsetX; gx < cw; gx += gridSize) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ch); ctx.stroke()
      }
      for (let gy = -offsetY; gy < ch; gy += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cw, gy); ctx.stroke()
      }
      ctx.restore()

      ctx.translate(cw / 2, ch / 2)

      const time = globalTimeRef.current
      const ls = layersRef.current
      const aid = activeLayerIdRef.current

      for (const layer of ls) {
        if (!layer.visible) continue

        const tf = layer.transform
        const ox = layer.origin?.x ?? 0
        const oy = layer.origin?.y ?? 0

        const x = tf.x.lfo ? getLfoValue(time, tf.x.lfo, `${layer.id}_x`) : tf.x.base
        const y = tf.y.lfo ? getLfoValue(time, tf.y.lfo, `${layer.id}_y`) : tf.y.base
        const rot = tf.rotation.lfo ? getLfoValue(time, tf.rotation.lfo, `${layer.id}_rot`) : tf.rotation.base
        const sxValue = tf.scaleX.lfo ? getLfoValue(time, tf.scaleX.lfo, `${layer.id}_sx`) : tf.scaleX.base
        const sx = isNaN(sxValue) ? tf.scaleX.base : sxValue
        const syValue = tf.scaleY.linkToScaleX
          ? sx
          : (tf.scaleY.lfo ? getLfoValue(time, tf.scaleY.lfo, `${layer.id}_sy`) : tf.scaleY.base)
        const sy = isNaN(syValue) ? tf.scaleY.base : syValue
        const opValue = tf.opacity.lfo ? getLfoValue(time, tf.opacity.lfo, `${layer.id}_op`) : tf.opacity.base
        const op = isNaN(opValue) ? tf.opacity.base : Math.max(0, Math.min(1, opValue))

        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, op))
        ctx.translate(x, y)
        ctx.translate(ox, oy)
        ctx.rotate((rot * Math.PI) / 180)
        ctx.scale(Math.max(0.01, sx), Math.max(0.01, sy))

        for (const stroke of layer.strokes) {
          if (stroke.points && stroke.points.length > 0) {
            renderStroke(ctx, stroke.points)
          }
        }

        ctx.restore()

        if (layer.id === aid) {
          ctx.save()
          ctx.globalAlpha = 0.7
          ctx.translate(x, y)
          ctx.translate(ox, oy)
          ctx.strokeStyle = '#4fc3f7'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(-14, 0); ctx.lineTo(14, 0)
          ctx.moveTo(0, -14); ctx.lineTo(0, 14)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(0, 0, 6, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }

      if (drawingRef.current) {
        const pts = currentStrokeRef.current
        if (pts.length > 0) {
          const aLayer = ls.find((l) => l.id === aid)
          const aox = aLayer?.origin?.x ?? 0
          const aoy = aLayer?.origin?.y ?? 0
          const atx = aLayer?.transform?.x?.base ?? 0
          const aty = aLayer?.transform?.y?.base ?? 0
          ctx.save()
          ctx.translate(atx, aty)
          ctx.translate(aox, aoy)
          renderStroke(ctx, pts)
          ctx.restore()
        }
      }

      ctx.restore()
      raf = requestAnimationFrame(renderFrame)
    }

    let raf = requestAnimationFrame(renderFrame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    if (setOriginModeRef.current) {
      const pos = getCanvasPos(e)
      onSetOrigin(pos.x, pos.y)
      return
    }

    const layer = getActiveLayer()
    if (!layer || layer.locked) return

    drawingRef.current = true
    distanceRef.current = 0
    strokeStartTimeRef.current = globalTimeRef.current
    currentStrokeRef.current = []

    const pos = getCanvasPos(e)
    const ox = layer.origin?.x ?? 0
    const oy = layer.origin?.y ?? 0
    const lx = pos.x - ox
    const ly = pos.y - oy
    const thickness = getPenLfoVal(layer, 'thickness', globalTimeRef.current, 0)
    const hue = getPenLfoVal(layer, 'hue', globalTimeRef.current, 0)

    currentStrokeRef.current.push({
      x: lx, y: ly,
      thickness: isNaN(thickness) ? 4 : thickness,
      hue: isNaN(hue) ? 200 : hue,
      time: globalTimeRef.current,
      distance: 0,
    })
  }, [getCanvasPos, onSetOrigin, getActiveLayer])

  const handlePointerMove = useCallback((e) => {
    if (!drawingRef.current) return
    const layer = getActiveLayer()
    if (!layer) return

    const pos = getCanvasPos(e)
    const ox = layer.origin?.x ?? 0
    const oy = layer.origin?.y ?? 0
    const lx = pos.x - ox
    const ly = pos.y - oy

    const last = currentStrokeRef.current[currentStrokeRef.current.length - 1]
    if (!last) return

    const dx = lx - last.x
    const dy = ly - last.y
    const segLen = Math.sqrt(dx * dx + dy * dy)
    distanceRef.current += segLen

    const thickness = getPenLfoVal(layer, 'thickness', globalTimeRef.current, distanceRef.current)
    const hue = getPenLfoVal(layer, 'hue', globalTimeRef.current, distanceRef.current)

    currentStrokeRef.current.push({
      x: lx, y: ly,
      thickness: isNaN(thickness) ? 4 : thickness,
      hue: isNaN(hue) ? 200 : hue,
      time: globalTimeRef.current,
      distance: distanceRef.current,
    })
  }, [getCanvasPos, getActiveLayer])

  const handlePointerUp = useCallback(() => {
    if (!drawingRef.current) return
    drawingRef.current = false

    if (currentStrokeRef.current.length > 0) {
      onAddStroke([...currentStrokeRef.current])
      currentStrokeRef.current = []
      distanceRef.current = 0
    }
  }, [onAddStroke])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ display: 'block', width: '100%', height: '100%', cursor: setOriginMode ? 'crosshair' : 'crosshair', touchAction: 'none' }}
      />
    </div>
  )
}

function getPenLfoVal(layer, key, globalTime, distance) {
  const config = layer?.penLFOs?.[key]
  if (!config?.enabled || !config?.lfo) {
    return key === 'thickness' ? 4 : 200
  }
  const lfo = config.lfo
  const phase = lfo.phaseSource === 'distance' ? distance / 100 : globalTime
  return getLfoValue(phase, lfo, `${layer.id}_pen_${key}`)
}
