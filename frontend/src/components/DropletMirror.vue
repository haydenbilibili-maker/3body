<script setup lang="ts">
/**
 * 水滴：绝对光滑的镜面。
 * WebGL 片元着色器里光线步进一个泪滴形的距离场，表面是完美镜面，倒映出它此刻经过的地方：
 * 星云、恒星、木星的条纹、地球、联合舰队的阵列……
 * 拖动可以转动它；按住「让它动起来」，它会在一瞬间加速离去，再从远处回来。
 * 没有 WebGL 时显示一张静态的渐变。
 */
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * stage：航程中的哪一站（0–8），决定镜面里倒映出的世界；切换时两站的倒影交叠一秒多。
 * 0 深空 · 1 星云边缘 · 2 掠过恒星 · 3 奥尔特云 · 4 木星 · 5 小行星带 · 6 地月空间 · 7 地球 · 8 联合舰队
 */
const props = defineProps<{ go?: number; stage?: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
let gl: WebGLRenderingContext | null = null
let prog: WebGLProgram | null = null
let raf = 0
let ro: ResizeObserver | undefined
const rot = { yaw: 0.6, pitch: 0.15, vy: 0, vp: 0 }
let dragging = false
let last = { x: 0, y: 0 }
let stageNow = props.stage ?? 0
let stagePrev = stageNow
let mixStart = -1e9
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uRot; uniform float uGo; uniform float uStage; uniform float uPrev; uniform float uMix;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }


mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

float map(vec3 p){
  // 加速时沿 x 方向离去
  p.x -= uGo * uGo * 14.0;
  p = rotX(uRot.y) * rotY(uRot.x) * p;
  // 圆润的头部 + 弧线收拢的尾部（不是直线圆锥），像一滴水银
  const float R = 0.62;
  const float L = 1.55;
  if (p.x > 0.0) return length(p) - R;
  float k = clamp(-p.x / L, 0.0, 1.0);
  float r = R * pow(1.0 - k, 1.7) * (1.0 + 0.35 * k * (1.0 - k));
  float d = length(p.yz) - r;
  if (-p.x > L) d = length(p + vec3(L, 0.0, 0.0));
  return d * 0.55;
}

float noise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

vec3 stars(vec3 d, float amount){
  vec3 col = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    float sc = i == 0 ? 160.0 : 60.0;
    vec3 g = d * sc; vec3 id = floor(g); float h = hash(id + float(i) * 13.1);
    float th = i == 0 ? 0.982 : 0.995;
    if (h > th) { vec3 f = fract(g) - 0.5; col += vec3(1.0, 0.97, 0.9) * smoothstep(0.32, 0.0, length(f)) * (h - th) * (i == 0 ? 55.0 : 160.0); }
  }
  return col * amount;
}

/* 天空中的一个球（行星、月亮）：返回覆盖度与球面坐标 */
float disc(vec3 d, vec3 c, float r, out vec3 q){
  float k = dot(d, c);
  vec3 off = d - c * k;
  float m = length(off) / r;
  q = vec3(off / r, sqrt(max(0.0, 1.0 - m * m)));
  return step(0.0, k) * smoothstep(1.0, 0.985, m);
}

vec3 envStage(vec3 d, float st){
  vec3 base = vec3(0.04, 0.045, 0.055);
  float band = exp(-pow(dot(d, normalize(vec3(0.25, 1.0, 0.35))) * 3.2, 2.0));
  vec3 sunDir = normalize(vec3(0.75, 0.32, 0.58));
  float sun = pow(max(dot(d, sunDir), 0.0), 600.0);
  vec3 q;
  if (st < 0.5) {
    // 深空：银河的一条暗带与星点
    return base + vec3(0.16, 0.15, 0.14) * band + stars(d, 1.0) + vec3(0.49, 0.72, 1.0) * pow(max(dot(d, normalize(vec3(-0.6, -0.1, 0.8))), 0.0), 900.0) * 1.5;
  } else if (st < 1.5) {
    // 星云边缘：恒星诞生区的气体
    float n = fbm(d * 3.0 + vec3(0.0, 0.0, uTime * 0.01));
    float n2 = fbm(d * 6.0 + 4.0);
    vec3 gas = mix(vec3(0.42, 0.16, 0.30), vec3(0.12, 0.38, 0.42), n2) * smoothstep(0.35, 0.8, n) * 1.3;
    return base + gas + stars(d, 0.8);
  } else if (st < 2.5) {
    // 掠过恒星：一个巨大的日面与日冕
    vec3 c = normalize(vec3(0.6, 0.15, 0.78));
    float a = acos(clamp(dot(d, c), -1.0, 1.0));
    float corona = exp(-a * 5.0) * (0.8 + 0.4 * fbm(d * 12.0 + uTime * 0.05));
    return base * 0.5 + vec3(1.0, 0.78, 0.5) * corona * 2.2 + vec3(1.0, 0.95, 0.85) * smoothstep(0.33, 0.30, a) * 4.0 + stars(d, 0.3);
  } else if (st < 3.5) {
    // 奥尔特云：冰冷、稀疏，远处一颗暗淡的太阳和几颗彗星
    float ice = smoothstep(0.55, 0.9, fbm(d * 9.0)) * 0.12;
    vec3 col = base + vec3(0.55, 0.7, 0.85) * ice + stars(d, 1.2) + vec3(1.0, 0.9, 0.75) * sun * 1.5;
    float comet = pow(max(dot(d, normalize(vec3(-0.4, 0.5, 0.7))), 0.0), 3000.0) * 3.0;
    return col + vec3(0.7, 0.85, 1.0) * comet;
  } else if (st < 4.5) {
    // 木星：铺满半边天空的条纹
    float cov = disc(d, normalize(vec3(-0.35, 0.25, 0.9)), 0.62, q);
    float lat = q.y + 0.08 * fbm(vec3(q.xy * 6.0, uTime * 0.02));
    vec3 bands = mix(vec3(0.62, 0.48, 0.34), vec3(0.86, 0.76, 0.62), 0.5 + 0.5 * sin(lat * 22.0));
    bands *= 0.35 + 0.65 * clamp(dot(q, normalize(vec3(0.6, 0.3, 0.7))), 0.0, 1.0);
    return mix(base + stars(d, 0.9) + vec3(1.0, 0.9, 0.75) * sun * 2.0, bands, cov);
  } else if (st < 5.5) {
    // 小行星带：碎石与冰尘
    vec3 g = d * 38.0; vec3 id = floor(g); float h = hash(id);
    float rock = step(0.93, h) * smoothstep(0.5, 0.15, length(fract(g) - 0.5 + 0.1 * (hash(id + 3.0) - 0.5)));
    float dust = exp(-pow(dot(d, normalize(vec3(0.1, 1.0, 0.2))) * 5.0, 2.0)) * 0.12;
    return base + vec3(0.45, 0.42, 0.38) * rock * (0.4 + h) + vec3(0.5, 0.48, 0.44) * dust + stars(d, 0.7) + vec3(1.0, 0.9, 0.75) * sun * 3.0;
  } else if (st < 6.5) {
    // 地月空间：灰白的月面与强烈的日光
    float cov = disc(d, normalize(vec3(-0.5, -0.1, 0.86)), 0.42, q);
    float craters = fbm(vec3(q.xy * 7.0, 1.0));
    vec3 moon = vec3(0.6, 0.6, 0.58) * (0.5 + 0.6 * craters) * clamp(dot(q, normalize(vec3(0.8, 0.3, 0.5))) + 0.15, 0.0, 1.0);
    return mix(base + stars(d, 0.6) + vec3(1.0, 0.95, 0.85) * sun * 6.0, moon, cov);
  } else if (st < 7.5) {
    // 地球：蓝色的海、白色的云、一圈大气
    vec3 c = normalize(vec3(-0.25, -0.35, 0.9));
    float cov = disc(d, c, 0.55, q);
    float land = smoothstep(0.52, 0.6, fbm(vec3(q.xy * 3.0, 2.0)));
    float cloud = smoothstep(0.55, 0.75, fbm(vec3(q.xy * 5.0 + uTime * 0.01, 5.0)));
    vec3 surf = mix(vec3(0.05, 0.18, 0.42), vec3(0.22, 0.32, 0.18), land);
    surf = mix(surf, vec3(0.92), cloud) * clamp(dot(q, normalize(vec3(0.7, 0.4, 0.6))) + 0.1, 0.0, 1.0);
    float m = length(d - c * dot(d, c)) / 0.55;
    float rim = exp(-abs(m - 1.0) * 40.0) * step(0.0, dot(d, c));
    return mix(base + stars(d, 0.5), surf, cov) + vec3(0.35, 0.6, 1.0) * rim * 0.8;
  }
  // 联合舰队：两千艘恒星级战舰的灯，排成整齐的阵列
  vec3 col = base + stars(d, 0.4) + vec3(1.0, 0.9, 0.75) * sun * 2.0;
  vec2 uv = vec2(atan(d.x, d.z), d.y);
  vec2 cell = uv * vec2(28.0, 34.0);
  vec2 f = fract(cell) - 0.5; vec2 id = floor(cell);
  float inFormation = step(abs(d.y + 0.05), 0.35) * step(0.0, d.z);
  float light = smoothstep(0.12, 0.0, length(f)) * inFormation * step(0.15, hash(vec3(id, 7.0)));
  return col + vec3(0.75, 0.85, 1.0) * light * 1.6;
}

vec3 env(vec3 d){
  vec3 a = envStage(d, uStage);
  if (uMix >= 0.999) return a;
  return mix(envStage(d, uPrev), a, uMix);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, 3.4);
  vec3 rd = normalize(vec3(uv, -1.6));
  float t = 0.0; float d = 0.0; bool hit = false;
  for (int i = 0; i < 140; i++) {
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
  /* 换站时两站的倒影交叠 1.4 秒 */
  const target = props.stage ?? 0
  if (target !== stageNow) {
    stagePrev = stageNow
    stageNow = target
    mixStart = now
  }
  const mix = reduced ? 1 : Math.min(1, (now - mixStart) / 1400)
  gl.uniform1f(gl.getUniformLocation(prog, 'uStage'), stageNow)
  gl.uniform1f(gl.getUniformLocation(prog, 'uPrev'), stagePrev)
  gl.uniform1f(gl.getUniformLocation(prog, 'uMix'), mix)
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
