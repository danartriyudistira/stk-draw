import { useRef, useEffect } from 'react'
import { getLfoValue, getWaveformShape } from '../engine/LfoEngine.js'

export default function WaveformPreview({ config, globalTime = 0, width = 200, height = 36 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !config) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    const shape = getWaveformShape(config, 120)
    if (!shape.length) return

    const minVal = config.min ?? 0
    const maxVal = config.max ?? 1
    const range = maxVal - minVal || 1
    const pad = 4

    ctx.strokeStyle = '#4fc3f7'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < shape.length; i++) {
      const x = shape[i].x * width
      const yNorm = range > 0 ? (shape[i].value - minVal) / range : 0.5
      const y = pad + (height - pad * 2) * (1 - yNorm)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    ctx.fillStyle = 'rgba(79, 195, 247, 0.08)'
    ctx.beginPath()
    for (let i = 0; i < shape.length; i++) {
      const x = shape[i].x * width
      const yNorm = range > 0 ? (shape[i].value - minVal) / range : 0.5
      const y = pad + (height - pad * 2) * (1 - yNorm)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.lineTo(width, height - pad)
    ctx.lineTo(0, height - pad)
    ctx.closePath()
    ctx.fill()

    const phase = ((globalTime * (config.speed || 1)) + (config.phaseOffset || 0)) % 1
    const dotX = phase * width
    const currentValue = getLfoValue(globalTime, config, 'preview_dot')
    const yNorm = range > 0 ? (currentValue - minVal) / range : 0.5
    const dotY = pad + (height - pad * 2) * (1 - Math.max(0, Math.min(1, yNorm)))

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
    ctx.textAlign = dotX > width / 2 ? 'right' : 'left'
    const labelX = dotX > width / 2 ? dotX - 8 : dotX + 8
    const label = currentValue.toFixed(1)
    ctx.fillText(label, labelX, dotY - 8)
  }, [config, width, height, globalTime])

  return <canvas ref={canvasRef} className="waveform-preview" style={{ width, height }} />
}
