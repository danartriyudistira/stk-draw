import { useRef, useEffect } from 'react'
import { getWaveformShape } from '../engine/LfoEngine.js'

export default function WaveformPreview({ config, width = 200, height = 36 }) {
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
  }, [config, width, height])

  return <canvas ref={canvasRef} className="waveform-preview" style={{ width, height }} />
}
