import { useRef, useEffect, memo } from 'react'
import { getLfoValue, getWaveformShape } from '../engine/LfoEngine.js'
import { globalTimeRef } from '../App.jsx'

function WaveformPreview({ config, width = 200, height = 36 }) {
  const canvasRef = useRef(null)
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let pw = width, ph = height

    const setup = () => {
      pw = width; ph = height
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    setup()

    let raf
    const draw = () => {
      const cfg = configRef.current
      if (!cfg) { raf = requestAnimationFrame(draw); return }

      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, pw, ph)

      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, ph / 2)
      ctx.lineTo(pw, ph / 2)
      ctx.stroke()

      const shape = getWaveformShape(cfg, 120)
      if (!shape.length) { raf = requestAnimationFrame(draw); ctx.restore(); return }

      const minVal = cfg.min ?? 0
      const maxVal = cfg.max ?? 1
      const range = maxVal - minVal || 1
      const pad = 4

      ctx.strokeStyle = '#4fc3f7'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < shape.length; i++) {
        const x = shape[i].x * pw
        const yNorm = range > 0 ? (shape[i].value - minVal) / range : 0.5
        const y = pad + (ph - pad * 2) * (1 - yNorm)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      ctx.fillStyle = 'rgba(79, 195, 247, 0.08)'
      ctx.beginPath()
      for (let i = 0; i < shape.length; i++) {
        const x = shape[i].x * pw
        const yNorm = range > 0 ? (shape[i].value - minVal) / range : 0.5
        const y = pad + (ph - pad * 2) * (1 - yNorm)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.lineTo(pw, ph - pad)
      ctx.lineTo(0, ph - pad)
      ctx.closePath()
      ctx.fill()

      const spd = cfg.speed || 0
      const rawPhase = ((globalTimeRef.current * spd) + (cfg.phaseOffset || 0)) % 1
      const phase = rawPhase < 0 ? rawPhase + 1 : rawPhase
      const dotX = phase * pw
      const currentValue = getLfoValue(globalTimeRef.current, cfg, 'preview_dot')
      const yNorm = range > 0 ? (currentValue - minVal) / range : 0.5
      const dotY = pad + (ph - pad * 2) * (1 - Math.max(0, Math.min(1, yNorm)))

      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(dotX, dotY, 5, 0, Math.PI * 2)
      ctx.stroke()

      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = '8px monospace'
      ctx.textAlign = dotX > pw / 2 ? 'right' : 'left'
      const labelX = dotX > pw / 2 ? dotX - 8 : dotX + 8
      ctx.fillText(currentValue.toFixed(1), labelX, dotY - 8)

      ctx.restore()
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(raf)
  }, [width, height])

  return <canvas ref={canvasRef} className="waveform-preview" style={{ width, height }} />
}

export default memo(WaveformPreview)
