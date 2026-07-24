import { useRef, useCallback, useEffect, useState } from 'react'

export default function Slider({ value, min, max, step, onChange, className, disabled }) {
  const trackRef = useRef(null)
  const draggingRef = useRef(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const inputRef = useRef(null)

  const range = max - min || 1
  const frac = Math.max(0, Math.min(1, (value - min) / range))

  const computeValue = useCallback((clientX) => {
    const track = trackRef.current
    if (!track) return value
    const rect = track.getBoundingClientRect()
    let f = (clientX - rect.left) / rect.width
    f = Math.max(0, Math.min(1, f))
    const raw = min + f * range
    if (step === 0 || step == null) return raw
    const stepped = Math.round((raw - min) / step) * step + min
    return Math.max(min, Math.min(max, stepped))
  }, [min, max, range, step, value])

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
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }, [disabled, computeValue, onChange])

  const handleWheel = useCallback((e) => {
    if (disabled) return
    e.preventDefault()
    const stepSize = step || range / 100
    const dir = e.deltaY > 0 ? -1 : 1
    const delta = dir * stepSize
    const raw = value + delta
    const clamped = Math.max(min, Math.min(max, raw))
    if (step === 0 || step == null) {
      onChange?.(clamped)
    } else {
      const stepped = Math.round((clamped - min) / step) * step + min
      onChange?.(Math.max(min, Math.min(max, stepped)))
    }
  }, [disabled, min, max, step, range, value, onChange])

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
