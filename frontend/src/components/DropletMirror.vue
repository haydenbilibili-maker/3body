<script setup lang="ts">
/**
 * 水滴：绝对光滑的镜面。
 * WebGL 片元着色器里光线步进一个泪滴形的距离场，表面是完美镜面，倒映出银河、星点和一颗远处的太阳。
 * 拖动可以转动它；按住「让它动起来」，它会在一瞬间加速离去，再从远处回来。
 * 没有 WebGL 时显示一张静态的渐变。
 */
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ go?: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
let gl: WebGLRenderingContext | null = null
let prog: WebGLProgram | null = null
let raf = 0
let ro: ResizeObserver | undefined
const rot = { yaw: 0.6, pitch: 0.15, vy: 0, vp: 0 }
let dragging = false
let last = { x: 0, y: 0 }

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uRot; uniform float uGo;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }

float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2;
  float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
  vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv);
  float y2 = y * y * l2; float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

float map(vec3 p){
  // 加速时沿 x 方向离去
  p.x -= uGo * uGo * 14.0;
  p = rotX(uRot.y) * rotY(uRot.x) * p;
  return sdRoundCone(p, vec3(0.35, 0.0, 0.0), vec3(-1.25, 0.0, 0.0), 0.62, 0.015);
}

vec3 env(vec3 d){
  vec3 col = vec3(0.045, 0.05, 0.06);
  float band = exp(-pow(dot(d, normalize(vec3(0.25, 1.0, 0.35))) * 3.2, 2.0));
  col += vec3(0.16, 0.15, 0.14) * band;
  for (int i = 0; i < 2; i++) {
    float sc = i == 0 ? 160.0 : 60.0;
    vec3 g = d * sc; vec3 id = floor(g); float h = hash(id + float(i) * 13.1);
    float th = i == 0 ? 0.982 : 0.995;
    if (h > th) { vec3 f = fract(g) - 0.5; col += vec3(1.0, 0.97, 0.9) * smoothstep(0.32, 0.0, length(f)) * (h - th) * (i == 0 ? 55.0 : 160.0); }
  }
  col += vec3(1.0, 0.86, 0.62) * pow(max(dot(d, normalize(vec3(0.75, 0.32, 0.58))), 0.0), 600.0) * 4.0;
  col += vec3(0.49, 0.72, 1.0) * pow(max(dot(d, normalize(vec3(-0.6, -0.1, 0.8))), 0.0), 900.0) * 1.5;
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, 3.4);
  vec3 rd = normalize(vec3(uv, -1.6));
  float t = 0.0; float d = 0.0; bool hit = false;
  for (int i = 0; i < 90; i++) {
    d = map(ro + rd * t);
    if (d < 0.0008) { hit = true; break; }
    t += d;
    if (t > 20.0) break;
  }
  vec3 col;
  // 背景是同一片星空，暗一些
  vec3 bg = env(rd) * 0.55;
  if (hit) {
    vec3 p = ro + rd * t;
    vec2 e = vec2(0.0008, 0.0);
    vec3 n = normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
    vec3 r = reflect(rd, n);
    col = env(r) * 1.05;
    // 几乎全反射；掠射角处多一点亮边
    float fr = pow(1.0 - max(dot(-rd, n), 0.0), 4.0);
    col += vec3(0.9, 0.92, 0.95) * fr * 0.25;
  } else {
    col = bg;
    // 加速离去时留下的一道光
    float streak = exp(-abs(uv.y) * 60.0) * smoothstep(0.0, 0.4, uGo) * smoothstep(1.0, 0.6, uGo) * step(-0.2, uv.x);
    col += vec3(0.85, 0.88, 0.95) * streak * 0.8;
  }
  col = pow(col, vec3(0.92));
  gl_FragColor = vec4(col, 1.0);
}
`

function compile(type: number, src: string) {
  const s = gl!.createShader(type)!
  gl!.shaderSource(s, src)
  gl!.compileShader(s)
  if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(s) ?? 'shader')
  return s
}

function resize() {
  const c = canvas.value
  if (!c || !gl) return
  const dpr = Math.min(1.5, window.devicePixelRatio || 1)
  c.width = Math.floor(c.clientWidth * dpr)
  c.height = Math.floor(c.clientHeight * dpr)
  gl.viewport(0, 0, c.width, c.height)
}

function frame(now: number) {
  if (!gl || !prog) return
  if (!dragging) {
    rot.yaw += rot.vy + 0.0016
    rot.pitch += rot.vp
    rot.vy *= 0.95
    rot.vp *= 0.95
    rot.pitch += (0.15 - rot.pitch) * 0.01
  }
  gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.value!.width, canvas.value!.height)
  gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), now / 1000)
  gl.uniform2f(gl.getUniformLocation(prog, 'uRot'), rot.yaw, rot.pitch)
  gl.uniform1f(gl.getUniformLocation(prog, 'uGo'), props.go ?? 0)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
  raf = requestAnimationFrame(frame)
}

function down(e: PointerEvent) {
  dragging = true
  last = { x: e.clientX, y: e.clientY }
  canvas.value?.setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (!dragging) return
  const dx = (e.clientX - last.x) * 0.008
  const dy = (e.clientY - last.y) * 0.008
  rot.yaw += dx
  rot.pitch = Math.max(-1.2, Math.min(1.2, rot.pitch + dy))
  rot.vy = dx * 0.5
  rot.vp = dy * 0.2
  last = { x: e.clientX, y: e.clientY }
}
function up() {
  dragging = false
}

onMounted(() => {
  const c = canvas.value
  if (!c) return
  try {
    gl = c.getContext('webgl', { antialias: true, preserveDrawingBuffer: true })
    if (!gl) throw new Error('no webgl')
    prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link')
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    resize()
    ro = new ResizeObserver(resize)
    ro.observe(c)
    raf = requestAnimationFrame(frame)
  } catch {
    failed.value = true
  }
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
})
</script>

<template>
  <div class="mirror" :class="{ failed }">
    <canvas
      ref="canvas"
      class="cv"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
    ></canvas>
  </div>
</template>

<style scoped>
.mirror { position: relative; width: 100%; height: 100%; min-height: 22rem; background: #0b0c0e; }
.cv { display: block; width: 100%; height: 100%; min-height: 22rem; cursor: grab; touch-action: none; }
.cv:active { cursor: grabbing; }
.failed { background: radial-gradient(ellipse at 45% 50%, #d8dde3 0%, #6b7280 18%, #0b0c0e 40%); }
.failed .cv { visibility: hidden; }
</style>
