import Slider from './Slider.jsx'
import WaveformPreview from './WaveformPreview.jsx'
import { getEasingNames } from '../engine/EasingLib.js'

const WAVEFORMS = [
  { value: 'sine', label: 'Sine' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'saw', label: 'Saw' },
  { value: 'square', label: 'Square' },
  { value: 'random', label: 'Random S&H' },
]

export default function LfoStrip({ label, config, onConfigChange, disabled, globalTime = 0 }) {
  const easingNames = getEasingNames()
  const lfo = config?.lfo
  const enabled = config?.enabled || false

  function setEnabled(v) {
    if (disabled) return
    onConfigChange({ ...config, enabled: v, lfo: v ? (lfo || defaultLfo()) : lfo })
  }

  function updateLfo(field, value) {
    if (!lfo) return
    onConfigChange({ ...config, lfo: { ...lfo, [field]: value } })
  }

  function defaultLfo() {
    return { waveform: 'sine', easing: 'linear', speed: 1, min: 0, max: 1, phaseSource: 'time', phaseOffset: 0 }
  }

  if (!enabled) {
    return (
      <div className="lfo-strip disabled">
        <div className="lfo-strip-header">
          <label>
            <input type="checkbox" checked={false} onChange={(e) => setEnabled(e.target.checked)} disabled={disabled} />
            {label.toUpperCase()}
          </label>
        </div>
      </div>
    )
  }

  return (
    <div className="lfo-strip">
      <div className="lfo-strip-header">
        <label>
          <input type="checkbox" checked={true} onChange={(e) => setEnabled(e.target.checked)} disabled={disabled} />
          {label.toUpperCase()}
        </label>
      </div>
      <div className="lfo-strip-controls">
        <div className="lfo-row">
          <span className="lfo-label">Wave</span>
          <select
            className="lfo-select"
            value={lfo?.waveform || 'sine'}
            onChange={(e) => updateLfo('waveform', e.target.value)}
          >
            {WAVEFORMS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
        <div className="lfo-row">
          <span className="lfo-label">Ease</span>
          <select
            className="lfo-select"
            value={lfo?.easing || 'linear'}
            onChange={(e) => updateLfo('easing', e.target.value)}
          >
            {easingNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="lfo-row">
          <span className="lfo-label">Speed</span>
          <Slider
            value={lfo?.speed ?? 1}
            min={0.01}
            max={20}
            step={0.01}
            onChange={(v) => updateLfo('speed', v)}
          />
        </div>
        <div className="lfo-row">
          <span className="lfo-label">Min</span>
          <Slider
            value={lfo?.min ?? 0}
            min={config.minSliderMin ?? 0}
            max={config.maxSliderMin ?? (lfo?.max ?? 100)}
            step={1}
            onChange={(v) => updateLfo('min', Math.min(v, (lfo?.max ?? 100) - 0.01))}
          />
        </div>
        <div className="lfo-row">
          <span className="lfo-label">Max</span>
          <Slider
            value={lfo?.max ?? 1}
            min={lfo?.min ?? 0}
            max={config.maxSliderMax ?? 500}
            step={1}
            onChange={(v) => updateLfo('max', Math.max(v, (lfo?.min ?? 0) + 0.01))}
          />
        </div>
        <div className="lfo-phase-source">
          <label>
            <input
              type="radio"
              name={`phase_${label}`}
              checked={lfo?.phaseSource === 'time'}
              onChange={() => updateLfo('phaseSource', 'time')}
            />
            Time
          </label>
          <label>
            <input
              type="radio"
              name={`phase_${label}`}
              checked={lfo?.phaseSource === 'distance'}
              onChange={() => updateLfo('phaseSource', 'distance')}
            />
            Distance
          </label>
        </div>
        {lfo && <WaveformPreview config={lfo} globalTime={globalTime} />}
      </div>
    </div>
  )
}
