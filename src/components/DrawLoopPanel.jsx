import { useRef, useEffect } from 'react'
import Slider from './Slider.jsx'
import { buildContinuousTimeline } from '../engine/LoopDrawTimeline.js'

export default function DrawLoopPanel({ layer, onChange }) {
  if (!layer || !layer.strokes?.length) return null

  const rafRef = useRef(null)
  const startRef = useRef(0)
  const positionRef = useRef(null)

  const { totalDuration } = buildContinuousTimeline(layer.strokes || [])
  if (totalDuration <= 0) return null

  const enabled = layer.loopDrawEnabled || false
  const position = layer.loopDrawPosition || 0
  const mode = layer.loopDrawMode || 'loop'
  const hold = layer.loopDrawHold ?? 0

  positionRef.current = position

  const currentTime = position * totalDuration

  function setEnabled(v) {
    onChange((l) => ({
      ...l,
      loopDrawEnabled: v,
      loopDrawPosition: 0,
      loopDrawPlaying: false,
    }))
  }

  function setPosition(v) {
    onChange((l) => ({ ...l, loopDrawPosition: v }))
  }

  function setMode(v) {
    onChange((l) => ({ ...l, loopDrawMode: v }))
  }

  function setHold(v) {
    onChange((l) => ({ ...l, loopDrawHold: v }))
  }

  function computePosition(elapsed) {
    if (mode === 'pingpong') {
      const cycle = totalDuration * 2 + hold
      if (cycle <= 0) return 0
      const t = elapsed % cycle
      if (t <= totalDuration) return t / totalDuration
      if (t <= totalDuration + hold) return 1
      return 1 - (t - totalDuration - hold) / totalDuration
    }
    const cycle = totalDuration + hold
    if (cycle <= 0) return 0
    const t = elapsed % cycle
    return t >= totalDuration ? 1 : t / totalDuration
  }

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return
    }
    const now = performance.now() / 1000
    startRef.current = now - positionRef.current * totalDuration
    const tick = () => {
      const elapsed = performance.now() / 1000 - startRef.current
      onChange((l) => ({ ...l, loopDrawPosition: computePosition(elapsed) }))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [enabled, mode, totalDuration, hold, onChange])

  function handleSliderChange(v) {
    setPosition(v)
    startRef.current = performance.now() / 1000 - v * totalDuration
  }

  function handleToggleEnabled() {
    setEnabled(!enabled)
  }

  if (!enabled) {
    return (
      <div className="panel-section">
        <div className="panel-section-label">Loop Draw</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="loop-draw-enable-btn" onClick={handleToggleEnabled}>
            Enable Loop Draw
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel-section">
      <div className="panel-section-label">
        Loop Draw
        <button
          className="loop-draw-off-btn"
          onClick={handleToggleEnabled}
          title="Disable"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: 10 }}
        >
          ✕
        </button>
      </div>

      <div className="shader-param-row">
        <label className="shader-param-label">Time</label>
        <span style={{ flex: 1, fontSize: 10, color: '#aaa', fontFamily: 'monospace', textAlign: 'right', marginRight: 6 }}>
          {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
        </span>
      </div>

      <div className="shader-param-row">
        <label className="shader-param-label">Pos</label>
        <Slider
          value={position}
          min={0}
          max={1}
          step={0.001}
          defaultValue={0}
          onChange={handleSliderChange}
        />
      </div>

      <div className="loop-draw-mode-row">
        <label className="loop-draw-mode-label">Mode</label>
        <div className="loop-draw-mode-tabs">
          <button
            className={`loop-draw-mode-btn${mode === 'loop' ? ' active' : ''}`}
            onClick={() => setMode('loop')}
          >
            Loop
          </button>
          <button
            className={`loop-draw-mode-btn${mode === 'pingpong' ? ' active' : ''}`}
            onClick={() => setMode('pingpong')}
          >
            PingPong
          </button>
        </div>
      </div>

      <div className="shader-param-row" style={{ marginTop: 4 }}>
        <label className="shader-param-label">Hold</label>
        <Slider
          value={hold}
          min={0}
          max={5}
          step={0.1}
          defaultValue={0}
          onChange={setHold}
        />
        <span style={{ fontSize: 10, color: '#888', minWidth: 34, textAlign: 'right', fontFamily: 'monospace' }}>
          {hold.toFixed(1)}s
        </span>
      </div>
    </div>
  )
}
