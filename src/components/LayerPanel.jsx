import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import LayerItem from './LayerItem.jsx'

function flattenTree(layers) {
  const nodeMap = new Map()
  const roots = []

  for (const l of layers) {
    nodeMap.set(l.id, { ...l, children: [] })
  }

  for (const l of layers) {
    const node = nodeMap.get(l.id)
    if (l.parentId && nodeMap.has(l.parentId)) {
      nodeMap.get(l.parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }

  const flat = []
  function walk(node, depth) {
    flat.push({ ...node, depth })
    if (node.type === 'group' && node.childrenExpanded !== false) {
      for (const child of node.children) {
        walk(child, depth + 1)
      }
    }
  }

  for (const root of roots) {
    walk(root, 0)
  }

  return flat
}

export default function LayerPanel({
  layers,
  activeLayerId,
  onSelect,
  onAdd,
  onAddGroup,
  onGroupLayer,
  onDelete,
  onDuplicate,
  onRename,
  onToggleVisible,
  onToggleLocked,
  onReorder,
  onReparent,
  onToggleExpand,
  onImportImage,
  onAddKinetic,
  onLinkParent,
}) {
  const dragFromIdxRef = useRef(null)
  const fileRef = useRef(null)
  const panelRef = useRef(null)

  const [popup, setPopup] = useState(null)

  const flatItems = useMemo(() => flattenTree(layers), [layers])

  const closePopup = useCallback(() => setPopup(null), [])

  useEffect(() => {
    if (!popup) return
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        closePopup()
      }
    }
    const onKey = (e) => { if (e.key === 'Escape') closePopup() }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [popup, closePopup])

  function handleContextLayer(e, layerId) {
    setPopup({
      layerId,
      x: e.clientX,
      y: e.clientY,
    })
  }

  function handleDragStart(idx) {
    dragFromIdxRef.current = idx
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDrop(idx) {
    const from = dragFromIdxRef.current
    dragFromIdxRef.current = null
    if (from == null || from === idx) return

    const target = flatItems[idx]
    const dragged = flatItems[from]
    if (!target || !dragged) return

    if (target.type === 'group' && target.id !== dragged.id && dragged.parentId !== target.id) {
      onReparent?.(dragged.id, target.id)
    } else if (typeof onReorder === 'function') {
      onReorder(from, idx)
    }
  }

  const targetLayer = popup ? layers.find((l) => l.id === popup.layerId) : null
  const availableLinks = layers.filter((l) => l.id !== popup?.layerId)

  return (
    <div className="left-panel" ref={panelRef} style={{ position: 'relative' }}>
      <div className="left-panel-header">
        <span>LAYERS</span>
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={onAdd} title="New Layer">+</button>
          <button onClick={onAddGroup} title="New Group" style={{ color: '#bb86fc' }}>G+</button>
          <button onClick={onAddKinetic} title="New Kinetic Layer" style={{ color: '#f9a825' }}>K+</button>
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
        {flatItems.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(idx)}
          >
            <LayerItem
              layer={item}
              isActive={item.id === activeLayerId}
              depth={item.depth}
              layers={layers}
              onSelect={onSelect}
              onRename={onRename}
              onToggleVisible={onToggleVisible}
              onToggleLocked={onToggleLocked}
              onToggleExpand={onToggleExpand}
              onReparent={onReparent}
              onContextLayer={handleContextLayer}
            />
          </div>
        ))}
      </div>
      <div className="layer-actions">
        <button onClick={onGroupLayer} title="Wrap active layer in group">Group</button>
        <button onClick={onDuplicate}>Dup</button>
        <button className="danger" onClick={onDelete}>Del</button>
      </div>

      {popup && (
        <div
          className="link-popup"
          style={{ left: popup.x, top: popup.y }}
        >
          <div className="link-popup-title">
            Link "{targetLayer?.name || ''}" to:
          </div>
          <div className="link-popup-list">
            {availableLinks.map((l) => (
              <div
                key={l.id}
                className={`link-popup-item${l.id === targetLayer?.linkParentId ? ' active' : ''}`}
                onClick={() => {
                  onLinkParent?.(popup.layerId, l.id)
                  closePopup()
                }}
              >
                <span className="link-popup-name">
                  {l.name}
                  {l.type === 'group' && <span className="layer-badge group-badge">G</span>}
                </span>
                {l.id === targetLayer?.linkParentId && (
                  <span className="link-popup-check">✓</span>
                )}
              </div>
            ))}
          </div>
          {targetLayer?.linkParentId && (
            <div
              className="link-popup-item link-popup-unlink"
              onClick={() => {
                onLinkParent?.(popup.layerId, null)
                closePopup()
              }}
            >
              ✕ Unlink
            </div>
          )}
        </div>
      )}
    </div>
  )
}
