export function buildContinuousTimeline(strokes) {
  const entries = []
  let contCursor = 0

  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i]
    const pts = s.points || []
    if (pts.length < 2) continue

    let firstTime = Infinity
    let lastTime = -Infinity
    for (const p of pts) {
      if (p.time != null && p.time < firstTime) firstTime = p.time
      if (p.time != null && p.time > lastTime) lastTime = p.time
    }
    if (!isFinite(firstTime) || !isFinite(lastTime)) continue

    const duration = lastTime - firstTime
    if (duration <= 0) continue

    entries.push({
      strokeIdx: i,
      firstAbsTime: firstTime,
      lastAbsTime: lastTime,
      duration,
      contStart: contCursor,
    })
    contCursor += duration
  }

  return { entries, totalDuration: contCursor }
}
