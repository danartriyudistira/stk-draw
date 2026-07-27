export function parseIsfHeader(code) {
  let match = code.match(/\/\*\s*\{[\s\S]*?\}\s*\*\//)
  if (!match) {
    const lines = code.split('\n')
    const commentLines = []
    let inBlock = false
    let found = false
    for (const line of lines) {
      if (inBlock) {
        commentLines.push(line)
        if (line.includes('*/')) {
          commentLines[commentLines.length - 1] = line.replace(/\s*\*\/\s*$/, '')
          inBlock = false
          found = true
          break
        }
      } else if (line.includes('/*')) {
        inBlock = true
        const after = line.substring(line.indexOf('/*') + 2)
        if (after.includes('*/')) {
          commentLines.push(after.replace(/\s*\*\/\s*$/, ''))
          found = true
          break
        }
        commentLines.push(after)
      }
    }
    if (found) {
      const combined = commentLines.join('\n').trim()
      try {
        return JSON.parse(combined)
      } catch (e) {
        return null
      }
    }
    return null
  }
  try {
    const inner = match[0].replace(/^\/\*\s*/, '').replace(/\s*\*\/$/, '').trim()
    return JSON.parse(inner)
  } catch (e) {
    return null
  }
}

export function getDefaultForInput(input) {
  switch (input.TYPE) {
    case 'float':
      if (input.DEFAULT != null) return input.DEFAULT
      return input.MIN ?? 0
    case 'point2D':
      if (input.DEFAULT != null) return input.DEFAULT
      return [0, 0]
    case 'color':
      if (input.DEFAULT != null) return input.DEFAULT
      return [1, 1, 1, 1]
    case 'bool':
      if (input.DEFAULT != null) return input.DEFAULT
      return 0
    case 'long':
      if (input.VALUES?.length > 0) return input.VALUES[0]
      if (input.DEFAULT != null) return Math.round(input.DEFAULT)
      return Math.round(input.MIN ?? 0)
    default:
      return 0
  }
}

const ISF_BUILTIN_UNIFORMS = [
  { name: 'RENDERSIZE', type: 'vec2' },
  { name: 'TIME', type: 'float' },
  { name: 'TIMEDELTA', type: 'float' },
  { name: 'FRAMEINDEX', type: 'int' },
  { name: 'DATE', type: 'vec4' },
]

const ISF_INPUT_TYPE_MAP = {
  float: 'float',
  point2D: 'vec2',
  color: 'vec4',
  bool: 'bool',
  long: 'int',
}

export function prepareIsfShader(code) {
  const header = parseIsfHeader(code)
  const inputs = header?.INPUTS || []
  const isIsf = header != null

  let glsl = code.replace(/\/\*\s*\{[\s\S]*?\}\s*\*\//, '').trim()

  if (!/(?:precision\s+\w+\s+float)/i.test(glsl)) {
    glsl = 'precision highp float;\n' + glsl
  }

  const declaredNames = new Set()
  const uniformRe = /uniform\s+\w+\s+(\w+)\s*;/g
  let m
  while ((m = uniformRe.exec(glsl)) !== null) {
    declaredNames.add(m[1])
  }

  const injectUniforms = []

  if (isIsf) {
    for (const builtin of ISF_BUILTIN_UNIFORMS) {
      if (!declaredNames.has(builtin.name)) {
        injectUniforms.push(`uniform ${builtin.type} ${builtin.name};`)
      }
    }
    injectUniforms.push('#define isf_FragCoord gl_FragCoord')
  }

  for (const input of inputs) {
    const glType = ISF_INPUT_TYPE_MAP[input.TYPE]
    if (glType && !declaredNames.has(input.NAME)) {
      injectUniforms.push(`uniform ${glType} ${input.NAME};`)
    }
  }

  const lines = glsl.split('\n')
  let insertIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.startsWith('precision ') || t === '' || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('#')) {
      insertIdx = i + 1
    } else {
      break
    }
  }

  const before = lines.slice(0, insertIdx).join('\n')
  const after = lines.slice(insertIdx).join('\n')

  let processed = before
  if (injectUniforms.length > 0) {
    processed += '\n// ISF-injected\n' + injectUniforms.join('\n') + '\n'
  }
  processed += '\n' + after

  if (isIsf) {
    processed = processed.replace(
      /(void\s+main\s*\(\s*(?:void\s*)?\)\s*\{)/,
      '$1\n    vec2 isf_FragNormCoord = isf_FragCoord.xy / RENDERSIZE;'
    )
  }

  return { code: processed, inputs, header }
}

