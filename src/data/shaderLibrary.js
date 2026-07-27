const AURORA = {
  name: 'Aurora Waves',
  category: 'aurora',
  code: `/*{
  "DESCRIPTION": "Northern lights / aurora borealis effect",
  "CREDIT": "STK",
  "ISFVSN": "2.0",
  "INPUTS": [
    {"NAME": "speed", "TYPE": "float", "MIN": 0.1, "MAX": 3.0, "DEFAULT": 1.0},
    {"NAME": "scale", "TYPE": "float", "MIN": 1.0, "MAX": 8.0, "DEFAULT": 3.0},
    {"NAME": "intensity", "TYPE": "float", "MIN": 0.2, "MAX": 1.5, "DEFAULT": 0.8},
    {"NAME": "colorShift", "TYPE": "float", "MIN": 0.0, "MAX": 6.2832, "DEFAULT": 0.0},
    {"NAME": "lightColor", "TYPE": "color", "DEFAULT": [0.1, 0.8, 0.3, 1.0]},
    {"NAME": "darkColor", "TYPE": "color", "DEFAULT": [0.0, 0.05, 0.15, 1.0]}
  ]
}*/

precision highp float;

void main() {
    vec2 uv = isf_FragNormCoord;
    float t = TIME * speed;

    float wave1 = sin(uv.x * scale * 3.0 + t) * cos(uv.y * scale * 2.0 - t * 0.7);
    float wave2 = sin(uv.x * scale * 5.0 - t * 1.3) * 0.5;
    float wave3 = cos(uv.y * scale * 4.0 + t * 0.5 + colorShift) * 0.7;

    float h = wave1 + wave2 + wave3;
    h = h * 0.5 + 0.5;

    float band = smoothstep(uv.y - 0.2, uv.y + 0.3, h * 1.2 - 0.3);
    float alpha = band * intensity * (1.0 - uv.y * 0.6);

    vec3 col = mix(darkColor.rgb, lightColor.rgb, band);
    gl_FragColor = vec4(col * alpha, alpha * lightColor.a);
}`
}

const PATTERN_MANDALA = {
  name: 'Mandala Pattern',
  category: 'pattern',
  code: `/*{
  "DESCRIPTION": "Rotating geometric mandala pattern",
  "CREDIT": "STK",
  "ISFVSN": "2.0",
  "INPUTS": [
    {"NAME": "speed", "TYPE": "float", "MIN": 0.0, "MAX": 2.0, "DEFAULT": 0.5},
    {"NAME": "sides", "TYPE": "float", "MIN": 3.0, "MAX": 16.0, "DEFAULT": 8.0},
    {"NAME": "zoom", "TYPE": "float", "MIN": 0.5, "MAX": 5.0, "DEFAULT": 2.0},
    {"NAME": "thickness", "TYPE": "float", "MIN": 0.01, "MAX": 0.2, "DEFAULT": 0.04},
    {"NAME": "color1", "TYPE": "color", "DEFAULT": [1.0, 0.3, 0.5, 1.0]},
    {"NAME": "color2", "TYPE": "color", "DEFAULT": [0.3, 0.6, 1.0, 1.0]}
  ]
}*/

precision highp float;

void main() {
    vec2 uv = (isf_FragNormCoord - 0.5) * zoom;
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    float t = TIME * speed;

    float sector = mod(angle + t * 0.3, 6.2832 / sides) - 3.1416 / sides;
    float d1 = abs(sector) * radius;
    float d2 = abs(radius - sin(angle * sides + t) * 0.3 - 0.4);

    float line = smoothstep(thickness, 0.0, min(d1, d2));
    line += smoothstep(thickness * 0.5, 0.0, abs(radius - 0.6 + sin(angle * 3.0 + t) * 0.15));

    float fade = 1.0 - radius;
    vec3 col = mix(color1.rgb, color2.rgb, sin(angle * 2.0 + t) * 0.5 + 0.5);
    gl_FragColor = vec4(col * line * fade, line * fade);
}`
}

const PATTERN_VORONOI = {
  name: 'Cellular Voronoi',
  category: 'pattern',
  code: `/*{
  "DESCRIPTION": "Animated voronoi / cellular pattern",
  "CREDIT": "STK",
  "ISFVSN": "2.0",
  "INPUTS": [
    {"NAME": "speed", "TYPE": "float", "MIN": 0.0, "MAX": 2.0, "DEFAULT": 0.3},
    {"NAME": "density", "TYPE": "float", "MIN": 2.0, "MAX": 20.0, "DEFAULT": 8.0},
    {"NAME": "edgeWidth", "TYPE": "float", "MIN": 0.01, "MAX": 0.3, "DEFAULT": 0.06},
    {"NAME": "colorA", "TYPE": "color", "DEFAULT": [0.1, 0.1, 0.3, 1.0]},
    {"NAME": "colorB", "TYPE": "color", "DEFAULT": [0.8, 0.5, 1.0, 1.0]}
  ]
}*/

precision highp float;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float voronoi(vec2 uv, float density) {
    vec2 g = floor(uv * density);
    vec2 f = fract(uv * density);
    float res = 1.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 point = offset + hash(g + offset) * 0.7 - f;
            res = min(res, dot(point, point));
        }
    }
    return sqrt(res);
}

void main() {
    vec2 uv = isf_FragNormCoord;
    float t = TIME * speed;

    float v = voronoi(uv + vec2(t * 0.1, cos(t * 0.7) * 0.1), density);
    float edge = smoothstep(edgeWidth, 0.0, v);

    vec3 col = mix(colorA.rgb, colorB.rgb, v * 1.5);
    col += edge * 0.3;
    gl_FragColor = vec4(col, 1.0);
}`
}

const KINETIC_LIGHT = {
  name: 'Particle Streams',
  category: 'kinetic_light',
  code: `/*{
  "DESCRIPTION": "Flowing particle / light stream effect",
  "CREDIT": "STK",
  "ISFVSN": "2.0",
  "INPUTS": [
    {"NAME": "speed", "TYPE": "float", "MIN": 0.1, "MAX": 3.0, "DEFAULT": 1.0},
    {"NAME": "count", "TYPE": "float", "MIN": 2.0, "MAX": 20.0, "DEFAULT": 8.0},
    {"NAME": "glowSize", "TYPE": "float", "MIN": 0.01, "MAX": 0.3, "DEFAULT": 0.08},
    {"NAME": "trailLength", "TYPE": "float", "MIN": 0.1, "MAX": 2.0, "DEFAULT": 0.6},
    {"NAME": "lightColor", "TYPE": "color", "DEFAULT": [0.4, 0.8, 1.0, 1.0]},
    {"NAME": "bgColor", "TYPE": "color", "DEFAULT": [0.01, 0.02, 0.05, 1.0]}
  ]
}*/

precision highp float;

float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
        mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
        f.y
    );
}

void main() {
    vec2 uv = isf_FragNormCoord;
    float t = TIME * speed;
    vec3 col = bgColor.rgb;

    for (float i = 0.0; i < 20.0; i++) {
        if (i >= count) break;
        float id = i / count;
        vec2 pos = vec2(
            noise(vec2(id * 3.7, t * 0.3 + id)) * 0.8 + 0.1,
            fract(id * 1.7 + t * 0.2) * 0.8 + 0.1
        );
        float trail = uv.y - pos.y;
        float dist = length(uv - pos - vec2(trail * trailLength * 0.15, 0.0));
        float brightness = glowSize / (dist + glowSize * 0.5);
        brightness *= smoothstep(1.0, 0.0, abs(trail) * 2.0);
        col += lightColor.rgb * brightness * 0.4;
    }

    gl_FragColor = vec4(col, 1.0);
}`
}

const LINE_ART_WAVES = {
  name: 'Wave Lines',
  category: 'line_art',
  code: `/*{
  "DESCRIPTION": "Generative wave line art",
  "CREDIT": "STK",
  "ISFVSN": "2.0",
  "INPUTS": [
    {"NAME": "speed", "TYPE": "float", "MIN": 0.0, "MAX": 2.0, "DEFAULT": 0.5},
    {"NAME": "lines", "TYPE": "float", "MIN": 3.0, "MAX": 30.0, "DEFAULT": 12.0},
    {"NAME": "amplitude", "TYPE": "float", "MIN": 0.05, "MAX": 0.5, "DEFAULT": 0.2},
    {"NAME": "lineWidth", "TYPE": "float", "MIN": 0.001, "MAX": 0.02, "DEFAULT": 0.004},
    {"NAME": "colorA", "TYPE": "color", "DEFAULT": [1.0, 0.4, 0.2, 1.0]},
    {"NAME": "colorB", "TYPE": "color", "DEFAULT": [0.2, 0.6, 1.0, 1.0]}
  ]
}*/

precision highp float;

void main() {
    vec2 uv = isf_FragNormCoord;
    float t = TIME * speed;

    float dist = 1.0;
    for (float i = 0.0; i < 30.0; i++) {
        if (i >= lines) break;
        float y = i / (lines - 1.0);
        float wave = sin(uv.x * 6.2832 * 2.0 + t + i * 0.5) * amplitude;
        wave += sin(uv.x * 6.2832 * 3.7 - t * 0.7 + i) * amplitude * 0.6;
        float d = abs(uv.y - y - wave);
        dist = min(dist, d);
    }

    float line = 1.0 - smoothstep(lineWidth * 0.5, lineWidth, dist);
    vec3 col = mix(colorA.rgb, colorB.rgb, uv.y);
    gl_FragColor = vec4(col * line, line);
}`
}

const LINE_ART_CIRCUITS = {
  name: 'Circuit Board',
  category: 'line_art',
  code: `/*{
  "DESCRIPTION": "Circuit board / tech line art",
  "CREDIT": "STK",
  "ISFVSN": "2.0",
  "INPUTS": [
    {"NAME": "speed", "TYPE": "float", "MIN": 0.0, "MAX": 1.0, "DEFAULT": 0.3},
    {"NAME": "density", "TYPE": "float", "MIN": 3.0, "MAX": 15.0, "DEFAULT": 7.0},
    {"NAME": "lineColor", "TYPE": "color", "DEFAULT": [0.2, 0.9, 0.5, 1.0]},
    {"NAME": "bgColor", "TYPE": "color", "DEFAULT": [0.02, 0.05, 0.03, 1.0]}
  ]
}*/

precision highp float;

float hash3(vec2 p) {
    return fract(sin(dot(p, vec2(234.5, 543.2))) * 65432.1);
}

void main() {
    vec2 uv = isf_FragNormCoord;
    float t = TIME * speed;

    vec2 g = floor(uv * density);
    vec2 f = fract(uv * density);
    float h = hash3(g);

    float hLine = smoothstep(0.45, 0.47, f.y) * step(0.3, h);
    float vLine = smoothstep(0.45, 0.47, f.x) * step(0.6, h);

    float dot1 = 1.0 - smoothstep(0.03, 0.04, length(f - 0.5)) * step(0.8, h);

    float pulse = sin(g.x * 3.0 + g.y * 5.0 + t * 2.0) * 0.5 + 0.5;
    pulse *= step(0.7, hash3(g + vec2(t)));

    float circuit = max(max(hLine, vLine), dot1) + pulse * 0.5;
    vec3 col = mix(bgColor.rgb, lineColor.rgb, circuit);
    gl_FragColor = vec4(col, 1.0);
}`
}

const KINETIC_GRID = {
  name: '3D Terrain Grid',
  category: 'kinetic_grid',
  code: `/*{
  "DESCRIPTION": "3D wireframe terrain / grid surface",
  "CREDIT": "STK",
  "ISFVSN": "2.0",
  "INPUTS": [
    {"NAME": "speed", "TYPE": "float", "MIN": 0.0, "MAX": 2.0, "DEFAULT": 0.5},
    {"NAME": "resolution", "TYPE": "float", "MIN": 10.0, "MAX": 60.0, "DEFAULT": 30.0},
    {"NAME": "height", "TYPE": "float", "MIN": 0.1, "MAX": 1.0, "DEFAULT": 0.4},
    {"NAME": "waveCount", "TYPE": "float", "MIN": 1.0, "MAX": 5.0, "DEFAULT": 3.0},
    {"NAME": "lineColor", "TYPE": "color", "DEFAULT": [0.3, 0.7, 1.0, 1.0]},
    {"NAME": "bgColor", "TYPE": "color", "DEFAULT": [0.02, 0.03, 0.08, 1.0]}
  ]
}*/

precision highp float;

float hash4(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash4(i), hash4(i + vec2(1,0)), f.x),
        mix(hash4(i + vec2(0,1)), hash4(i + vec2(1,1)), f.x),
        f.y
    );
}

float fbm(vec2 p) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++) {
        v += amp * noise2(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = isf_FragNormCoord;
    float t = TIME * speed;

    float gridX = abs(fract(uv.x * resolution) - 0.5) * 2.0;
    float gridY = abs(fract(uv.y * resolution) - 0.5) * 2.0;
    float grid = min(gridX, gridY);

    float wave = fbm(uv * 3.0 + vec2(t * 0.3, t * 0.2)) * waveCount;
    float offset = wave * height;
    float horizon = smoothstep(uv.y + offset - 0.1, uv.y + offset + 0.1, 0.5);

    float line = 1.0 - smoothstep(0.02, 0.04, grid);
    line *= horizon;
    float fade = 1.0 - uv.y * 0.5;

    vec3 col = mix(bgColor.rgb, lineColor.rgb, line * fade);
    col += lineColor.rgb * offset * 0.15;
    gl_FragColor = vec4(col, 1.0);
}`
}

const KINETIC_GRID_RINGS = {
  name: 'Concentric Rings',
  category: 'kinetic_grid',
  code: `/*{
  "DESCRIPTION": "Pulsing concentric rings / radar effect",
  "CREDIT": "STK",
  "ISFVSN": "2.0",
  "INPUTS": [
    {"NAME": "speed", "TYPE": "float", "MIN": 0.1, "MAX": 2.0, "DEFAULT": 0.8},
    {"NAME": "rings", "TYPE": "float", "MIN": 3.0, "MAX": 25.0, "DEFAULT": 10.0},
    {"NAME": "pulseAmp", "TYPE": "float", "MIN": 0.0, "MAX": 0.3, "DEFAULT": 0.1},
    {"NAME": "centerX", "TYPE": "float", "MIN": 0.0, "MAX": 1.0, "DEFAULT": 0.5},
    {"NAME": "centerY", "TYPE": "float", "MIN": 0.0, "MAX": 1.0, "DEFAULT": 0.5},
    {"NAME": "colorA", "TYPE": "color", "DEFAULT": [0.2, 0.9, 1.0, 1.0]},
    {"NAME": "colorB", "TYPE": "color", "DEFAULT": [0.9, 0.2, 0.5, 1.0]}
  ]
}*/

precision highp float;

void main() {
    vec2 uv = isf_FragNormCoord;
    vec2 center = vec2(centerX, centerY);
    float dist = length(uv - center);
    float angle = atan(uv.y - center.y, uv.x - center.x);
    float t = TIME * speed;

    float ring = fract(dist * rings - t);
    ring = 1.0 - smoothstep(0.0, 0.08, ring) * smoothstep(0.15, 0.08, ring);

    float pulse = sin(dist * 20.0 - t * 3.0) * pulseAmp;
    ring += pulse * (1.0 - dist);

    float spiral = sin(angle * 3.0 + dist * 8.0 - t) * 0.5 + 0.5;
    ring += spiral * 0.1 * (1.0 - dist);

    float fade = 1.0 - dist;
    vec3 col = mix(colorA.rgb, colorB.rgb, dist);
    col *= ring * fade;

    gl_FragColor = vec4(col, ring * fade);
}`
}

export const SHADER_LIBRARY = [
  { id: 'aurora', label: 'Aurora', shaders: [AURORA] },
  { id: 'pattern', label: 'Pattern', shaders: [PATTERN_MANDALA, PATTERN_VORONOI] },
  { id: 'kinetic_light', label: 'Kinetic Light', shaders: [KINETIC_LIGHT] },
  { id: 'line_art', label: 'Line Art', shaders: [LINE_ART_WAVES, LINE_ART_CIRCUITS] },
  { id: 'kinetic_grid', label: 'Kinetic Grid', shaders: [KINETIC_GRID, KINETIC_GRID_RINGS] },
]
