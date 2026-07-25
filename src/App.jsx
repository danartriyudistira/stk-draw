import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'
import StageCanvas from './components/StageCanvas.jsx'
import LayerPanel from './components/LayerPanel.jsx'
import PenLfoPanel from './components/PenLfoPanel.jsx'
import TransformLfoPanel from './components/TransformLfoPanel.jsx'
import { createLayer } from './data/defaultLayer.js'

const INITIAL_LAYER = createLayer('Layer 1')

function cloneLayer(layer) {
  return JSON.parse(JSON.stringify(layer))
}

export default function App() {
  const [layers, setLayers] = useState([INITIAL_LAYER])
  const [activeLayerId, setActiveLayerId] = useState(INITIAL_LAYER.id)
  const [isPlaying, setIsPlaying] = useState(true)
  const [setOriginMode, setSetOriginMode] = useState(false)
  const [statusText, setStatusText] = useState('Ready')
  const [lfoPreviewTime, setLfoPreviewTime] = useState(0)
  const globalTimeRef = useRef(0)
  const rafIdRef = useRef(null)

  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0]

  const updateActiveLayer = useCallback((fn) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === activeLayerId ? fn(cloneLayer(l)) : l)),
    )
  }, [activeLayerId])

  useEffect(() => {
    if (!isPlaying) return
    let last = performance.now()
    const tick = (now) => {
      const dt = (now - last) / 1000
      last = now
      globalTimeRef.current += dt
      setLfoPreviewTime(globalTimeRef.current)
      rafIdRef.current = requestAnimationFrame(tick)
    }
    rafIdRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [isPlaying])

  const handleAddLayer = useCallback(() => {
    const num = layers.length + 1
    const layer = createLayer(`Layer ${num}`)
    setLayers((prev) => [...prev, layer])
    setActiveLayerId(layer.id)
  }, [layers.length])

  const handleDeleteLayer = useCallback(() => {
    if (layers.length <= 1) return
    const next = layers.filter((l) => l.id !== activeLayerId)
    if (next.length === 0) return
    const deletedIdx = layers.findIndex((l) => l.id === activeLayerId)
    const newActiveId = next[Math.min(deletedIdx, next.length - 1)].id
    setLayers(next)
    setActiveLayerId(newActiveId)
  }, [layers, activeLayerId])

  const handleDuplicateLayer = useCallback(() => {
    const src = layers.find((l) => l.id === activeLayerId)
    if (!src) return
    const dup = cloneLayer(src)
    dup.id = crypto.randomUUID?.() || `layer-${Date.now()}-${Math.random()}`
    dup.name = `${src.name} copy`
    const idx = layers.findIndex((l) => l.id === activeLayerId)
    setLayers((prev) => {
      const next = [...prev]
      next.splice(idx + 1, 0, dup)
      return next
    })
    setActiveLayerId(dup.id)
  }, [activeLayerId])

  const handleRenameLayer = useCallback((id, name) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)))
  }, [])

  const handleToggleVisible = useCallback((id) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)))
  }, [])

  const handleToggleLocked = useCallback((id) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)))
  }, [])

  const handleAddStroke = useCallback((points) => {
    updateActiveLayer((layer) => ({
      ...layer,
      strokes: [...layer.strokes, { points }],
    }))
    setStatusText(`Stroke: ${points.length} points`)
  }, [updateActiveLayer])

  const handleUndo = useCallback(() => {
    updateActiveLayer((layer) => ({
      ...layer,
      strokes: layer.strokes.slice(0, -1),
    }))
    setStatusText('Undo')
  }, [updateActiveLayer])

  const handleClearLayer = useCallback(() => {
    updateActiveLayer((layer) => ({
      ...layer,
      strokes: [],
    }))
    setStatusText('Cleared')
  }, [updateActiveLayer])

  const handleSetOrigin = useCallback((x, y) => {
    updateActiveLayer((layer) => {
      const oldOx = layer.origin?.x ?? 0
      const oldOy = layer.origin?.y ?? 0
      const dx = oldOx - x
      const dy = oldOy - y
      return {
        ...layer,
        origin: { x, y },
        strokes: layer.strokes.map((stroke) => ({
          ...stroke,
          points: stroke.points.map((p) => ({
            ...p,
            x: p.x + dx,
            y: p.y + dy,
          })),
        })),
      }
    })
    setSetOriginMode(false)
    setStatusText(`Origin: (${x.toFixed(0)}, ${y.toFixed(0)})`)
  }, [updateActiveLayer])

  const handleExportPNG = useCallback(() => {
    const canvas = document.querySelector('.stage-area canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'stk-draw-export.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
    setStatusText('Exported PNG')
  }, [])

  const handleImportImage = useCallback((file) => {
    if (!file) return

    const img = new Image()
    img.onload = () => {
      const maxW = 1280
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const layer = createLayer(file.name.replace(/\.[^.]+$/, ''))
      layer.strokes = []
      layer.penLFOs = {
        thickness: { enabled: false, lfo: null },
        hue: { enabled: false, lfo: null },
      }
      layer.type = 'image'
      layer.src = img.src
      layer.imgW = w
      layer.imgH = h
      setLayers((prev) => [...prev, layer])
      setActiveLayerId(layer.id)
      setStatusText(`Imported: ${file.name} (${w}x${h})`)
    }
    img.src = URL.createObjectURL(file)
  }, [])

  const handleReorderLayers = useCallback((fromIdx, toIdx) => {
    setLayers((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }, [])

  return (
    <div className="app">
      <div className="toolbar">
        <span className="toolbar-title">STK DRAW</span>
        <button className={isPlaying ? 'playing' : ''} onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={handleUndo}>↩ Undo</button>
        <button onClick={handleClearLayer}>✕ Clear</button>
        <button onClick={handleExportPNG}>↓ PNG</button>
        <span style={{ fontSize: 10, color: '#666', marginLeft: 8, fontFamily: 'monospace' }}>
          {lfoPreviewTime.toFixed(1)}s
        </span>
      </div>

      <div className="main">
        <LayerPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onSelect={setActiveLayerId}
          onAdd={handleAddLayer}
          onDelete={handleDeleteLayer}
          onDuplicate={handleDuplicateLayer}
          onRename={handleRenameLayer}
          onToggleVisible={handleToggleVisible}
          onToggleLocked={handleToggleLocked}
          onReorder={handleReorderLayers}
          onImportImage={handleImportImage}
        />

        <div className="stage-area">
          <StageCanvas
            layers={layers}
            activeLayerId={activeLayerId}
            setOriginMode={setOriginMode}
            onSetOrigin={handleSetOrigin}
            onAddStroke={handleAddStroke}
            globalTime={lfoPreviewTime}
          />
        </div>

        <div className="right-panel">
          <PenLfoPanel
            layer={activeLayer}
            onChange={updateActiveLayer}
            globalTime={lfoPreviewTime}
          />
          <TransformLfoPanel
            layer={activeLayer}
            onChange={updateActiveLayer}
            setOriginMode={setOriginMode}
            onSetOriginMode={() => setSetOriginMode(true)}
            onCancelSetOrigin={() => setSetOriginMode(false)}
            globalTime={lfoPreviewTime}
          />
        </div>
      </div>

      <div className="status-bar">
        <span>{statusText}</span>
        <span>Layer: {activeLayer?.name || '—'}</span>
        <span>Strokes: {activeLayer?.strokes.length || 0}</span>
        <span className="status-phase">Time: {lfoPreviewTime.toFixed(2)}s</span>
      </div>
    </div>
  )
}
