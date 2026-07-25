import { useState } from 'react'

export default function LayerItem({
  layer,
  isActive,
  depth,
  layers,
  onSelect,
  onRename,
  onToggleVisible,
  onToggleLocked,
  onToggleExpand,
  onReparent,
  onContextLayer,
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(layer.name)

  function commitRename() {
    setEditing(false)
    if (name.trim()) onRename(layer.id, name.trim())
    else setName(layer.name)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') { setEditing(false); setName(layer.name) }
  }

  const isGroup = layer.type === 'group'
  const isChild = !!layer.parentId
  const isLinked = !!layer.linkParentId
  const linkParent = isLinked ? (layers || []).find((l) => l.id === layer.linkParentId) : null
  const indentLeft = depth * 14

  return (
    <div
      className={`layer-item${isActive ? ' active' : ''}${isGroup ? ' group' : ''}`}
      onClick={() => onSelect(layer.id)}
      onContextMenu={(e) => { e.preventDefault(); onContextLayer?.(e, layer.id) }}
    >
      {isGroup && (
        <span
          className="layer-item-expand"
          onClick={(e) => { e.stopPropagation(); onToggleExpand?.(layer.id) }}
        >
          {layer.childrenExpanded !== false ? '▼' : '▶'}
        </span>
      )}

      <div className="layer-radio" style={{ marginLeft: isGroup ? 0 : 12 }} />

      {editing ? (
        <input
          className="td-slider-input"
          style={{ flex: 1, minWidth: 0, padding: '1px 3px', fontSize: 10 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="layer-name"
          style={{ paddingLeft: indentLeft }}
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
        >
          {layer.name}
          {isLinked && linkParent && (
            <span className="layer-link-indicator" title={`Linked to: ${linkParent.name}`}>
              →{linkParent.name}
            </span>
          )}
          {isGroup && <span className="layer-badge group-badge">G</span>}
          {layer.type === 'image' && <span className="layer-badge img-badge">IMG</span>}
          {layer.type === 'kinetic' && <span className="layer-badge kinetic-badge">K</span>}
        </span>
      )}

      <div className="layer-btns">
        {isChild && (
          <button
            title="Move out of group"
            onClick={(e) => { e.stopPropagation(); onReparent?.(layer.id, null) }}
            style={{ fontSize: 9 }}
          >
            ⇱
          </button>
        )}
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
