import { useRef, useCallback, useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import ShaderLibrary from './ShaderLibrary.jsx'

export default function ShaderCodeEditor({
  code,
  onChange,
  onRefresh,
  onApplyShader,
  layerName,
  open,
  onToggle,
  error,
  height,
  onResize,
  layers,
}) {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const [resizing, setResizing] = useState(false)
  const resizeStartRef = useRef({ y: 0, startHeight: 0 })

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    setResizing(true)
    resizeStartRef.current = {
      y: e.clientY,
      startHeight: height,
    }
  }, [height])

  useEffect(() => {
    if (!resizing) return
    const onMove = (e) => {
      const delta = resizeStartRef.current.y - e.clientY
      const parent = containerRef.current?.parentElement
      const maxH = parent ? parent.clientHeight * 0.8 : 600
      const newH = Math.max(80, Math.min(maxH, resizeStartRef.current.startHeight + delta))
      onResize(newH)
    }
    const onUp = () => setResizing(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [resizing, onResize])

  function handleEditorMount(editor) {
    editorRef.current = editor
    setTimeout(() => editor.focus(), 0)
  }

  function handleEditorChange(val) {
    onChange(val || '')
  }

  function handleRefresh(e) {
    e.stopPropagation()
    const editor = editorRef.current
    if (editor) {
      const val = editor.getValue()
      if (val !== code) onChange(val || '')
    }
    if (onRefresh) onRefresh()
  }

  return (
    <div
      ref={containerRef}
      className={`shader-editor-overlay${!open ? ' collapsed' : ''}`}
      style={{ height: open ? height : 28 }}
    >
      {!open ? (
        <div className="shader-editor-collapsed-bar" onClick={onToggle}>
          <span className="shader-editor-filename">{layerName}.fs</span>
          <div className="shader-editor-bar-right">
            {error && <span className="shader-editor-error" title={error}>! ERROR</span>}
            <button className="shader-editor-collapse-btn" onClick={(e) => { e.stopPropagation(); onToggle() }} title="Open">▲</button>
          </div>
        </div>
      ) : (
        <>
          <div className="shader-editor-resize-handle" onPointerDown={handleMouseDown}>
            <div className="shader-editor-resize-grip" />
          </div>
          <div className="shader-editor-bar">
            <span className="shader-editor-filename">{layerName}.fs</span>
            <div className="shader-editor-bar-right">
              {error ? (
                <span className="shader-editor-error" title={error}>! ERROR</span>
              ) : (
                <span className="shader-editor-ok">OK</span>
              )}
              <button className="shader-editor-refresh-btn" onClick={handleRefresh} title="Recompile shader">↻</button>
              <button className="shader-editor-collapse-btn" onClick={onToggle} title="Collapse">▼</button>
            </div>
          </div>
          <div className="shader-editor-body">
            <div className="shader-editor-left">
              <Editor
                height="100%"
                language="glsl"
                theme="vs-dark"
                defaultValue={code}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                  padding: { top: 4 },
                  automaticLayout: true,
                }}
              />
            </div>
            <div className="shader-editor-right">
              <ShaderLibrary onApply={onApplyShader} layers={layers} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
