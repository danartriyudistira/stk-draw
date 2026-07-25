import { useRef, useCallback, useEffect, useState, memo } from 'react'

function Slider({ value, min, max, step, onChange, className, disabled }) {
  const trackRef = useRef(null)
  const draggingRef = useRef(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const inputRef = useRef(null)
  const valsRef = useRef({ value, min, max, step, onChange })
  valsRef.current = { value, min, max, step, onChange }

  const range = max - min || 1
  const frac = Math.max(0, Math.min(1, (value - min) / range))

  const computeValue = useCallback((clientX) => {
    const track = trackRef.current
    const v = valsRef.current
    if (!track) return v.value
    const rect = track.getBoundingClientRect()
    let f = (clientX - rect.left) / rect.width
    f = Math.max(0, Math.min(1, f))
    const r = v.max - v.min || 1
    const raw = v.min + f * r
    if (v.step === 0 || v.step == null) return raw
    const stepped = Math.round((raw - v.min) / v.step) * v.step + v.min
    return Math.max(v.min, Math.min(v.max, stepped))
  }, [])

  const cleanupRef = useRef(null)

  const handlePointerDown = useCallback((e) => {
    if (disabled) return
    e.preventDefault()
    draggingRef.current = true
    const val = computeValue(e.clientX)
    onChange?.(val)
    const handlePointerMove = (e) => {
      if (!draggingRef.current) return
      onChange?.(computeValue(e.clientX))
    }
    const handlePointerUp = () => {
      draggingRef.current = false
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      cleanupRef.current = null
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    cleanupRef.current = handlePointerUp
  }, [disabled, onChange])

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current()
    }
  }, [])

  const handleWheel = useCallback((e) => {
    if (disabled) return
    e.preventDefault()
    const v = valsRef.current
    const r = v.max - v.min || 1
    const stepSize = v.step || r / 100
    const dir = e.deltaY > 0 ? -1 : 1
    const delta = dir * stepSize
    const raw = v.value + delta
    const clamped = Math.max(v.min, Math.min(v.max, raw))
    if (v.step === 0 || v.step == null) {
      v.onChange?.(clamped)
    } else {
      const stepped = Math.round((clamped - v.min) / v.step) * v.step + v.min
      v.onChange?.(Math.max(v.min, Math.min(v.max, stepped)))
    }
  }, [disabled])

  useEffect(() => {
    const el = trackRef.current
    if (!el || disabled) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel, disabled])

  function startEditing() {
    setEditText(String(value))
    setEditing(true)
  }

  function commitEdit() {
    setEditing(false)
    const v = parseFloat(editText)
    if (isNaN(v)) return
    onChange?.(Math.max(min, Math.min(max, v)))
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  return (
    <div className="td-slider-wrap">
      <div
        ref={trackRef}
        className={`td-slider${className ? ' ' + className : ''}${disabled ? ' td-slider--disabled' : ''}`}
        onPointerDown={handlePointerDown}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className="td-slider-fill" style={{ width: `${frac * 100}%` }} />
        <div className="td-slider-knot" style={{ left: `${frac * 100}%` }} />
      </div>
      {editing ? (
        <input
          ref={inputRef}
          className="td-slider-input"
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
        />
      ) : (
        <span className="td-slider-value" onDoubleClick={startEditing}>{Number(value).toFixed(3)}</span>
      )}
    </div>
  )
}

export default memo(Slider)
