import { applyEasing } from './EasingLib.js'

const _randomCache = {}

function sampleAndHold(key, time, hold) {
  const index = Math.floor(time / hold)
  if (_randomCache[key] === undefined || _randomCache[key].index !== index) {
    _randomCache[key] = { index, value: Math.random() }
  }
  return _randomCache[key].value
}

function waveSine(t) { return 0.5 + 0.5 * Math.sin(t * Math.PI * 2) }
function waveTriangle(t) { const p = t - Math.floor(t); return p < 0.5 ? p * 2 : 2 - p * 2 }
function waveSaw(t) { return t - Math.floor(t) }
function waveSquare(t) { return (t - Math.floor(t)) < 0.5 ? 1 : 0 }

function getWaveValue(waveform, phase, key) {
  switch (waveform) {
    case 'sine': return waveSine(phase)
    case 'triangle': return waveTriangle(phase)
    case 'saw': return waveSaw(phase)
    case 'square': return waveSquare(phase)
    case 'random': return sampleAndHold(`lfo_${key}`, phase, 1)
    default: return waveSine(phase)
  }
}

export function getLfoValue(phase, config, key = 'default') {
  if (!config) return 0
  const rawPhase = ((phase * config.speed) + (config.phaseOffset || 0)) % 1
  let wf

  if (config.waveform === 'random') {
    const hold = 1 / Math.max(config.speed, 0.01)
    wf = sampleAndHold(`lfo_${key}`, phase * config.speed, hold)
  } else {
    wf = getWaveValue(config.waveform, rawPhase, key)
  }

  const eased = applyEasing(wf, config.easing || 'linear')
  return config.min + eased * (config.max - config.min)
}

export function getWaveformShape(config, samples = 120) {
  const points = []
  for (let i = 0; i <= samples; i++) {
    const phase = i / samples
    let wf = getWaveValue(config.waveform, phase, 'preview')
    wf = applyEasing(wf, config.easing || 'linear')
    const val = config.min + wf * (config.max - config.min)
    points.push({ x: i / samples, y: wf, value: val })
  }
  return points
}
