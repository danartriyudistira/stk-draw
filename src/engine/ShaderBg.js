/*
  ShaderBg — GLSL background rendering for stk-draw
  --------------------------------------------------
  Planning phase: architecture for rendering a WebGL shader
  beneath the 2D canvas as a dynamic background.

  ARCHITECTURE
  ┌──────────────────────────────────────────────┐
  │  <div class="stage-area">                     │
  │  ┌──────────────────────────────────────────┐ │
  │  │  <canvas #webgl-bg>   (z-index: 0)       │ │
  │  │  WebGL context, renders fullscreen quad  │ │
  │  │  with fragment shader every frame        │ │
  │  ├──────────────────────────────────────────┤ │
  │  │  <canvas #stage>      (z-index: 1)       │ │
  │  │  2D context, existing drawing layer      │ │
  │  └──────────────────────────────────────────┘ │
  └──────────────────────────────────────────────┘

  UNIFORMS (passed every frame)
    - vec2  u_resolution   — canvas size in CSS pixels
    - float u_time         — global time in seconds
    - vec4  u_color        — base background color (rgba)
    - vec2  u_mouse        — pointer position in normalized coords

  USAGE
    const bg = new ShaderBg(canvasElement)
    bg.render(time, resolution, color, mouse)

    To switch shader: bg.setShader(fragmentSource)

  SHADER INPUT
    The user can write a custom fragment shader that
    receives the uniforms above. A library of presets
    will be provided (gradient, noise, wave, etc.).
    The default shader simply draws u_color.
*/

export const DEFAULT_FRAGMENT = `precision highp float;

uniform vec2  u_resolution;
uniform float u_time;
uniform vec4  u_color;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  gl_FragColor = u_color;
}
`

export const PRESETS = {
  solid: { name: 'Solid', frag: DEFAULT_FRAGMENT },
  gradient: { name: 'Gradient', frag: null },
  noise: { name: 'Noise', frag: null },
  wave: { name: 'Wave', frag: null },
}

export class ShaderBg {
  constructor(canvas) {
    this.canvas = canvas
    this.gl = null
    this.program = null
    this.uniforms = {}
    this.fragmentSource = DEFAULT_FRAGMENT
    this.ready = false
  }

  init() {
    const gl = this.canvas.getContext('webgl', { alpha: true })
    if (!gl) return false
    this.gl = gl
    this.ready = true
    return true
  }

  setShader(fragmentSource) {
    this.fragmentSource = fragmentSource || DEFAULT_FRAGMENT
    this._compile()
  }

  _compile() {
    // TODO: compile vertex + fragment shader, link program
    // vertex shader: fullscreen quad (2 triangles)
    // fragment shader: user-provided or DEFAULT_FRAGMENT
  }

  render(time, width, height, color, mouseX, mouseY) {
    if (!this.ready) return
    // TODO: set uniforms, draw fullscreen quad
  }

  resize(w, h) {
    if (!this.canvas) return
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = w * dpr
    this.canvas.height = h * dpr
    this.canvas.style.width = w + 'px'
    this.canvas.style.height = h + 'px'
    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  dispose() {
    // TODO: delete shaders, programs, buffers
    this.ready = false
    this.gl = null
  }
}
