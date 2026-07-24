export function createLayer(name) {
  return {
    id: crypto.randomUUID?.() || `layer-${Date.now()}-${Math.random()}`,
    name,
    visible: true,
    locked: false,
    strokes: [],
    origin: { x: 0, y: 0 },
    transform: {
      x:        { base: 0, lfo: null },
      y:        { base: 0, lfo: null },
      rotation: { base: 0, lfo: null },
      scaleX:   { base: 1, lfo: null },
      scaleY:   { base: 1, lfo: null, linkToScaleX: false },
      opacity:  { base: 1, lfo: null },
    },
    penLFOs: {
      thickness: { enabled: true, lfo: { waveform: 'sine', easing: 'easeInOut', speed: 2, min: 2, max: 40, phaseSource: 'time', phaseOffset: 0 } },
      hue:       { enabled: true, lfo: { waveform: 'triangle', easing: 'linear', speed: 0.5, min: 0, max: 360, phaseSource: 'distance', phaseOffset: 0 } },
    },
  }
}
