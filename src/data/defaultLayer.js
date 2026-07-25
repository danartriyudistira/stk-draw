function lfoStatic(min) {
  return { waveform: 'none', easing: 'linear', speed: 0.5, min, max: min + 100, phaseSource: 'time', phaseOffset: 0 }
}

function defaultTransform() {
  return {
    x:        { lfo: lfoStatic(0) },
    y:        { lfo: lfoStatic(0) },
    rotation: { lfo: lfoStatic(0) },
    scaleX:   { lfo: lfoStatic(1) },
    scaleY:   { lfo: lfoStatic(1), linkToScaleX: true },
    opacity:  { lfo: lfoStatic(1) },
    flipH: false,
    flipV: false,
  }
}

export function createLayer(name, parentId = null) {
  return {
    id: crypto.randomUUID?.() || `layer-${Date.now()}-${Math.random()}`,
    name,
    parentId,
    linkParentId: null,
    visible: true,
    locked: false,
    strokes: [],
    origin: { x: 0, y: 0 },
    transform: defaultTransform(),
    placement: defaultTransform(),
    penLFOs: {
      thickness:  { lfo: { waveform: 'sine', easing: 'easeInOut', speed: 0.5, min: 2, max: 40, phaseSource: 'time', phaseOffset: 0 } },
      hue:        { lfo: { waveform: 'triangle', easing: 'linear', speed: 0.3, min: 0, max: 360, phaseSource: 'distance', phaseOffset: 0 } },
      saturation: { lfo: { waveform: 'sine', easing: 'linear', speed: 0.3, min: 20, max: 100, phaseSource: 'distance', phaseOffset: 0 } },
      lightness:  { lfo: { waveform: 'none', easing: 'linear', speed: 0, min: 50, max: 100, phaseSource: 'time', phaseOffset: 0 } },
    },
  }
}

export function createKineticLayer(name, parentId = null) {
  return {
    id: crypto.randomUUID?.() || `kinetic-${Date.now()}-${Math.random()}`,
    name,
    parentId,
    linkParentId: null,
    visible: true,
    locked: false,
    type: 'kinetic',
    paths: [],
    color: '#FFBA49',
    thickness: 12,
    drawRate: 120,
    maxVelocity: 120,
    particleChance: 0.05,
    origin: { x: 0, y: 0 },
    transform: defaultTransform(),
    placement: defaultTransform(),
    penLFOs: {
      hue:        { lfo: { waveform: 'sine', easing: 'linear', speed: 0.3, min: 0, max: 360, phaseSource: 'time', phaseOffset: 0 } },
      saturation: { lfo: { waveform: 'none', easing: 'linear', speed: 0, min: 70, max: 100, phaseSource: 'time', phaseOffset: 0 } },
      lightness:  { lfo: { waveform: 'none', easing: 'linear', speed: 0, min: 50, max: 100, phaseSource: 'time', phaseOffset: 0 } },
    },
  }
}

export function createGroup(name, parentId = null) {
  return {
    id: crypto.randomUUID?.() || `group-${Date.now()}-${Math.random()}`,
    name,
    parentId,
    linkParentId: null,
    visible: true,
    locked: false,
    type: 'group',
    childrenExpanded: true,
    strokes: [],
    origin: { x: 0, y: 0 },
    transform: defaultTransform(),
    placement: defaultTransform(),
    penLFOs: {
      thickness:  { lfo: null },
      hue:        { lfo: null },
      saturation: { lfo: null },
      lightness:  { lfo: null },
    },
  }
}

function makeId() {
  return crypto.randomUUID?.() || `layer-${Date.now()}-${Math.random()}`
}

export function deepCloneSubtree(layers, rootId) {
  const idMap = new Map()

  function collectDescendants(parentId) {
    const result = []
    for (const l of layers) {
      if (l.parentId === parentId) {
        result.push(l)
        result.push(...collectDescendants(l.id))
      }
    }
    return result
  }

  const root = layers.find((l) => l.id === rootId)
  if (!root) return null

  const allItems = [root, ...collectDescendants(rootId)]
  const cloned = allItems.map((item) => {
    const clone = JSON.parse(JSON.stringify(item))
    const newId = makeId()
    idMap.set(clone.id, newId)
    clone.id = newId
    return clone
  })

  for (const clone of cloned) {
    if (clone.parentId && idMap.has(clone.parentId)) {
      clone.parentId = idMap.get(clone.parentId)
    } else if (clone.parentId && !idMap.has(clone.parentId)) {
      clone.parentId = null
    }
  }

  cloned[0].name = `${root.name} copy`
  return cloned
}

export function collectDescendantIds(layers, layerId) {
  const ids = [layerId]
  for (const l of layers) {
    if (l.parentId === layerId) {
      ids.push(...collectDescendantIds(layers, l.id))
    }
  }
  return ids
}
