import Slider from './Slider.jsx'

const ASPECT_OPTIONS = ['16:9', '4:3', '3:2', '1:1', 'free']

export default function FramePanel({ layer, onChange }) {
  if (!layer) return null

  const rect = layer.frameRect || { x: -800, y: -450, w: 1600, h: 900 }
  const ratio = layer.aspectRatio || '16:9'

  function setRectField(field, value) {
    onChange((l) => ({
      ...l,
      frameRect: { ...(l.frameRect || rect), [field]: value },
    }))
  }

  function setAspectRatio(ar) {
    onChange((l) => ({ ...l, aspectRatio: ar }))
  }

  return (
    <div className="panel-section">
      <div className="panel-section-label">Output Frame</div>

      <Slider
        label="X"
        value={rect.x}
        min={-2000}
        max={2000}
        step={1}
        onChange={(v) => setRectField('x', v)}
      />
      <Slider
        label="Y"
        value={rect.y}
        min={-2000}
        max={2000}
        step={1}
        onChange={(v) => setRectField('y', v)}
      />
      <Slider
        label="W"
        value={rect.w}
        min={100}
        max={4000}
        step={1}
        onChange={(v) => setRectField('w', v)}
      />
      <Slider
        label="H"
        value={rect.h}
        min={100}
        max={4000}
        step={1}
        onChange={(v) => setRectField('h', v)}
      />

      <div className="transform-row" style={{ marginTop: 4 }}>
        <span className="tr-label" style={{ fontSize: 10, color: '#888' }}>Aspect</span>
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {ASPECT_OPTIONS.map((ar) => (
            <button
              key={ar}
              onClick={() => setAspectRatio(ar)}
              style={{
                flex: 1, fontSize: 9, padding: '2px 0',
                background: ratio === ar ? '#4fc3f7' : '#333',
                color: ratio === ar ? '#111' : '#aaa',
                border: '1px solid #555',
                borderRadius: 2, cursor: 'pointer',
              }}
            >
              {ar}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
