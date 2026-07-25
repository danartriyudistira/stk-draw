import { useState, useEffect, useRef } from 'react'
import LfoStrip from './LfoStrip.jsx'
import Slider from './Slider.jsx'
import { getLfoValue } from '../engine/LfoEngine.js'
import { globalTimeRef } from '../App.jsx'

function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    return Math.round((l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)) * 255)
  }
  const r = f(0).toString(16).padStart(2, '0')
  const g = f(8).toString(16).padStart(2, '0')
  const b = f(4).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

function computeKineticColor(pen) {
  const t = globalTimeRef.current
  const hCfg = pen?.hue?.lfo
  const sCfg = pen?.saturation?.lfo
  const lCfg = pen?.lightness?.lfo
  const h = hCfg && hCfg.waveform !== 'none'
    ? getLfoValue(t, hCfg, 'kcol_h')
    : (pen?.hue?.lfo?.min ?? 200)
  const s = sCfg && sCfg.waveform !== 'none'
    ? getLfoValue(t, sCfg, 'kcol_s')
    : (pen?.saturation?.lfo?.min ?? 70)
  const lVal = lCfg && lCfg.waveform !== 'none'
    ? getLfoValue(t, lCfg, 'kcol_l')
    : (pen?.lightness?.lfo?.min ?? 50)
  return {
    h: Math.round(h) % 360,
    s: Math.max(0, Math.min(100, Math.round(s))),
    l: Math.max(0, Math.min(100, Math.round(lVal))),
  }
}

export default function KineticPanel({ layer, onChange }) {
  const [color, setColor] = useState({ h: 200, s: 70, l: 50 })
  const rafRef = useRef(null)

  useEffect(() => {
    let active = true
    const tick = () => {
      if (!active) return
      const pen = layer?.penLFOs
      setColor(computeKineticColor(pen))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      active = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [layer])

  if (!layer) return null

  const pen = layer.penLFOs || {}
  const hex = hslToHex(color.h, color.s, color.l)

  function updateHue(newConfig) {
    onChange((l) => ({ ...l, penLFOs: { ...l.penLFOs, hue: newConfig } }))
  }

  function updateSat(newConfig) {
    onChange((l) => ({ ...l, penLFOs: { ...l.penLFOs, saturation: newConfig } }))
  }

  function updateLit(newConfig) {
    onChange((l) => ({ ...l, penLFOs: { ...l.penLFOs, lightness: newConfig } }))
  }

  function setThickness(v) {
    onChange((l) => ({ ...l, thickness: v }))
  }

  function setDrawRate(v) {
    onChange((l) => ({ ...l, drawRate: v }))
  }

  function setMaxVelocity(v) {
    onChange((l) => ({ ...l, maxVelocity: v }))
  }

  function setParticleChance(v) {
    onChange((l) => ({ ...l, particleChance: v }))
  }

  return (
    <div className="panel-section">
      <div className="panel-section-label">Kinetic Color</div>

      <LfoStrip
        label="hue"
        config={{ ...pen.hue, minSliderMin: 0, maxSliderMax: 360 }}
        onConfigChange={updateHue}
      />
      <LfoStrip
        label="saturation"
        config={{ ...pen.saturation, minSliderMin: 0, maxSliderMax: 100 }}
        onConfigChange={updateSat}
      />
      <LfoStrip
        label="lightness"
        config={{ ...pen.lightness, minSliderMin: 0, maxSliderMax: 100 }}
        onConfigChange={updateLit}
      />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 0', marginTop: 2,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 4,
          border: '1px solid #444',
          background: `hsl(${color.h},${color.s}%,${color.l}%)`,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 11, fontFamily: 'monospace', color: '#ccc',
        }}>
          {hex}
        </span>
      </div>

      <div className="panel-section-label" style={{ marginTop: 8 }}>Kinetic</div>

      <Slider
        label="thickness"
        value={layer.thickness ?? 12}
        min={2}
        max={60}
        onChange={setThickness}
      />

      <Slider
        label="draw speed"
        value={layer.drawRate ?? 120}
        min={10}
        max={500}
        step={5}
        onChange={setDrawRate}
      />

      <Slider
        label="energy"
        value={layer.maxVelocity ?? 120}
        min={10}
        max={400}
        step={5}
        onChange={setMaxVelocity}
      />

      <Slider
        label="particles"
        value={layer.particleChance ?? 0.05}
        min={0}
        max={0.5}
        step={0.01}
        onChange={setParticleChance}
      />

      <div style={{ fontSize: 10, color: '#555', padding: '6px 0 0', textAlign: 'center' }}>
        paths: {layer.paths?.length || 0}
      </div>
    </div>
  )
}
