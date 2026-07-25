import Slider from './Slider.jsx'
import WaveformPreview from './WaveformPreview.jsx'
import { getEasingNames } from '../engine/EasingLib.js'

const WAVEFORMS = [
  { value: 'sine', label: 'Sine' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'saw', label: 'Saw' },
  { value: 'square', label: 'Square' },
  { value: 'random', label: 'Random S&H' },
  { value: 'none', label: 'None' },
]

export default function LfoStrip({ label, config, onConfigChange, disabled }) {
  const easingNames = getEasingNames()
  const lfo = config?.lfo

  function updateLfo(field, value) {
    onConfigChange({ ...config, lfo: { ...lfo, [field]: value } })
  }

  const isNone = lfo?.waveform === 'none'
  const sliderMin = config.minSliderMin ?? 0
  const sliderMax = config.maxSliderMax ?? 100

  return (
    <div className="lfo-strip" style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
      <div className="lfo-strip-header">
        <span>{label.toUpperCase()}</span>
        {disabled && <span style={{ fontSize: 9, color: '#4fc3f7', marginLeft: 4 }}>locked</span>}
      </div>
      <div className="lfo-strip-controls">
        <div className="lfo-row">
          <span className="lfo-label">Wave</span>
          <select
            className="lfo-select"
            value={lfo?.waveform || 'none'}
            onChange={(e) => updateLfo('waveform', e.target.value)}
            disabled={disabled}
          >
            {WAVEFORMS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>

        {isNone ? (
          <div className="lfo-row">
            <span className="lfo-label">Value</span>
              <Slider
                value={lfo?.min ?? 0}
                min={sliderMin}
                max={sliderMax}
                step={1}
                defaultValue={0}
                onChange={(v) => updateLfo('min', v)}
                disabled={disabled}
              />
          </div>
        ) : (
          <>
            <div className="lfo-row">
              <span className="lfo-label">Ease</span>
              <select
                className="lfo-select"
                value={lfo?.easing || 'linear'}
                onChange={(e) => updateLfo('easing', e.target.value)}
                disabled={disabled}
              >
                {easingNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="lfo-row">
              <span className="lfo-label">Speed</span>
              <Slider
                value={lfo?.speed ?? 0}
                min={-2}
                max={2}
                step={0.01}
                defaultValue={0}
                onChange={(v) => updateLfo('speed', v)}
                disabled={disabled}
              />
            </div>
            <div className="lfo-row">
              <span className="lfo-label">Min</span>
              <Slider
                value={lfo?.min ?? 0}
                min={sliderMin}
                max={config.maxSliderMax ?? 100}
                step={1}
                defaultValue={0}
                onChange={(v) => updateLfo('min', Math.min(v, (lfo?.max ?? 100) - 0.01))}
                disabled={disabled}
              />
            </div>
            <div className="lfo-row">
              <span className="lfo-label">Max</span>
              <Slider
                value={lfo?.max ?? 1}
                min={sliderMin}
                max={config.maxSliderMax ?? 500}
                step={1}
                defaultValue={1}
                onChange={(v) => updateLfo('max', Math.max(v, (lfo?.min ?? 0) + 0.01))}
                disabled={disabled}
              />
            </div>
            <div className="lfo-phase-source">
              <label>
                <input
                  type="radio"
                  name={`phase_${label}`}
                  checked={lfo?.phaseSource === 'time'}
                  onChange={() => updateLfo('phaseSource', 'time')}
                  disabled={disabled}
                />
                Time
              </label>
              <label>
                <input
                  type="radio"
                  name={`phase_${label}`}
                  checked={lfo?.phaseSource === 'distance'}
                  onChange={() => updateLfo('phaseSource', 'distance')}
                  disabled={disabled}
                />
                Dist
              </label>
            </div>
            {lfo && <WaveformPreview config={lfo} />}
          </>
        )}
      </div>
    </div>
  )
}
