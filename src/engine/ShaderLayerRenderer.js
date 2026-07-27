import { parseIsfHeader, getDefaultForInput, prepareIsfShader } from './IsfParser.js'

export const DEFAULT_FRAGMENT = `/*{
  "DESCRIPTION": "Hue rotating gradient",
  "CREDIT": "STK",
  "ISFVSN": "2.0",
  "INPUTS": [
    {"NAME": "speed", "TYPE": "float", "MIN": 0.0, "MAX": 2.0, "DEFAULT": 1.0},
    {"NAME": "hueShift", "TYPE": "float", "MIN": 0.0, "MAX": 6.2832, "DEFAULT": 0.0}
  ]
}*/

precision highp float;

void main() {
    vec2 uv = isf_FragNormCoord;
    vec3 col = 0.5 + 0.5 * cos(TIME * speed + uv.xyx + vec3(0.0, 2.0, 4.0) + hueShift);
    gl_FragColor = vec4(col, 1.0);
}`

const VERTEX_SOURCE = `attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

const QUAD_VERTS = new Float32Array([
  -1, -1, 1, -1, -1, 1,
  -1, 1, 1, -1, 1, 1,
])

const ISF_BUILTINS = ['RENDERSIZE', 'TIME', 'TIMEDELTA', 'FRAMEINDEX', 'DATE']

export class ShaderLayerRenderer {
  constructor() {
    this.canvas = null
    this.gl = null
    this.program = null
    this.currentCode = ''
    this.currentRekey = 0
    this.error = null
    this.isfInputs = []
    this.isfUniforms = {}
    this.isfBuiltinUniforms = {}
    this.lastTime = 0
    this.frameIndex = 0
    this._init()
  }

  _init() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 1
    this.canvas.height = 1
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) {
      this.error = 'WebGL not supported'
      return
    }
    this.gl = gl

    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTS, gl.STATIC_DRAW)
  }

  compile(code, rekey) {
    if (code === this.currentCode && this.program && rekey === this.currentRekey) return true
    this.currentCode = code
    this.currentRekey = rekey != null ? rekey : 0
    this.error = null
    this.isfInputs = []
    this.isfUniforms = {}
    this.isfBuiltinUniforms = {}

    const gl = this.gl
    if (!gl) return false

    const prepared = prepareIsfShader(code)
    const glsl = prepared.code
    this.isfInputs = prepared.inputs

    if (this.program) {
      gl.deleteProgram(this.program)
      this.program = null
    }

    const vs = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vs, VERTEX_SOURCE)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      this.error = gl.getShaderInfoLog(vs)
      gl.deleteShader(vs)
      return false
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fs, glsl)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      this.error = gl.getShaderInfoLog(fs)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      return false
    }

    this.program = gl.createProgram()
    gl.attachShader(this.program, vs)
    gl.attachShader(this.program, fs)
    gl.linkProgram(this.program)
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      this.error = gl.getProgramInfoLog(this.program)
      gl.deleteProgram(this.program)
      this.program = null
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      return false
    }

    gl.deleteShader(vs)
    gl.deleteShader(fs)

    this.uResolution = gl.getUniformLocation(this.program, 'u_resolution')
    this.uTime = gl.getUniformLocation(this.program, 'u_time')
    this.uMouse = gl.getUniformLocation(this.program, 'u_mouse')
    this.aPosition = gl.getAttribLocation(this.program, 'a_position')

    for (const builtin of ISF_BUILTINS) {
      this.isfBuiltinUniforms[builtin] = gl.getUniformLocation(this.program, builtin)
    }

    for (const input of this.isfInputs) {
      this.isfUniforms[input.NAME] = gl.getUniformLocation(this.program, input.NAME)
    }

    this.lastTime = 0
    this.frameIndex = 0

    return true
  }

  render(time, width, height, mouseX, mouseY, isfParams = {}) {
    const gl = this.gl
    if (!gl || !this.program) return

    const dpr = window.devicePixelRatio || 1
    const w = Math.round(width * dpr)
    const h = Math.round(height * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
      gl.viewport(0, 0, w, h)
    }

    const dt = this.lastTime ? time - this.lastTime : 0
    this.lastTime = time
    this.frameIndex++

    gl.useProgram(this.program)
    if (this.uResolution) gl.uniform2f(this.uResolution, w, h)
    if (this.uTime) gl.uniform1f(this.uTime, time)
    if (this.uMouse) gl.uniform2f(this.uMouse, mouseX || 0, mouseY || 0)

    setBuiltin(this.isfBuiltinUniforms, 'RENDERSIZE', (l) => gl.uniform2f(l, w, h))
    setBuiltin(this.isfBuiltinUniforms, 'TIME', (l) => gl.uniform1f(l, time))
    setBuiltin(this.isfBuiltinUniforms, 'TIMEDELTA', (l) => gl.uniform1f(l, dt))
    setBuiltin(this.isfBuiltinUniforms, 'FRAMEINDEX', (l) => gl.uniform1i(l, this.frameIndex))
    setBuiltin(this.isfBuiltinUniforms, 'DATE', (l) => {
      const now = new Date()
      gl.uniform4f(l, now.getFullYear(), now.getMonth() + 1, now.getDate(),
        now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds())
    })

    for (const input of this.isfInputs) {
      const loc = this.isfUniforms[input.NAME]
      if (!loc) continue
      const val = isfParams[input.NAME]
      const def = getDefaultForInput(input)

      switch (input.TYPE) {
        case 'float':
          gl.uniform1f(loc, val != null ? val : def)
          break
        case 'point2D': {
          const v = val != null ? val : def
          gl.uniform2f(loc, v[0] ?? 0, v[1] ?? 0)
          break
        }
        case 'color': {
          const v = val != null ? val : def
          gl.uniform4f(loc, v[0] ?? 1, v[1] ?? 1, v[2] ?? 1, v[3] ?? 1)
          break
        }
        case 'bool':
          gl.uniform1i(loc, val != null ? val : def)
          break
        case 'long':
          gl.uniform1i(loc, val != null ? Math.round(val) : def)
          break
        default:
          gl.uniform1f(loc, val != null ? val : (def ?? 0))
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.enableVertexAttribArray(this.aPosition)
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  getIsfInputs() {
    return this.isfInputs
  }

  getCanvas() {
    return this.canvas
  }

  getError() {
    return this.error
  }

  dispose() {
    if (this.gl) {
      if (this.program) this.gl.deleteProgram(this.program)
      this.gl = null
    }
    this.canvas = null
    this.program = null
    this.currentCode = ''
    this.currentRekey = 0
    this.error = null
    this.isfInputs = []
    this.isfUniforms = {}
    this.isfBuiltinUniforms = {}
  }
}

function setBuiltin(locations, name, fn) {
  const loc = locations[name]
  if (loc) fn(loc)
}
