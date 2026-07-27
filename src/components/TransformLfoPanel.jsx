import LfoStrip from './LfoStrip.jsx'

const BLEND_MODES = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'lighter', label: 'Add' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
]

const TRANSFORM_KEYS = ['x', 'y', 'rotation', 'opacity']

const KEY_CONFIG = {
  x:        { label: 'X',     sliderMinMin: -500, sliderMaxMax: 500 },
  y:        { label: 'Y',     sliderMinMin: -500, sliderMaxMax: 500 },
  rotation: { label: 'Rot',   sliderMinMin: -360, sliderMaxMax: 360 },
  scaleX:   { label: 'SclX',  sliderMinMin: -2,   sliderMaxMax: 5 },
  scaleY:   { label: 'SclY',  sliderMinMin: -2,   sliderMaxMax: 5 },
  opacity:  { label: 'Op',    sliderMinMin: 0,    sliderMaxMax: 1 },
}

export default function TransformLfoPanel({ layer, onChange, setOriginMode, onSetOriginMode, onCancelSetOrigin, target = 'placement', layers, onLinkParent }) {
  if (!layer) return null
  const tf = layer[target]
  if (!tf) return null

  function updateTransform(key, newLfoConfig) {
    onChange((l) => ({
      ...l,
      [target]: {
        ...l[target],
        [key]: { ...l[target][key], lfo: newLfoConfig.lfo },
      },
    }))
  }

  function handleScaleYLink(linked) {
    onChange((l) => {
      const t = JSON.parse(JSON.stringify(l[target]))
      t.scaleY = { ...t.scaleY, linkToScaleX: linked }
      if (linked) {
        t.scaleY.lfo = t.scaleX.lfo ? JSON.parse(JSON.stringify(t.scaleX.lfo)) : null
      }
      return { ...l, [target]: t }
    })
  }

  const linked = tf.scaleY?.linkToScaleX || false

  return (
    <div className="panel-section">
      <div className="panel-section-label">{target === 'transform' ? 'Transform LFO' : 'Placement LFO'}</div>

      <div className="transform-row">
        <span className="tr-label"></span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 10, cursor: 'pointer', fontSize: 10, color: '#888' }}>
          <input
            type="checkbox"
            checked={tf.flipH || false}
            onChange={(e) => {
              onChange((l) => {
                const t = JSON.parse(JSON.stringify(l[target]))
                t.flipH = e.target.checked
                return { ...l, [target]: t }
              })
            }}
            style={{ margin: 0, accentColor: '#4fc3f7' }}
          />
          Flip H
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10, color: '#888' }}>
          <input
            type="checkbox"
            checked={tf.flipV || false}
            onChange={(e) => {
              onChange((l) => {
                const t = JSON.parse(JSON.stringify(l[target]))
                t.flipV = e.target.checked
                return { ...l, [target]: t }
              })
            }}
            style={{ margin: 0, accentColor: '#4fc3f7' }}
          />
          Flip V
        </label>
      </div>

      {TRANSFORM_KEYS.map((key) => {
        const t = tf[key]
        const kc = KEY_CONFIG[key]
        return (
          <LfoStrip
            key={`lfo-${key}`}
            label={key}
            config={{
              lfo: t.lfo,
              minSliderMin: kc.sliderMinMin,
              maxSliderMax: kc.sliderMaxMax,
            }}
            onConfigChange={(newConfig) => updateTransform(key, newConfig)}
          />
        )
      })}

      <LfoStrip
        label="scaleX"
        config={{
          lfo: tf.scaleX.lfo,
          minSliderMin: KEY_CONFIG.scaleX.sliderMinMin,
          maxSliderMax: KEY_CONFIG.scaleX.sliderMaxMax,
        }}
        onConfigChange={(newConfig) => updateTransform('scaleX', newConfig)}
      />

      <div className="transform-row" style={{ marginBottom: 4 }}>
        <span className="tr-label"></span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10, color: '#888' }}>
          <input
            type="checkbox"
            checked={linked}
            onChange={(e) => handleScaleYLink(e.target.checked)}
            style={{ margin: 0, accentColor: '#4fc3f7' }}
          />
          Lock SclY to SclX
        </label>
      </div>

      <LfoStrip
        label="scaleY"
        config={{
          lfo: tf.scaleY.lfo,
          minSliderMin: KEY_CONFIG.scaleY.sliderMinMin,
          maxSliderMax: KEY_CONFIG.scaleY.sliderMaxMax,
        }}
        onConfigChange={(newConfig) => updateTransform('scaleY', newConfig)}
        disabled={linked}
      />

      {layer.blendMode !== undefined && (
        <div className="origin-row" style={{ marginTop: 2, marginBottom: 4 }}>
          <label style={{ minWidth: 40 }}>Blend</label>
          <select
            className="lfo-select"
            style={{ flex: 1 }}
            value={layer.blendMode || 'source-over'}
            onChange={(e) => {
              onChange((l) => ({ ...l, blendMode: e.target.value }))
            }}
          >
            {BLEND_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {onLinkParent && layers && (
        <div className="origin-row" style={{ marginBottom: 6 }}>
          <label style={{ minWidth: 40 }}>Link To</label>
          <select
            className="lfo-select"
            style={{ flex: 1 }}
            value={layer.linkParentId || ''}
            onChange={(e) => onLinkParent(layer.id, e.target.value || null)}
          >
            <option value="">— none —</option>
            {layers
              .filter((l) => l.id !== layer.id)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.type === 'group' ? ' [G]' : ''}
                </option>
              ))}
          </select>
          {layer.linkParentId && (
            <button
              style={{ padding: '2px 6px', fontSize: 10, background: '#333', color: '#ccc', border: '1px solid #444', borderRadius: 3, cursor: 'pointer' }}
              onClick={() => onLinkParent(layer.id, null)}
            >
              ✕
            </button>
          )}
        </div>
      )}

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
