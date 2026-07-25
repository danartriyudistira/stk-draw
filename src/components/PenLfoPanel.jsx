import LfoStrip from './LfoStrip.jsx'

export default function PenLfoPanel({ layer, onChange }) {
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

  const pen = layer.penLFOs || {}

  function updateThickness(newConfig) {
    onChange((l) => ({ ...l, penLFOs: { ...l.penLFOs, thickness: newConfig } }))
  }

  function updateHue(newConfig) {
    onChange((l) => ({ ...l, penLFOs: { ...l.penLFOs, hue: newConfig } }))
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
    </div>
  )
}
