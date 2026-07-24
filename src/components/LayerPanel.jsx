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
}) {
  const dragIdxRef = useRef(null)

  function handleDragStart(idx) {
    dragIdxRef.current = idx
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDrop(idx) {
    const from = dragIdxRef.current
    if (from != null && from !== idx) {
      onReorder(from, idx)
    }
    dragIdxRef.current = null
  }

  return (
    <div className="left-panel">
      <div className="left-panel-header">
        <span>LAYERS</span>
        <button onClick={onAdd} title="New Layer">+</button>
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
