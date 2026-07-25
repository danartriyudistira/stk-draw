import { useState, useEffect, useRef } from 'react'
import LfoStrip from './LfoStrip.jsx'
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

function computeCurrentColor(pen) {
  const t = globalTimeRef.current
  const hCfg = pen.hue?.lfo
  const sCfg = pen.saturation?.lfo
  const lCfg = pen.lightness?.lfo
  const h = hCfg && hCfg.waveform !== 'none'
    ? getLfoValue(t, hCfg, 'col_h')
    : (pen.hue?.lfo?.min ?? 200)
  const s = sCfg && sCfg.waveform !== 'none'
    ? getLfoValue(t, sCfg, 'col_s')
    : (pen.saturation?.lfo?.min ?? 70)
  const lVal = lCfg && lCfg.waveform !== 'none'
    ? getLfoValue(t, lCfg, 'col_l')
    : (pen.lightness?.lfo?.min ?? 50)
  return {
    h: Math.round(h) % 360,
    s: Math.max(0, Math.min(100, Math.round(s))),
    l: Math.max(0, Math.min(100, Math.round(lVal))),
  }
}

function computeCurrentThickness(pen) {
  const t = globalTimeRef.current
  const cfg = pen.thickness?.lfo
  const val = cfg && cfg.waveform !== 'none'
    ? getLfoValue(t, cfg, 'prev_th')
    : (pen.thickness?.lfo?.min ?? 4)
  return isNaN(val) ? 4 : Math.max(1, Math.min(200, val))
}

export default function PenLfoPanel({ layer, onChange }) {
  const [color, setColor] = useState({ h: 200, s: 70, l: 50 })
  const [thickness, setThickness] = useState(4)
  const rafRef = useRef(null)

  useEffect(() => {
    let active = true
    const tick = () => {
      if (!active) return
      const pen = layer?.penLFOs || {}
      setColor(computeCurrentColor(pen))
      setThickness(computeCurrentThickness(pen))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      active = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [layer])

  if (!layer) return null

  if (layer.type === 'image') {
    return (
      <div className="panel-section">
        <div className="panel-section-label">Pen LFO</div>
        <div style={{ fontSize: 10, color: '#555', padding: '8px 0', textAlign: 'center' }}>
          Pen LFO not available for image layers
        </div>
      </div>
    )
  }

  if (layer.type === 'group') {
    return (
      <div className="panel-section">
        <div className="panel-section-label">Pen LFO</div>
        <div style={{ fontSize: 10, color: '#555', padding: '8px 0', textAlign: 'center' }}>
          Pen LFO not available for groups
        </div>
      </div>
    )
  }

  const pen = layer.penLFOs || {}
  const hex = hslToHex(color.h, color.s, color.l)

  function updateThickness(newConfig) {
    onChange((l) => ({ ...l, penLFOs: { ...l.penLFOs, thickness: newConfig } }))
  }

  function updateHue(newConfig) {
    onChange((l) => ({ ...l, penLFOs: { ...l.penLFOs, hue: newConfig } }))
  }

  function updateSaturation(newConfig) {
    onChange((l) => ({ ...l, penLFOs: { ...l.penLFOs, saturation: newConfig } }))
  }

  function updateLightness(newConfig) {
    onChange((l) => ({ ...l, penLFOs: { ...l.penLFOs, lightness: newConfig } }))
  }

  return (
    <div className="panel-section">
      <div className="panel-section-label">Pen LFO</div>
      <LfoStrip
        label="thickness"
        config={{ ...pen.thickness, minSliderMin: 0, maxSliderMax: 200 }}
        onConfigChange={updateThickness}
      />
      <LfoStrip
        label="hue"
        config={{ ...pen.hue, minSliderMin: 0, maxSliderMax: 360 }}
        onConfigChange={updateHue}
      />
      <LfoStrip
        label="saturation"
        config={{ ...pen.saturation, minSliderMin: 0, maxSliderMax: 100 }}
        onConfigChange={updateSaturation}
      />
      <LfoStrip
        label="lightness"
        config={{ ...pen.lightness, minSliderMin: 0, maxSliderMax: 100 }}
        onConfigChange={updateLightness}
      />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
        marginTop: 2,
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          height: 28,
        }}>
          <div style={{
            width: '100%',
            height: Math.max(2, Math.min(28, thickness)),
            borderRadius: 3,
            background: `hsl(${color.h},${color.s}%,${color.l}%)`,
            transition: 'height 0.05s linear',
          }} />
        </div>
        <span style={{
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#888',
          minWidth: 36,
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {thickness.toFixed(1)}
        </span>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
        marginTop: 0,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          border: '1px solid #444',
          background: `hsl(${color.h},${color.s}%,${color.l}%)`,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#ccc',
        }}>
          {hex}
        </span>
      </div>
    </div>
  )
}
