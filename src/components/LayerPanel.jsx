import { useRef } from 'react'
import LayerItem from './LayerItem.jsx'

export default function LayerPanel({
  layers,
  activeLayerId,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
  onRename,
  onToggleVisible,
  onToggleLocked,
  onReorder,
  onImportImage,
}) {
  const dragIdxRef = useRef(null)
  const fileRef = useRef(null)

  function handleDragStart(idx) {
    dragIdxRef.current = idx
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDrop(idx) {
    const from = dragIdxRef.current
    if (from != null && from !== idx && typeof onReorder === 'function') {
      onReorder(from, idx)
    }
    dragIdxRef.current = null
  }

  return (
    <div className="left-panel">
      <div className="left-panel-header">
        <span>LAYERS</span>
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={onAdd} title="New Layer">+</button>
          <button className="img-btn" onClick={() => fileRef.current?.click()} title="Import Image">Img</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportImage?.(file)
            e.target.value = ''
          }}
        />
      </div>
      <div className="layer-list">
        {layers.map((layer, idx) => (
          <div
            key={layer.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(idx)}
          >
            <LayerItem
              layer={layer}
              isActive={layer.id === activeLayerId}
              onSelect={onSelect}
              onRename={onRename}
              onToggleVisible={onToggleVisible}
              onToggleLocked={onToggleLocked}
            />
          </div>
        ))}
      </div>
      <div className="layer-actions">
        <button onClick={onDuplicate}>Dup</button>
        <button className="danger" onClick={onDelete}>Del</button>
      </div>
    </div>
  )
}
