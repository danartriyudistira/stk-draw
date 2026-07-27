import { useState, useRef, useCallback, useEffect, memo } from 'react'
import './App.css'
import StageCanvas from './components/StageCanvas.jsx'
import LayerPanel from './components/LayerPanel.jsx'
import PenLfoPanel from './components/PenLfoPanel.jsx'
import KineticPanel from './components/KineticPanel.jsx'
import FramePanel from './components/FramePanel.jsx'
import TransformLfoPanel from './components/TransformLfoPanel.jsx'
import ShaderParamPanel from './components/ShaderParamPanel.jsx'
import { createLayer, createGroup, createKineticLayer, createFrameLayer, createShaderLayer, deepCloneSubtree, collectDescendantIds } from './data/defaultLayer.js'
import ShaderCodeEditor from './components/ShaderCodeEditor.jsx'

const INITIAL_LAYER = createLayer('Layer 1')
const INITIAL_FRAME = createFrameLayer('Output')

export const globalTimeRef = { current: 0 }

const isStandalone = new URLSearchParams(window.location.search).has('standalone')

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

function StandaloneView() {
  const [state, setState] = useState(null)
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    const channel = new BroadcastChannel('stk-draw-sync')
    channel.onmessage = (e) => {
      if (e.data.type === 'state') {
        setState(e.data)
        setWaiting(false)
      }
    }
    const timer = setTimeout(() => setWaiting(true), 2000)
    return () => { channel.close(); clearTimeout(timer) }
  }, [])

  if (!state) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: waiting ? '#555' : '#333', fontSize: 14, fontFamily: 'monospace' }}>
          {waiting ? 'Waiting for connection...' : 'Connecting...'}
        </span>
      </div>
    )
  }

  const frame = (state.layers || []).find((l) => l.type === 'frame')
  const outRect = frame?.frameRect || state.outputRect || { x: -800, y: -450, w: 1600, h: 900 }
  const outRatio = frame?.aspectRatio || state.aspectRatio || '16:9'

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <StageCanvas
        layers={state.layers}
        activeLayerId={state.activeLayerId}
        setOriginMode={false}
        drawMode={state.drawMode}
        onSetOrigin={() => {}}
        onAddStroke={() => {}}
        onUpdateTransformBase={() => {}}
        onUpdateLayer={() => {}}
        bgColor={state.bgColor}
        outputRect={outRect}
        aspectRatio={outRatio}
        isOutputView={true}
        showGrid={false}
        interactive={false}
        showFullscreenBtn={true}
      />
    </div>
  )
}

export default function App() {
  if (isStandalone) return <StandaloneView />

  // --- normal app below ---
  const [layers, setLayers] = useState([INITIAL_FRAME, INITIAL_LAYER])
  const [activeLayerId, setActiveLayerId] = useState(INITIAL_LAYER.id)
  const [isPlaying, setIsPlaying] = useState(true)
  const [setOriginMode, setSetOriginMode] = useState(false)
  const [drawMode, setDrawMode] = useState(true)
  const [statusText, setStatusText] = useState('Ready')
  const [bgColor, setBgColor] = useState('#111')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorHeight, setEditorHeight] = useState(240)
  const [shaderCompileErrors, setShaderCompileErrors] = useState({})
  const rafIdRef = useRef(null)
  const popupRef = useRef(null)
  const undoStacksRef = useRef({})
  const redoStacksRef = useRef({})
  const layersRef = useRef(layers)

  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0]
  const frameLayer = layers.find((l) => l.type === 'frame') || INITIAL_FRAME
  const outputRect = frameLayer.frameRect
  const aspectRatio = frameLayer.aspectRatio

  layersRef.current = layers

  const handleUpdateFrame = useCallback((fn) => {
    setLayers((prev) => {
      const frame = prev.find((l) => l.type === 'frame')
      if (!frame) return prev
      return prev.map((l) => l.id === frame.id ? { ...l, ...fn(l) } : l)
    })
  }, [])

  const broadcastRef = useRef({ layers, activeLayerId, drawMode, bgColor, outputRect, aspectRatio })
  broadcastRef.current = { layers, activeLayerId, drawMode, bgColor, outputRect, aspectRatio }

  useEffect(() => {
    const channel = new BroadcastChannel('stk-draw-sync')
    let raf
    const tick = () => {
      const s = broadcastRef.current
      channel.postMessage({ type: 'state', ...JSON.parse(JSON.stringify(s)) })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); channel.close() }
  }, [])

  const handlePopout = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus()
      return
    }
    const w = Math.round(screen.width * 0.5)
    const h = Math.round(screen.height * 0.5)
    const left = Math.round((screen.width - w) / 2)
    const top = Math.round((screen.height - h) / 2)
    const url = window.location.href.split('?')[0].split('#')[0] + '?standalone=1'
    popupRef.current = window.open(url, 'stk-draw-popup',
      `popup=1,width=${w},height=${h},left=${left},top=${top},menubar=0,toolbar=0,location=0,status=0`)
  }, [])

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
      const target = prev.find((l) => l.id === activeLayerId)
      if (target?.type === 'frame') return prev
      const idsToRemove = new Set(collectDescendantIds(prev, activeLayerId))
      const deletedIdx = prev.findIndex((l) => l.id === activeLayerId)
      const next = prev.filter((l) => !idsToRemove.has(l.id))
      if (next.length > 0) {
        const newId = next[Math.min(deletedIdx, next.length - 1)].id
        setActiveLayerId(newId)
      }
      return next
    })
  }, [activeLayerId])

  const handleDuplicateLayer = useCallback(() => {
    setLayers((prev) => {
      const cloned = deepCloneSubtree(prev, activeLayerId)
      if (!cloned || !cloned.length) return prev
      const idx = prev.findIndex((l) => l.id === activeLayerId)
      const next = [...prev]
      next.splice(idx + 1, 0, ...cloned)
      setActiveLayerId(cloned[0].id)
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
    const curLayer = layersRef.current.find((l) => l.id === activeLayerId)
    if (curLayer) {
      if (!undoStacksRef.current[activeLayerId]) undoStacksRef.current[activeLayerId] = []
      const stack = undoStacksRef.current[activeLayerId]
      stack.push(curLayer.strokes)
      if (stack.length > 50) stack.shift()
      redoStacksRef.current[activeLayerId] = []
    }
    updateActiveLayer((layer) => ({
      ...layer,
      strokes: [...layer.strokes, { points }],
    }))
    setStatusText(`Stroke: ${points.length} points`)
  }, [activeLayerId, updateActiveLayer])

  const handleUndo = useCallback(() => {
    const stack = undoStacksRef.current[activeLayerId]
    if (!stack || !stack.length) return
    const prevStrokes = stack.pop()
    const curLayer = layersRef.current.find((l) => l.id === activeLayerId)
    if (!curLayer) return
    if (!redoStacksRef.current[activeLayerId]) redoStacksRef.current[activeLayerId] = []
    redoStacksRef.current[activeLayerId].push(curLayer.strokes)
    updateActiveLayer((layer) => ({ ...layer, strokes: prevStrokes }))
    setStatusText(`Undo (${stack.length} left)`)
  }, [activeLayerId, updateActiveLayer])

  const handleRedo = useCallback(() => {
    const rStack = redoStacksRef.current[activeLayerId]
    if (!rStack || !rStack.length) return
    const nextStrokes = rStack.pop()
    const curLayer = layersRef.current.find((l) => l.id === activeLayerId)
    if (!curLayer) return
    if (!undoStacksRef.current[activeLayerId]) undoStacksRef.current[activeLayerId] = []
    undoStacksRef.current[activeLayerId].push(curLayer.strokes)
    updateActiveLayer((layer) => ({ ...layer, strokes: nextStrokes }))
    setStatusText(`Redo (${rStack.length} left)`)
  }, [activeLayerId, updateActiveLayer])

  const handleClearLayer = useCallback(() => {
    const curLayer = layersRef.current.find((l) => l.id === activeLayerId)
    if (curLayer && curLayer.strokes?.length) {
      if (!undoStacksRef.current[activeLayerId]) undoStacksRef.current[activeLayerId] = []
      const stack = undoStacksRef.current[activeLayerId]
      stack.push(curLayer.strokes)
      if (stack.length > 50) stack.shift()
      redoStacksRef.current[activeLayerId] = []
    }
    updateActiveLayer((layer) => ({
      ...layer,
      strokes: [],
    }))
    setStatusText('Cleared')
  }, [activeLayerId, updateActiveLayer])

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
        thickness: { lfo: null },
        hue: { lfo: null },
        saturation: { lfo: null },
        lightness: { lfo: null },
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

  const handleAddKineticLayer = useCallback(() => {
    setLayers((prev) => {
      const layer = createKineticLayer(`Kinetic ${prev.length + 1}`)
      setActiveLayerId(layer.id)
      return [...prev, layer]
    })
  }, [])

  const handleAddShaderLayer = useCallback(() => {
    setLayers((prev) => {
      const layer = createShaderLayer(`Shader ${prev.length + 1}`)
      setActiveLayerId(layer.id)
      return [...prev, layer]
    })
  }, [])

  const handleEditorToggle = useCallback(() => {
    setEditorOpen((prev) => !prev)
  }, [])

  useEffect(() => {
    const layer = layers.find((l) => l.id === activeLayerId)
    if (layer?.type === 'shader') {
      setEditorOpen(true)
    } else {
      setEditorOpen(false)
    }
  }, [activeLayerId])

  const handleShaderCodeChange = useCallback((code) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === activeLayerId ? { ...l, code } : l))
    )
  }, [activeLayerId])

  const handleShaderCompileResult = useCallback((layerId, error) => {
    setShaderCompileErrors((prev) => {
      if (prev[layerId] === error) return prev
      return { ...prev, [layerId]: error }
    })
  }, [])

  const handleShaderRefresh = useCallback(() => {
    updateActiveLayer((l) => ({ ...l, shaderRekey: (l.shaderRekey || 0) + 1 }))
  }, [updateActiveLayer])

  const handleAddGroup = useCallback(() => {
    setLayers((prev) => {
      const group = createGroup(`Group ${prev.length + 1}`)
      setActiveLayerId(group.id)
      return [...prev, group]
    })
  }, [])

  const handleGroupLayer = useCallback(() => {
    setLayers((prev) => {
      const active = prev.find((l) => l.id === activeLayerId)
      if (!active) return prev
      const group = createGroup(`Group ${prev.length + 1}`)
      const updated = prev.map((l) =>
        l.id === activeLayerId ? { ...l, parentId: group.id } : l
      )
      return [...updated, group]
    })
  }, [activeLayerId])

  const handleReparent = useCallback((layerId, newParentId) => {
    setLayers((prev) => {
      if (newParentId && layerId === newParentId) return prev
      let p = newParentId
      while (p) {
        if (p === layerId) return prev
        const parent = prev.find((l) => l.id === p)
        p = parent?.parentId ?? null
      }
      const destParent = newParentId ? prev.find((l) => l.id === newParentId) : null
      if (destParent && destParent.type !== 'group') return prev
      return prev.map((l) =>
        l.id === layerId ? { ...l, parentId: newParentId } : l
      )
    })
  }, [])

  const handleToggleExpand = useCallback((layerId) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === layerId && l.type === 'group'
          ? { ...l, childrenExpanded: !l.childrenExpanded }
          : l
      )
    )
  }, [])

  const handleLinkParent = useCallback((layerId, newLinkId) => {
    setLayers((prev) => {
      if (newLinkId && layerId === newLinkId) return prev
      if (newLinkId) {
        let p = newLinkId
        const visited = new Set()
        while (p) {
          if (visited.has(p)) return prev
          if (p === layerId) return prev
          visited.add(p)
          const linkLayer = prev.find((l) => l.id === p)
          p = linkLayer?.linkParentId ?? null
        }
      }
      return prev.map((l) =>
        l.id === layerId ? { ...l, linkParentId: newLinkId } : l
      )
    })
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

  useEffect(() => {
    const handler = (e) => {
      const tg = e.target
      const inInput = tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable
      if (inInput) return

      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo()
      } else if ((ctrl && e.key.toLowerCase() === 'z' && e.shiftKey) || (ctrl && e.key.toLowerCase() === 'y')) {
        e.preventDefault(); handleRedo()
      } else if (ctrl && e.key === 'd') {
        e.preventDefault(); handleDuplicateLayer()
      } else if (e.key === 'Delete' || e.key === 'Del') {
        handleClearLayer()
      } else if (ctrl && e.key === 's') {
        e.preventDefault(); handleExportPNG()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo, handleDuplicateLayer, handleClearLayer, handleExportPNG])

  return (
    <div className="app">
      <div className="toolbar">
        <span className="toolbar-title">STK DRAW</span>
        <button className={isPlaying ? 'playing' : ''} onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={handleUndo}>↩ Undo</button>
        <button onClick={handleClearLayer}>✕ Clear</button>
        <button className={drawMode ? 'active' : ''} onClick={() => setDrawMode(!drawMode)}>
          {drawMode ? '✎ Draw' : '↕ Transform'}
        </button>
        <button onClick={handleExportPNG}>↓ PNG</button>
        <button onClick={handlePopout} title="Pop out canvas to separate window">⛶ Popout</button>

        <ClockDisplay className="toolbar-clock" />
      </div>

      <div className="main">
        <LayerPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onSelect={setActiveLayerId}
          onAdd={handleAddLayer}
          onAddGroup={handleAddGroup}
          onGroupLayer={handleGroupLayer}
          onDelete={handleDeleteLayer}
          onDuplicate={handleDuplicateLayer}
          onRename={handleRenameLayer}
          onToggleVisible={handleToggleVisible}
          onToggleLocked={handleToggleLocked}
          onReorder={handleReorderLayers}
          onReparent={handleReparent}
          onToggleExpand={handleToggleExpand}
          onImportImage={handleImportImage}
          onAddKinetic={handleAddKineticLayer}
          onAddShader={handleAddShaderLayer}
          onLinkParent={handleLinkParent}
        />

        <div className="stage-area">
          <StageCanvas
            layers={layers}
            activeLayerId={activeLayerId}
            setOriginMode={setOriginMode}
            drawMode={drawMode}
            onSetOrigin={handleSetOrigin}
            onAddStroke={handleAddStroke}
            onUpdateTransformBase={updateActiveLayer}
            onUpdateLayer={updateActiveLayer}
            bgColor={bgColor}
            outputRect={outputRect}
            onSetOutputRect={(rect) => handleUpdateFrame((l) => ({ frameRect: rect }))}
            aspectRatio={aspectRatio}
            onSetAspectRatio={(ar) => handleUpdateFrame((l) => ({ aspectRatio: ar }))}
            onShaderCompileResult={handleShaderCompileResult}
          />
          <ShaderCodeEditor
            key={activeLayerId}
            code={activeLayer?.type === 'shader' ? activeLayer.code : ''}
            onChange={handleShaderCodeChange}
            onRefresh={handleShaderRefresh}
            layerName={activeLayer?.type === 'shader' ? activeLayer.name : ''}
            open={editorOpen && activeLayer?.type === 'shader'}
            onToggle={handleEditorToggle}
            error={activeLayer?.type === 'shader' ? shaderCompileErrors[activeLayer.id] : null}
            height={editorHeight}
            onResize={setEditorHeight}
          />
        </div>

        <div className="right-panel">
          {activeLayer?.type === 'shader' ? (
            <>
              <ShaderParamPanel
                layer={activeLayer}
                onChange={updateActiveLayer}
                error={activeLayer?.type === 'shader' ? shaderCompileErrors[activeLayer.id] : null}
              />
              <TransformLfoPanel
                layer={activeLayer}
                onChange={updateActiveLayer}
                setOriginMode={setOriginMode}
                onSetOriginMode={handleSetOriginMode}
                onCancelSetOrigin={handleCancelSetOrigin}
                target="transform"
                layers={layers}
                onLinkParent={handleLinkParent}
              />
            </>
          ) : activeLayer?.type === 'frame' ? (
            <>
              <FramePanel
                layer={activeLayer}
                onChange={handleUpdateFrame}
              />
              <TransformLfoPanel
                layer={activeLayer}
                onChange={updateActiveLayer}
                setOriginMode={setOriginMode}
                onSetOriginMode={handleSetOriginMode}
                onCancelSetOrigin={handleCancelSetOrigin}
                target="transform"
                layers={layers}
                onLinkParent={handleLinkParent}
              />
            </>
          ) : drawMode ? (
            <>
              {activeLayer?.type !== 'kinetic' && (
                <PenLfoPanel
                  layer={activeLayer}
                  onChange={updateActiveLayer}
                />
              )}
              {activeLayer?.type === 'kinetic' && (
                <KineticPanel
                  layer={activeLayer}
                  onChange={updateActiveLayer}
                />
              )}
              <TransformLfoPanel
                layer={activeLayer}
                onChange={updateActiveLayer}
                setOriginMode={setOriginMode}
                onSetOriginMode={handleSetOriginMode}
                onCancelSetOrigin={handleCancelSetOrigin}
                target="transform"
                layers={layers}
                onLinkParent={handleLinkParent}
              />
            </>
          ) : (
            <TransformLfoPanel
              layer={activeLayer}
              onChange={updateActiveLayer}
              setOriginMode={setOriginMode}
              onSetOriginMode={handleSetOriginMode}
              onCancelSetOrigin={handleCancelSetOrigin}
              target="placement"
              layers={layers}
              onLinkParent={handleLinkParent}
            />
          )}
        </div>
      </div>

      <div className="status-bar">
        <span>{statusText}</span>
        <span>Layer: {activeLayer?.name || '—'}</span>
        <span>Strokes: {activeLayer?.strokes?.length ?? activeLayer?.paths?.length ?? 0}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#888', marginLeft: 8 }}>
          BG
          <input
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            style={{ width: 20, height: 20, padding: 0, border: '1px solid #444', borderRadius: 2, background: 'none', cursor: 'pointer' }}
          />
        </label>
        <ClockDisplay className="status-phase" />
      </div>
    </div>
  )
}
