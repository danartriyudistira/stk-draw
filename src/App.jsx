import { useState, useRef, useCallback, useEffect, memo } from 'react'
import './App.css'
import StageCanvas from './components/StageCanvas.jsx'
import LayerPanel from './components/LayerPanel.jsx'
import PenLfoPanel from './components/PenLfoPanel.jsx'
import TransformLfoPanel from './components/TransformLfoPanel.jsx'
import { createLayer } from './data/defaultLayer.js'

const INITIAL_LAYER = createLayer('Layer 1')

export const globalTimeRef = { current: 0 }

function cloneLayer(layer) {
  return JSON.parse(JSON.stringify(layer))
}

const ClockDisplay = memo(function ClockDisplay({ className }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    let raf
    const tick = () => {
      setT(globalTimeRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <span className={className}>{t.toFixed(1)}s</span>
})

export default function App() {
  const [layers, setLayers] = useState([INITIAL_LAYER])
  const [activeLayerId, setActiveLayerId] = useState(INITIAL_LAYER.id)
  const [isPlaying, setIsPlaying] = useState(true)
  const [setOriginMode, setSetOriginMode] = useState(false)
  const [transformMode, setTransformMode] = useState(false)
  const [statusText, setStatusText] = useState('Ready')
  const rafIdRef = useRef(null)

  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0]

  const updateActiveLayer = useCallback((fn) => {
    setLayers((prev) => {
      const layer = prev.find((l) => l.id === activeLayerId)
      if (!layer) return prev
      return prev.map((l) => (l.id === activeLayerId ? fn(l) : l))
    })
  }, [activeLayerId])

  useEffect(() => {
    if (!isPlaying) return
    let last = performance.now()
    const tick = (now) => {
      const dt = (now - last) / 1000
      last = now
      globalTimeRef.current += dt
      rafIdRef.current = requestAnimationFrame(tick)
    }
    rafIdRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [isPlaying])

  const handleAddLayer = useCallback(() => {
    setLayers((prev) => {
      const layer = createLayer(`Layer ${prev.length + 1}`)
      setActiveLayerId(layer.id)
      return [...prev, layer]
    })
  }, [])

  const handleDeleteLayer = useCallback(() => {
    setLayers((prev) => {
      if (prev.length <= 1) return prev
      const deletedIdx = prev.findIndex((l) => l.id === activeLayerId)
      const next = prev.filter((l) => l.id !== activeLayerId)
      if (next.length > 0) {
        const newId = next[Math.min(deletedIdx, next.length - 1)].id
        setActiveLayerId(newId)
      }
      return next
    })
  }, [activeLayerId])

  const handleDuplicateLayer = useCallback(() => {
    setLayers((prev) => {
      const src = prev.find((l) => l.id === activeLayerId)
      if (!src) return prev
      const dup = cloneLayer(src)
      dup.id = crypto.randomUUID?.() || `layer-${Date.now()}-${Math.random()}`
      dup.name = `${src.name} copy`
      const idx = prev.findIndex((l) => l.id === activeLayerId)
      const next = [...prev]
      next.splice(idx + 1, 0, dup)
      setActiveLayerId(dup.id)
      return next
    })
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
      if (dx === 0 && dy === 0) return layer
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
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
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
      layer.src = url
      layer.imgW = w
      layer.imgH = h
      setLayers((prev) => [...prev, layer])
      setActiveLayerId(layer.id)
      setStatusText(`Imported: ${file.name} (${w}x${h})`)
    }
    img.src = url
  }, [])

  const handleReorderLayers = useCallback((fromIdx, toIdx) => {
    setLayers((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }, [])

  const handleSetOriginMode = useCallback(() => setSetOriginMode(true), [])
  const handleCancelSetOrigin = useCallback(() => setSetOriginMode(false), [])

  return (
    <div className="app">
      <div className="toolbar">
        <span className="toolbar-title">STK DRAW</span>
        <button className={isPlaying ? 'playing' : ''} onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={handleUndo}>↩ Undo</button>
        <button onClick={handleClearLayer}>✕ Clear</button>
        <button className={transformMode ? 'active' : ''} onClick={() => setTransformMode(!transformMode)}>
          {transformMode ? '✋ Hand' : '↕ Move'}
        </button>
        <button onClick={handleExportPNG}>↓ PNG</button>
        <ClockDisplay className="toolbar-clock" />
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
            transformMode={transformMode}
            onSetOrigin={handleSetOrigin}
            onAddStroke={handleAddStroke}
            onUpdateTransformBase={updateActiveLayer}
          />
        </div>

        <div className="right-panel">
          <PenLfoPanel
            layer={activeLayer}
            onChange={updateActiveLayer}
          />
          <TransformLfoPanel
            layer={activeLayer}
            onChange={updateActiveLayer}
            setOriginMode={setOriginMode}
            onSetOriginMode={handleSetOriginMode}
            onCancelSetOrigin={handleCancelSetOrigin}
          />
        </div>
      </div>

      <div className="status-bar">
        <span>{statusText}</span>
        <span>Layer: {activeLayer?.name || '—'}</span>
        <span>Strokes: {activeLayer?.strokes.length || 0}</span>
        <ClockDisplay className="status-phase" />
      </div>
    </div>
  )
}
