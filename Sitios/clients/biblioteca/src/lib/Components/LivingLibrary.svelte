<script>
  /**
   * Fondo de todo el sitio: la foto del salón, viva en WebGL con su mapa de profundidad.
   * Parallax por profundidad con el scroll y el mouse, lámparas que se balancean, plantas con
   * brisa, haces de sol, polvo en suspensión y un libro abierto que pasa hojas al scrollear.
   * Perillas del CSS (en .bib): --fondo-transparencia la hace el CSS solo; --fondo-calma (shader +
   * velo del CSS) y --fondo-contraste (shader) se leen de acá. Se releen al cambiar el tamaño de la
   * ventana o el style del contenedor, así un cambio en línea (FondoRegulador) se ve en vivo.
   *
   * La cámara recorre el salón a lo largo de todo el sitio, como una matriz: cada página es una
   * fila (un tramo del recorrido, en el orden de `pages`) y cada sección de la página es una
   * columna (una parte del tramo). Al cambiar de página, la cámara viaja hasta el tramo nuevo.
   *
   * Sin WebGL queda la foto fija. Con `?fondo` en la URL se muestra la celda actual.
   */
  import { afterNavigate } from "$app/navigation";
  import { onMount } from "svelte";

  /** Foto del salón. */
  export let image;
  /** Mapas de la misma foto: R = profundidad, G = plantas, B = lámparas. */
  export let maps;
  /** Rutas en orden: una fila de la matriz por página. */
  export let pages = [];
  /** Secciones de la página: una columna por sección. */
  export let sections = "main > section";
  /** 0 = de día, 1 = de noche (se apaga el sol y quedan las lámparas). */
  export let night = 0;

  const MAX_DPR = 1.75;
  // Profundidad que queda quieta con el parallax
  const FOCUS = 0.3;
  // Píxeles de scroll por cada hoja del libro que pasa
  const PAGE_EVERY = 170;

  // Lámparas colgantes, en píxeles de la foto original (1024 × 551): x, techo, base, medio ancho
  const LAMPS = [
    [113, 0, 74, 16],
    [138, 0, 30, 12],
    [170, 0, 68, 16],
    [236, 0, 94, 16],
    [484, 0, 182, 34],
    [603, 0, 80, 16],
  ];

  // Libro abierto sobre la mesa, medido sobre la foto original (1024 × 551)
  const BOOK = {
    sF: [333, 383.2], // lomo: punto lejano
    sN: [333.7, 388.6], // lomo: punto cercano
    rF: [381.5, 384.4], // borde exterior de la página derecha
    rN: [382.5, 387.9],
    lF: [300, 384.5], // borde exterior de la página izquierda
    lN: [298.3, 388.2],
    lift: 40, // altura aparente de una hoja parada
    depth: 0.36, // profundidad del libro en el mapa
  };

  const vertex = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const fragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uImg, uMap;
uniform vec4 uRect;       // parte visible de la foto (origen, tamaño) en uv
uniform vec2 uOff;        // desplazamiento de cámara (mouse + scroll)
uniform float uTime, uNight, uFocus, uAspect, uCalm, uContrast;
uniform vec4 uLamp[6];    // lámparas colgantes: x, techo, base, medio ancho (uv)
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float n1(float x) {
  float i = floor(x), f = fract(x);
  f = f * f * (3. - 2. * f);
  return mix(hash(vec2(i, 0.)), hash(vec2(i + 1., 0.)), f);
}

void main() {
  vec2 uv = uRect.xy + vUv * uRect.zw;
  float t = uTime;

  // 1. Parallax por profundidad: lo cercano se desplaza más que lo lejano
  vec2 p = uv;
  for (int i = 0; i < 6; i++) { float d = texture2D(uMap, p).r; p = uv - uOff * (d - uFocus); }

  // 2. Lámparas colgantes que se balancean desde el techo
  for (int i = 0; i < 6; i++) {
    vec4 L = uLamp[i];
    float wx = 1. - smoothstep(L.w * .85, L.w * 1.25, abs(p.x - L.x));
    float wy = clamp((p.y - L.y) / (L.z - L.y), 0., 1.) * (1. - smoothstep(L.z, L.z + .006, p.y));
    float ang = .03 * sin(t * (1.05 + float(i) * .13) + float(i) * 1.7);
    p.x -= ang * (p.y - L.y) / uAspect * wx * wy;
  }

  vec4 m = texture2D(uMap, p);
  float depth = m.r;

  // 3. Plantas, árbol y enredaderas meciéndose con ráfagas de brisa
  float gust = .55 + .45 * sin(t * .29) * sin(t * .13 + 1.3);
  vec2 wob = vec2(
      sin(t * 1.1 + p.y * 40. + 1.6 * sin(t * .5 + p.x * 28.)),
      cos(t * .9 + p.x * 34. + p.y * 10.)
    ) * vec2(.0030, .0022) * m.g * gust * (.5 + depth * 1.2);
  p += wob;

  vec3 col = texture2D(uImg, p).rgb;
  float lum = dot(col, vec3(.299, .587, .114));

  // 4. Luz moteada: sombras de hojas sobre lo que toca el sol
  float warm = clamp((col.r - col.b) * 2.2, 0., 1.);
  float dapple = noise(p * vec2(9., 16.) + vec2(t * .07, t * .03)) * noise(p * vec2(17., 26.) - vec2(t * .05, 0.));
  col *= 1. + (dapple - .12) * .32 * smoothstep(.45, .85, lum) * warm * (1. - uNight);

  // 5. Haces de sol: luz paralela que entra por el ventanal y baja en diagonal hacia el piso.
  //    Se proyecta cada punto hacia atrás hasta el plano de la ventana para saber si le llega luz
  //    y por qué parte del vidrio pasó (los marcos dejan franjas de sombra).
  vec2 q = vec2(uv.x * uAspect, uv.y);
  vec2 dir = normalize(vec2(1., .5));
  float tt = (q.x - .2 * uAspect) / dir.x;
  float yw = q.y - dir.y * tt;
  float inWin = smoothstep(-.02, .04, yw) * (1. - smoothstep(.66, .76, yw));
  float bars = smoothstep(.006, .02, abs(yw - .2)) * smoothstep(.006, .02, abs(yw - .44)) * (.75 + .25 * smoothstep(.004, .016, abs(yw - .56)));
  float streak = .55 + .45 * n1(yw * 55. + t * .15) * n1(yw * 21. - t * .09 + 4.);
  float haze = .75 + .25 * noise(vec2(tt * 3. - t * .05, yw * 8.));
  float shaft = inWin * bars * streak * haze * smoothstep(-.05, .18, tt) * exp(-max(tt, 0.) * .85);
  float shaftK = .5 * (1. - uNight * .9) * (1. - lum * .45);
  col += vec3(1., .83, .56) * shaft * shaftK;
  // donde el haz toca el piso, la luz se posa más brillante
  float floorHit = smoothstep(.72, .8, uv.y) * shaft;
  col += col * vec3(.9, .65, .35) * floorHit * .55 * (1. - uNight);

  // 6. Lámparas: titilan y resplandecen
  float flick = .88 + .08 * sin(t * 2.1) + .04 * sin(t * 7.3 + 1.1) + .03 * n1(t * 4.);
  float g = m.b;
  vec3 lamp = vec3(1., .68, .34) * g * g * flick;

  // 7. Noche: se apaga el sol y quedan las lámparas
  vec3 nightCol = col * vec3(.3, .33, .5) * (1. - .15 * depth);
  nightCol += col * vec3(1., .7, .42) * smoothstep(0., .9, g) * .7;
  col = mix(col, nightCol, uNight);
  col += lamp * (.25 + uNight * .4);

  // 8. Calma (--fondo-calma): menos saturación, para que los lomos y las lámparas no le compitan al
  //    contenido. El brillo y el tinte azul marino los pone la capa de .bib-bg::after
  col = mix(col, vec3(dot(col, vec3(.2126, .7152, .0722))), uCalm * .5);

  // 9. Contraste (--fondo-contraste): 1 = la foto tal cual; menos, más plana; más, más marcada
  col = clamp((col - .5) * uContrast + .5, 0., 1.);

  vec2 v = vUv - .5;
  col *= 1. - dot(v, v) * .5;
  col += (hash(vUv * 1000. + fract(t) * 50.) - .5) * .022;
  gl_FragColor = vec4(col, 1.);
}`;

  let bgEl;
  let glCanvas;
  let dustCanvas;
  let ready = false;
  let debug = false;
  let hud = "";

  // Perillas del shader, leídas del CSS
  let calm = 0; // --fondo-calma, de 0 a 1
  let contrast = 1; // --fondo-contraste, de 0.5 a 1.5

  // Matriz: secciones de la página actual, alto del documento y página actual
  let tops = [];
  let docHeight = 0;
  let row = 0;

  // Render
  let gl = null;
  let uniforms = {};
  let dust = null;
  let sprite = null;
  let aspect = 1; // ancho / alto de la foto
  let viewW = 1; // tamaño del canvas en px CSS
  let viewH = 1;
  let reduce = null;
  let lost = false;
  let raf = 0;
  let placed = false;

  // Cámara y entrada
  let tmx = 0; // mouse objetivo, de -1 a 1
  let tmy = 0;
  let mx = 0; // mouse suavizado
  let my = 0;
  let lastMove = -1e9;
  let sp = 0; // recorrido de la cámara por todo el sitio, de 0 a 1
  let vel = 0; // velocidad del scroll, suavizada
  let lastY = 0;
  let clock = 0;
  let prev = 0;
  let rect = [0, 0, 1, 1]; // parte visible de la foto, en uv

  // Libro: hojas en vuelo ({ t0, dur, dir, curl, full }) y scroll acumulado
  const flips = [];
  let pageAcc = 0;
  let nextBreeze = 6;

  // Polvo en suspensión. z: profundidad (0 = lejos, 1 = pegado a la cámara, grande y desenfocado)
  const motes = Array.from({ length: 340 }, () => {
    const z = Math.pow(Math.random(), 1.8);
    return {
      x: Math.random(),
      y: Math.random(),
      z,
      r: 0.5 + z * 3.2 + Math.random() * 0.6,
      vx: (Math.random() - 0.5) * 0.00006,
      vy: (Math.random() - 0.6) * 0.00005,
      p: Math.random() * 6.28,
      s: 0.6 + Math.random() * 1.4,
    };
  });

  const mix = (a, b, t) => a + (b - a) * t;
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const noiseish = (x, y) => (Math.sin(x * 1.7 + Math.sin(y * 2.3)) + Math.sin(y * 1.3 - x * 0.7) + 2) / 4;
  const smooth = (a, b, x) => {
    x = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };

  /** Valor de una perilla del CSS (heredado hasta el canvas), acotado; si falta, el de reemplazo. */
  function knob(name, fallback, min, max) {
    const value = parseFloat(getComputedStyle(glCanvas).getPropertyValue(name));
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
  }

  function readKnobs() {
    calm = knob("--fondo-calma", 0, 0, 1);
    contrast = knob("--fondo-contraste", 1, 0.5, 1.5);
  }

  // Al cambiar una perilla, un cuadro nuevo: con movimiento reducido no hay animación que lo dibuje
  $: calm, contrast, kick();

  function locate(pathname) {
    const clean = pathname.replace(/\/$/, "") || "/";
    return Math.max(0, pages.indexOf(clean));
  }

  function measure() {
    const nodes = [...document.querySelectorAll(sections)];
    tops = nodes.map((node) => node.getBoundingClientRect().top + window.scrollY);
    docHeight = document.documentElement.scrollHeight;
    if (debug) {
      for (const node of nodes) {
        node.style.outline = "2px dashed rgba(241, 90, 36, 0.7)";
        node.style.outlineOffset = "-2px";
      }
    }
  }

  /** Sección que se está leyendo y cuánto se recorrió de ella (0 a 1). */
  function cell() {
    const height = docHeight;
    const max = Math.max(1, height - window.innerHeight);
    const progress = Math.min(1, Math.max(0, window.scrollY / max));
    // La línea de lectura barre todo el documento: arriba con scroll 0, abajo con el scroll máximo.
    // El header cuenta como parte de la primera sección y el footer, de la última.
    const line = window.scrollY + window.innerHeight * progress;
    let section = 0;
    while (section + 1 < tops.length && line >= tops[section + 1]) section++;
    const start = section === 0 ? 0 : tops[section];
    const end = section + 1 < tops.length ? tops[section + 1] : height;
    const along = Math.min(1, Math.max(0, (line - start) / Math.max(1, end - start)));
    return { section, count: Math.max(1, tops.length), along };
  }

  // Misma fórmula del haz que usa el shader, para saber si una partícula está dentro de la luz
  function shaftAt(u, v) {
    const qx = u * aspect;
    const tt = (qx - 0.2 * aspect) / 0.894;
    const yw = v - 0.447 * tt;
    if (tt < -0.05 || yw < -0.02 || yw > 0.76) return 0;
    const bars = smooth(0.006, 0.02, Math.abs(yw - 0.2)) * smooth(0.006, 0.02, Math.abs(yw - 0.44));
    return smooth(-0.02, 0.04, yw) * (1 - smooth(0.66, 0.76, yw)) * bars * smooth(-0.05, 0.18, tt) * Math.exp(-Math.max(tt, 0) * 0.85);
  }

  function queueFlip(dir, now) {
    if (flips.length >= 4) return;
    const last = flips[flips.length - 1];
    const t0 = last ? Math.max(now, last.t0 + 0.16) : now;
    flips.push({ t0, dur: 0.95 + Math.random() * 0.3, dir, curl: 0.45 + Math.random() * 0.35, full: true });
  }

  /** La hoja gira alrededor del lomo; el borde exterior se retrasa y la hoja se curva. */
  function drawPage(ctx, theta, curl, map, shade) {
    const N = 10;
    const rows = [];
    for (const v of [0, 1]) {
      const S = lerp2(BOOK.sF, BOOK.sN, v);
      const R = lerp2(BOOK.rF, BOOK.rN, v);
      const L = lerp2(BOOK.lF, BOOK.lN, v);
      const wR = R[0] - S[0];
      const wL = S[0] - L[0];
      const dyR = R[1] - S[1];
      const dyL = L[1] - S[1];
      const points = [[S[0], S[1]]];
      for (let i = 1; i <= N; i++) {
        const f = i / N;
        const th = Math.min(Math.PI, Math.max(0, theta - curl * Math.sin(theta) * f * f));
        const c = Math.cos(th);
        const s = Math.sin(th);
        const k = (1 - c) / 2;
        const w = wR + (wL - wR) * k;
        const dy = dyR + (dyL - dyR) * k;
        points.push([S[0] + c * w * f, S[1] + dy * f * Math.abs(c) - s * BOOK.lift * f]);
      }
      rows.push(points);
    }
    const [a, b] = rows.map((points) => points.map(map));

    // Al quedar casi plana se funde con la página de la foto, así no se nota el empalme
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.sin(theta) * 3.5);

    // Sombra que la hoja proyecta sobre el libro
    const lift = Math.sin(theta);
    if (lift > 0.02) {
      const toward = theta < Math.PI / 2;
      const reach = 0.35 + 0.5 * Math.abs(Math.cos(theta));
      const flat = [
        map(BOOK.sF),
        map(lerp2(BOOK.sF, toward ? BOOK.rF : BOOK.lF, reach)),
        map(lerp2(BOOK.sN, toward ? BOOK.rN : BOOK.lN, reach)),
        map(BOOK.sN),
      ];
      ctx.fillStyle = `rgba(60,30,10,${(0.22 * lift * shade).toFixed(3)})`;
      ctx.beginPath();
      flat.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    }

    // Cara de la hoja
    const gradient = ctx.createLinearGradient(a[0][0], a[0][1], a[N][0], a[N][1]);
    const lit = (0.78 + 0.22 * Math.cos(theta - 1.1)) * shade;
    const c0 = [226, 210, 184].map((v) => Math.round(v * lit));
    const c1 = [252, 242, 222].map((v) => Math.round(Math.min(255, v * lit)));
    gradient.addColorStop(0, `rgb(${c0})`);
    gradient.addColorStop(1, `rgb(${c1})`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(a[0][0], a[0][1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(a[i][0], a[i][1]);
    for (let i = N; i >= 0; i--) ctx.lineTo(b[i][0], b[i][1]);
    ctx.closePath();
    ctx.fill();

    // Renglones impresos, apenas visibles
    if (Math.hypot(a[N][0] - a[0][0], a[N][1] - a[0][1]) > 90) {
      ctx.strokeStyle = `rgba(70,55,40,${(0.07 * shade).toFixed(3)})`;
      ctx.lineWidth = 0.6;
      for (let r = 1; r < 7; r++) {
        const v = r / 7;
        ctx.beginPath();
        for (let i = 2; i <= N - 1; i++) {
          const x = a[i][0] + (b[i][0] - a[i][0]) * v;
          const y = a[i][1] + (b[i][1] - a[i][1]) * v;
          if (i === 2) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Canto de la hoja
    ctx.strokeStyle = `rgba(150,120,90,${(0.25 * shade).toFixed(3)})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(a[N][0], a[N][1]);
    ctx.lineTo(b[N][0], b[N][1]);
    ctx.stroke();
    ctx.restore();
  }

  function drawBook(ctx, W, H, ox, oy, now, shade) {
    const du = ox * (BOOK.depth - FOCUS);
    const dv = oy * (BOOK.depth - FOCUS);
    const map = (p) => [
      ((p[0] / 1024 + du - rect[0]) * W) / rect[2],
      ((p[1] / 551 + dv - rect[1]) * H) / rect[3],
    ];
    for (let i = flips.length - 1; i >= 0; i--) {
      const flip = flips[i];
      const k = (now - flip.t0) / flip.dur;
      if (k < 0) continue;
      if (k >= 1) {
        flips.splice(i, 1);
        continue;
      }
      let theta;
      if (flip.full) {
        const e = easeIO(k);
        theta = flip.dir > 0 ? e * Math.PI : (1 - e) * Math.PI;
      } else {
        // La brisa levanta la esquina y la deja caer
        theta = Math.sin(k * Math.PI) * 0.38;
      }
      drawPage(ctx, theta, flip.dir > 0 || !flip.full ? flip.curl : -flip.curl * 0.6, map, shade);
    }
  }

  function frame(now) {
    raf = 0;
    if (lost) return;
    const dt = Math.min(0.05, (now - (prev || now)) / 1000);
    prev = now;
    const still = reduce.matches;
    if (!still) clock += dt;

    // Recorrido: fila = página, columna = sección. Con movimiento reducido, el comienzo del tramo.
    const rows = Math.max(1, pages.length);
    const { section, count, along } = cell();
    const target = (row + (still ? 0 : (section + along) / count)) / rows;
    if (!placed || still) {
      // Al entrar al sitio la cámara arranca en su lugar, sin viajar desde el principio
      sp = target;
      placed = true;
    } else {
      sp += (target - sp) * 0.08;
    }
    const dy = window.scrollY - lastY;
    lastY = window.scrollY;
    vel += (dy - vel) * 0.15;

    // Mouse, o deriva lenta si nadie lo mueve (celulares)
    const idle = now - lastMove > 2500;
    const ax = idle ? Math.sin(clock * 0.23) * 0.5 : tmx;
    const ay = idle ? Math.sin(clock * 0.17 + 1) * 0.3 : tmy;
    mx += ((still ? 0 : ax) - mx) * 0.05;
    my += ((still ? 0 : ay) - my) * 0.05;

    // Encuadre: en pantallas anchas la cámara avanza hacia la mesa;
    // en pantallas angostas recorre el salón de izquierda a derecha
    const W = viewW;
    const H = viewH;
    const viewAspect = W / H;
    const narrow = viewAspect < 1.2;
    const z = narrow ? mix(1.06, 1.16, sp) : mix(1.06, 1.42, sp);
    let sx = 1;
    let sy = 1;
    if (viewAspect > aspect) sy = aspect / viewAspect;
    else sx = viewAspect / aspect;
    sx /= z;
    sy /= z;
    let cx = narrow ? mix(0.1, 0.78, sp) : mix(0.5, 0.42, sp);
    let cy = narrow ? mix(0.48, 0.56, sp) : mix(0.48, 0.62, sp);
    cx = Math.min(1 - sx / 2 - 0.012, Math.max(sx / 2 + 0.012, cx));
    cy = Math.min(1 - sy / 2 - 0.012, Math.max(sy / 2 + 0.012, cy));
    rect = [cx - sx / 2, cy - sy / 2, sx, sy];

    const amp = still ? 0 : 1;
    const ox = (mx * 0.024 + (narrow ? (sp - 0.5) * 0.04 : 0)) * sx * amp;
    const oy = (my * 0.016 - (sp - 0.5) * 0.05 - Math.max(-30, Math.min(30, vel)) * 0.0006) * sy * amp;

    gl.uniform4f(uniforms.uRect, rect[0], rect[1], rect[2], rect[3]);
    gl.uniform2f(uniforms.uOff, ox, oy);
    gl.uniform1f(uniforms.uTime, clock);
    gl.uniform1f(uniforms.uNight, night);
    gl.uniform1f(uniforms.uCalm, calm);
    gl.uniform1f(uniforms.uContrast, contrast);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    dust.clearRect(0, 0, W, H);

    // Hojas del libro: cada PAGE_EVERY px de scroll pasa una; bajando a la izquierda, subiendo a la derecha
    if (!still) {
      pageAcc += dy;
      while (pageAcc > PAGE_EVERY) {
        pageAcc -= PAGE_EVERY;
        queueFlip(1, clock);
      }
      while (pageAcc < -PAGE_EVERY) {
        pageAcc += PAGE_EVERY;
        queueFlip(-1, clock);
      }
      if (clock > nextBreeze && !flips.length) {
        flips.push({ t0: clock, dur: 2.4, dir: 1, curl: 0.9, full: false });
        nextBreeze = clock + 7 + Math.random() * 6;
      }
    }
    drawBook(dust, W, H, ox, oy, clock, 1 - night * 0.55);

    // Polvo: flota en remolinos lentos, brilla al cruzar los haces y reacciona al scroll y al mouse
    dust.globalCompositeOperation = "lighter";
    const strength = 1 - night * 0.8;
    for (const mote of motes) {
      if (!still) {
        const swirl = noiseish(mote.x * 3 + clock * 0.05, mote.y * 3);
        mote.x += mote.vx + Math.cos(swirl * 6.28) * 0.00009 * mote.s;
        mote.y += mote.vy + Math.sin(swirl * 6.28) * 0.00007 * mote.s - dy * 0.00012 * (0.3 + mote.z * 1.4);
      }
      if (mote.y < -0.05) mote.y = 1.05;
      if (mote.y > 1.05) mote.y = -0.05;
      if (mote.x < -0.05) mote.x = 1.05;
      if (mote.x > 1.05) mote.x = -0.05;
      const px = mote.x * W + mx * -(10 + mote.z * 40);
      const py = mote.y * H + my * -(6 + mote.z * 26);
      const lit = shaftAt(rect[0] + (px / W) * rect[2], rect[1] + (py / H) * rect[3]);
      const twinkle = 0.55 + 0.45 * Math.sin(clock * (1.2 + mote.s) + mote.p);
      const alpha = (0.04 + lit * 1.4) * strength * twinkle * (1 - mote.z * 0.4);
      if (alpha < 0.01) continue;
      const size = mote.r * (1 + lit * 0.8) * 5;
      dust.globalAlpha = Math.min(1, alpha);
      dust.drawImage(sprite, px - size / 2, py - size / 2, size, size);
    }
    dust.globalAlpha = 1;
    dust.globalCompositeOperation = "source-over";

    if (debug) {
      hud = `${pages[row] ?? "?"} · página ${row + 1}/${rows} · sección ${section + 1}/${count} (${Math.round(along * 100)}%) · recorrido ${Math.round(sp * 100)}%`;
    }

    // Animado, siempre. Quieto, solo hasta que la cámara llega a su lugar.
    if (!still || Math.abs(target - sp) > 1e-4) kick();
  }

  function kick() {
    if (ready && !lost && !raf) raf = requestAnimationFrame(frame);
  }

  afterNavigate(({ to }) => {
    row = locate(to?.url.pathname ?? window.location.pathname);
    measure();
    // El salto de scroll al cambiar de página no cuenta como scroll: no pasa hojas ni mueve el polvo
    lastY = window.scrollY;
    pageAcc = 0;
    kick();
  });

  function createProgram() {
    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertex],
      [gl.FRAGMENT_SHADER, fragment],
    ]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("LivingLibrary:", gl.getShaderInfoLog(shader));
        return null;
      }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    return program;
  }

  function createTexture(unit, img) {
    // GPUs chicas: achica la imagen si supera el tamaño máximo de textura
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    let source = img;
    if (img.width > max || img.height > max) {
      const k = max / Math.max(img.width, img.height);
      source = document.createElement("canvas");
      source.width = Math.floor(img.width * k);
      source.height = Math.floor(img.height * k);
      source.getContext("2d").drawImage(img, 0, 0, source.width, source.height);
    }
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function load(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  onMount(() => {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    debug = new URLSearchParams(window.location.search).has("fondo");
    readKnobs();
    lastY = window.scrollY;
    measure();

    gl = glCanvas.getContext("webgl", { antialias: false, alpha: false });
    dust = dustCanvas.getContext("2d");
    if (!gl || !createProgram()) return;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    const position = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (const name of ["uImg", "uMap", "uRect", "uOff", "uTime", "uNight", "uFocus", "uAspect", "uLamp", "uCalm", "uContrast"]) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.uniform4fv(
      uniforms.uLamp,
      new Float32Array(LAMPS.flatMap(([x, top, base, half]) => [x / 1024, top / 551, base / 551, half / 1024])),
    );

    // Partícula de polvo: un punto de luz con borde suave
    sprite = document.createElement("canvas");
    sprite.width = sprite.height = 64;
    const sc = sprite.getContext("2d");
    const glow = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, "rgba(255,240,205,1)");
    glow.addColorStop(0.35, "rgba(255,226,170,.55)");
    glow.addColorStop(1, "rgba(255,210,140,0)");
    sc.fillStyle = glow;
    sc.fillRect(0, 0, 64, 64);

    function resize() {
      readKnobs();
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      viewW = Math.max(1, glCanvas.clientWidth);
      viewH = Math.max(1, glCanvas.clientHeight);
      for (const canvas of [glCanvas, dustCanvas]) {
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      }
      dust.setTransform(dpr, 0, 0, dpr, 0, 0);
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      kick();
    }

    function onPointer(event) {
      tmx = (event.clientX / window.innerWidth) * 2 - 1;
      tmy = (event.clientY / window.innerHeight) * 2 - 1;
      lastMove = performance.now();
    }

    function onLost(event) {
      // Si el navegador libera la GPU, queda la foto fija
      event.preventDefault();
      lost = true;
      ready = false;
    }

    const canvasObserver = new ResizeObserver(resize);
    canvasObserver.observe(glCanvas);
    const pageObserver = new ResizeObserver(() => {
      measure();
      kick();
    });
    pageObserver.observe(document.body);
    // Perillas cambiadas en línea en el contenedor (.bib)
    const knobObserver = new MutationObserver(readKnobs);
    knobObserver.observe(bgEl.parentElement, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    reduce.addEventListener("change", kick);
    glCanvas.addEventListener("webglcontextlost", onLost);

    Promise.all([load(image), load(maps)])
      .then(([img, map]) => {
        if (lost) return;
        createTexture(0, img);
        createTexture(1, map);
        aspect = img.width / img.height;
        gl.uniform1i(uniforms.uImg, 0);
        gl.uniform1i(uniforms.uMap, 1);
        gl.uniform1f(uniforms.uFocus, FOCUS);
        gl.uniform1f(uniforms.uAspect, aspect);
        ready = true;
        resize();
      })
      .catch(() => {});

    return () => {
      cancelAnimationFrame(raf);
      canvasObserver.disconnect();
      pageObserver.disconnect();
      knobObserver.disconnect();
      window.removeEventListener("scroll", kick);
      window.removeEventListener("pointermove", onPointer);
      reduce.removeEventListener("change", kick);
      glCanvas.removeEventListener("webglcontextlost", onLost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  });
</script>

<div
  bind:this={bgEl}
  class="bib-bg"
  class:is-ready={ready}
  style:background-image="url({image})"
  aria-hidden="true"
>
  <canvas bind:this={glCanvas}></canvas>
  <canvas bind:this={dustCanvas}></canvas>
</div>

{#if debug}
  <p class="bib-bg-hud">{hud}</p>
{/if}
