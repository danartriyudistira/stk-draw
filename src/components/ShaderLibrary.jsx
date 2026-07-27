import { useState } from 'react'
import { SHADER_LIBRARY } from '../data/shaderLibrary.js'

export default function ShaderLibrary({ onApply, layers }) {
  const [activeCat, setActiveCat] = useState(SHADER_LIBRARY[0].id)

  const category = SHADER_LIBRARY.find((c) => c.id === activeCat)

  function handleApply(shader) {
    if (onApply) onApply(shader.code, shader.isfParams || {})
  }

  return (
    <div className="shader-library">
      <div className="shader-library-header">Library</div>

      <div className="shader-library-tabs">
        {SHADER_LIBRARY.map((cat) => (
          <button
            key={cat.id}
            className={`shader-library-tab${activeCat === cat.id ? ' active' : ''}`}
            onClick={() => setActiveCat(cat.id)}
            title={cat.label}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="shader-library-list">
        {category && category.shaders.map((shader, idx) => (
          <div key={idx} className="shader-library-item">
            <div className="shader-library-item-name">{shader.name}</div>
            <button
              className="shader-library-apply-btn"
              onClick={() => handleApply(shader)}
            >
              Apply
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
