import { useState } from 'react'

export default function LayerItem({
  layer,
  isActive,
  onSelect,
  onRename,
  onToggleVisible,
  onToggleLocked,
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(layer.name)

  function commitRename() {
    setEditing(false)
    if (name.trim()) onRename(layer.id, name.trim())
    else setName(layer.name)
  }

  return (
    <div
      className={`layer-item${isActive ? ' active' : ''}`}
      onClick={() => onSelect(layer.id)}
    >
      <div className="layer-radio" />
      {editing ? (
        <input
          className="td-slider-input"
          style={{ flex: 1, minWidth: 0, padding: '1px 3px', fontSize: 10 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') { setEditing(false); setName(layer.name) }
          }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="layer-name"
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
        >
          {layer.name}
          {layer.type === 'image' && <span style={{ color: '#4fc3f7', marginLeft: 3, fontSize: 9 }}>IMG</span>}
        </span>
      )}
      <div className="layer-btns">
        <button
          className={layer.visible ? '' : 'off'}
          title={layer.visible ? 'Hide' : 'Show'}
          onClick={(e) => { e.stopPropagation(); onToggleVisible(layer.id) }}
        >
          {layer.visible ? '◉' : '○'}
        </button>
        <button
          className={layer.locked ? '' : 'off'}
          title={layer.locked ? 'Unlock' : 'Lock'}
          onClick={(e) => { e.stopPropagation(); onToggleLocked(layer.id) }}
        >
          {layer.locked ? '🔒' : '🔓'}
        </button>
      </div>
    </div>
  )
}
