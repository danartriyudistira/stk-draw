import Slider from './Slider.jsx'
import { parseIsfHeader, getDefaultForInput } from '../engine/IsfParser.js'

export default function ShaderParamPanel({ layer, onChange, error }) {
  if (!layer || layer.type !== 'shader') return null

  const header = parseIsfHeader(layer.code)
  const inputs = header?.INPUTS
  const isfParams = layer.isfParams || {}

  function updateParam(name, value) {
    onChange((l) => ({
      ...l,
      isfParams: { ...(l.isfParams || {}), [name]: value },
    }))
  }

  return (
    <div className="panel-section">
      <div className="panel-section-label">Shader Params</div>
      {error && (
        <div className="shader-param-error">
          <span className="shader-param-error-title">Compile Error</span>
          <pre className="shader-param-error-body">{error}</pre>
        </div>
      )}
      {inputs && inputs.length > 0 && inputs.map((input) => renderInput(input, isfParams, updateParam))}
      {(!inputs || !inputs.length) && !error && (
        <span style={{ fontSize: 10, color: '#666' }}>No ISF inputs found</span>
      )}
    </div>
  )
}

function renderInput(input, isfParams, updateParam) {
  const name = input.NAME
  const current = isfParams[name]
  const def = getDefaultForInput(input)

  switch (input.TYPE) {
    case 'float':
      return (
        <div className="shader-param-row" key={name}>
          <label className="shader-param-label" title={name}>{name}</label>
          <Slider
            value={current != null ? current : def}
            min={input.MIN ?? 0}
            max={input.MAX ?? 1}
            step={(input.MAX ?? 1) - (input.MIN ?? 0) > 10 ? 0.01 : 0.001}
            defaultValue={def}
            onChange={(v) => updateParam(name, v)}
          />
        </div>
      )

    case 'point2D': {
      const cx = current != null ? current[0] : (def[0] ?? 0)
      const cy = current != null ? current[1] : (def[1] ?? 0)
      return (
        <div className="shader-param-group" key={name}>
          <label className="shader-param-label" title={name}>{name}</label>
          <div className="shader-param-row">
            <span className="shader-param-ch-label">X</span>
            <Slider value={cx} min={input.MIN?.[0] ?? 0} max={input.MAX?.[0] ?? 1} step={0.001}
              defaultValue={def[0] ?? 0} onChange={(v) => updateParam(name, [v, cy])} />
          </div>
          <div className="shader-param-row">
            <span className="shader-param-ch-label">Y</span>
            <Slider value={cy} min={input.MIN?.[1] ?? 0} max={input.MAX?.[1] ?? 1} step={0.001}
              defaultValue={def[1] ?? 0} onChange={(v) => updateParam(name, [cx, v])} />
          </div>
        </div>
      )
    }

    case 'color': {
      const cr = current != null ? current[0] : (def[0] ?? 1)
      const cg = current != null ? current[1] : (def[1] ?? 1)
      const cb = current != null ? current[2] : (def[2] ?? 1)
      const ca = current != null ? current[3] : (def[3] ?? 1)
      const hex = rgbaToHex(cr, cg, cb)
      return (
        <div className="shader-param-group" key={name}>
          <label className="shader-param-label" title={name}>
            {name}
            <span className="shader-param-color-swatch" style={{ background: `rgba(${Math.round(cr*255)},${Math.round(cg*255)},${Math.round(cb*255)},${ca})` }} />
          </label>
          <div className="shader-param-row">
            <span className="shader-param-ch-label">R</span>
            <Slider value={cr} min={0} max={1} step={0.01} defaultValue={def[0] ?? 1}
              onChange={(v) => updateParam(name, [v, cg, cb, ca])} />
          </div>
          <div className="shader-param-row">
            <span className="shader-param-ch-label">G</span>
            <Slider value={cg} min={0} max={1} step={0.01} defaultValue={def[1] ?? 1}
              onChange={(v) => updateParam(name, [cr, v, cb, ca])} />
          </div>
          <div className="shader-param-row">
            <span className="shader-param-ch-label">B</span>
            <Slider value={cb} min={0} max={1} step={0.01} defaultValue={def[2] ?? 1}
              onChange={(v) => updateParam(name, [cr, cg, v, ca])} />
          </div>
          <div className="shader-param-row">
            <span className="shader-param-ch-label">A</span>
            <Slider value={ca} min={0} max={1} step={0.01} defaultValue={def[3] ?? 1}
              onChange={(v) => updateParam(name, [cr, cg, cb, v])} />
          </div>
          <div className="shader-param-row">
            <span className="shader-param-ch-label"></span>
            <input type="color" className="shader-param-color-input" value={hex}
              onChange={(e) => {
                const { r, g, b } = hexToRgb(e.target.value)
                updateParam(name, [r / 255, g / 255, b / 255, ca])
              }} />
          </div>
        </div>
      )
    }

    case 'bool':
      return (
        <div className="shader-param-row" key={name}>
          <label className="shader-param-label" title={name}>{name}</label>
          <div className="shader-param-bool-row">
            <input type="checkbox" className="shader-param-check"
              checked={current != null ? current : def ? 1 : 0}
              onChange={(e) => updateParam(name, e.target.checked ? 1 : 0)} />
            <span className="shader-param-bool-label">
              {current != null ? current : def ? 'On' : 'Off'}
            </span>
          </div>
        </div>
      )

    case 'long': {
      const cv = current != null ? Math.round(current) : Math.round(def)
      if (input.VALUES?.length > 0) {
        return (
          <div className="shader-param-row" key={name}>
            <label className="shader-param-label" title={name}>{name}</label>
            <select className="shader-param-select" value={cv}
              onChange={(e) => updateParam(name, parseInt(e.target.value))}>
              {input.VALUES.map((v, i) => (
                <option key={v} value={v}>{input.LABELS?.[i] ?? v}</option>
              ))}
            </select>
          </div>
        )
      }
      return (
        <div className="shader-param-row" key={name}>
          <label className="shader-param-label" title={name}>{name}</label>
          <Slider value={cv} min={input.MIN ?? 0} max={input.MAX ?? 10} step={1}
            defaultValue={def} onChange={(v) => updateParam(name, v)} />
        </div>
      )
    }

    default:
      return null
  }
}

function rgbaToHex(r, g, b) {
  const toHex = (v) => {
    const h = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16)
    return h.length === 1 ? '0' + h : h
  }
  return '#' + toHex(r) + toHex(g) + toHex(b)
}

function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!m) return { r: 255, g: 255, b: 255 }
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}
