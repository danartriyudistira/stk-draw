import LfoStrip from './LfoStrip.jsx'
import Slider from './Slider.jsx'

const TRANSFORM_KEYS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

const KEY_CONFIG = {
  x:        { label: 'X',     baseMin: -500, baseMax: 500, baseStep: 1,    sliderMinMin: -500, sliderMaxMax: 500 },
  y:        { label: 'Y',     baseMin: -500, baseMax: 500, baseStep: 1,    sliderMinMin: -500, sliderMaxMax: 500 },
  rotation: { label: 'Rot',   baseMin: -360, baseMax: 360, baseStep: 1,    sliderMinMin: -360, sliderMaxMax: 360 },
  scaleX:   { label: 'SclX',  baseMin: 0,    baseMax: 5,   baseStep: 0.01, sliderMinMin: -2,  sliderMaxMax: 5 },
  scaleY:   { label: 'SclY',  baseMin: 0,    baseMax: 5,   baseStep: 0.01, sliderMinMin: -2,  sliderMaxMax: 5 },
  opacity:  { label: 'Op',    baseMin: 0,    baseMax: 1,   baseStep: 0.01, sliderMinMin: 0,   sliderMaxMax: 1 },
}

export default function TransformLfoPanel({ layer, onChange, setOriginMode, onSetOriginMode, onCancelSetOrigin, globalTime = 0 }) {
  if (!layer) return null

  function updateTransform(key, newLfoConfig) {
    onChange((l) => ({
      ...l,
      transform: {
        ...l.transform,
        [key]: { ...l.transform[key], lfo: newLfoConfig.enabled ? newLfoConfig.lfo : null },
      },
    }))
  }

  function handleBaseChange(key, value) {
    onChange((l) => {
      const t = JSON.parse(JSON.stringify(l.transform))
      t[key] = { ...t[key], base: value }
      return { ...l, transform: t }
    })
  }

  function handleScaleYLink(linked) {
    onChange((l) => {
      const t = JSON.parse(JSON.stringify(l.transform))
      t.scaleY = { ...t.scaleY, linkToScaleX: linked }
      if (linked) {
        t.scaleY.base = t.scaleX.base
        t.scaleY.lfo = t.scaleX.lfo ? JSON.parse(JSON.stringify(t.scaleX.lfo)) : null
      }
      return { ...l, transform: t }
    })
  }

  return (
    <div className="panel-section">
      <div className="panel-section-label">Transform LFO</div>

      {TRANSFORM_KEYS.map((key) => {
        const t = layer.transform[key]
        const kc = KEY_CONFIG[key]

        return (
          <div key={key} className="transform-row">
            <span className="tr-label">{kc.label}</span>
            <Slider
              value={t.base}
              min={kc.baseMin}
              max={kc.baseMax}
              step={kc.baseStep}
              onChange={(v) => handleBaseChange(key, v)}
            />
            {key === 'scaleY' && (
              <label style={{ fontSize: 9, color: '#666', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', marginRight: 4 }}>
                <input
                  type="checkbox"
                  checked={t.linkToScaleX || false}
                  onChange={(e) => handleScaleYLink(e.target.checked)}
                  style={{ margin: 0 }}
                />
                link
              </label>
            )}
            <span className="tr-value">
              {key === 'scaleX' || key === 'scaleY' || key === 'opacity'
                ? t.base.toFixed(2)
                : t.base.toFixed(1)}
            </span>
          </div>
        )
      })}

      {TRANSFORM_KEYS.map((key) => {
        const t = layer.transform[key]
        const kc = KEY_CONFIG[key]
        return (
          <LfoStrip
            key={`lfo-${key}`}
            label={key}
            config={{
              enabled: !!t.lfo,
              lfo: t.lfo,
              minSliderMin: kc.sliderMinMin,
              maxSliderMax: kc.sliderMaxMax,
            }}
            onConfigChange={(newConfig) => updateTransform(key, newConfig)}
            globalTime={globalTime}
          />
        )
      })}

      <div className="origin-row">
        <label>Origin</label>
        <input
          type="number"
          value={layer.origin?.x ?? 0}
          onChange={(e) => {
            const x = parseFloat(e.target.value) || 0
            onChange((l) => ({ ...l, origin: { ...l.origin, x } }))
          }}
        />
        <input
          type="number"
          value={layer.origin?.y ?? 0}
          onChange={(e) => {
            const y = parseFloat(e.target.value) || 0
            onChange((l) => ({ ...l, origin: { ...l.origin, y } }))
          }}
        />
        <button
          className={`btn-set-origin${setOriginMode ? ' active' : ''}`}
          onClick={() => setOriginMode ? onCancelSetOrigin() : onSetOriginMode()}
        >
          {setOriginMode ? 'Cancel' : 'Set Origin'}
        </button>
      </div>
    </div>
  )
}
