// ReSpira — lógica del analizador.
// Grabo la tos como WAV en el navegador (para que el servidor la lea sin ffmpeg) y,
// EN PARALELO, dibujo la forma de onda en vivo con un AnalyserNode. La captura WAV y el
// contrato con /predict no cambian respecto a la versión anterior.

const analizador = document.querySelector('.analizador');
const btnGrabar = document.getElementById('btnGrabar');
const btnDeNuevo = document.getElementById('btnDeNuevo');
const estado = document.getElementById('estado');
const timerEl = document.getElementById('timer');
const canvas = document.getElementById('onda');
const consent = document.getElementById('consent');
const medidorArco = document.getElementById('medidorArco');
const probNum = document.getElementById('probNum');
const chip = document.getElementById('chip');
const chipIcon = document.getElementById('chipIcon');
const chipTexto = document.getElementById('chipTexto');
const significa = document.getElementById('significa');

const CIRCUNFERENCIA = 2 * Math.PI * 52;           // radio del arco del medidor
const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let grabando = false;
let audioContext, source, processor, analyser, stream;
let chunks = [];
let sampleRate = 44100;
let rafId = null, timerId = null, tInicio = 0;

function setEstado(s) { analizador.dataset.state = s; }

const getVar = (n) => getComputedStyle(document.body).getPropertyValue(n).trim();

// Iconos SVG para el chip de estado (inline, sin peticiones externas)
const ICONOS = {
  ok: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 3 l7 3 v5 c0 4.5 -3 7.5 -7 9 c-4 -1.5 -7 -4.5 -7 -9 V6 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 12 l2 2 l4 -4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  duda: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 9.5 a2.5 2.5 0 1 1 3 2.4 v1.3 M12 16.5 v.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 3 L22 20 H2 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9 v5 M12 17 v.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

btnGrabar.addEventListener('click', () => grabando ? detener() : iniciar());
btnDeNuevo.addEventListener('click', () => setEstado('idle'));

// ===== Grabación =====
async function iniciar() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    estado.textContent = 'No pude acceder al micrófono. Revisa los permisos.';
    return;
  }
  chunks = [];
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  sampleRate = audioContext.sampleRate;
  source = audioContext.createMediaStreamSource(stream);

  // Rama 1: captura de PCM para el WAV
  processor = audioContext.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(processor);
  processor.connect(audioContext.destination);

  // Rama 2: análisis para la forma de onda en vivo (no afecta la captura)
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  grabando = true;
  setEstado('rec');
  estado.textContent = 'Grabando… tose y toca de nuevo para detener.';
  tInicio = performance.now();
  timerEl.classList.remove('oculto');
  actualizarTimer();
  dibujarOnda();
}

async function detener() {
  grabando = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (timerId) clearTimeout(timerId);
  timerEl.classList.add('oculto');
  processor.disconnect(); source.disconnect(); analyser.disconnect();
  stream.getTracks().forEach((t) => t.stop());
  await audioContext.close();

  const muestras = chunks.reduce((n, c) => n + c.length, 0);
  if (muestras < sampleRate * 0.4) {
    setEstado('idle');
    estado.textContent = 'Grabación muy corta. Mantén la grabación mientras toses.';
    return;
  }
  enviar(construirWav(chunks, sampleRate));
}

function actualizarTimer() {
  timerEl.textContent = ((performance.now() - tInicio) / 1000).toFixed(1) + 's';
  timerId = setTimeout(actualizarTimer, 100);
}

// ===== Forma de onda en vivo =====
function dibujarOnda() {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const buffer = new Uint8Array(analyser.frequencyBinCount);

  const grad = () => {
    const g = ctx.createLinearGradient(0, 0, canvas.width, 0);
    g.addColorStop(0, getVar('--brand')); g.addColorStop(1, getVar('--accent'));
    return g;
  };
  const ajustar = () => {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  };

  const frame = () => {
    ajustar();
    analyser.getByteTimeDomainData(buffer);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.6 * dpr; ctx.strokeStyle = grad();
    ctx.lineJoin = 'round'; ctx.beginPath();
    const paso = canvas.width / buffer.length;
    for (let i = 0; i < buffer.length; i++) {
      const y = (buffer[i] / 128) * (canvas.height / 2);
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * paso, y);
    }
    ctx.stroke();
    if (grabando && !sinMovimiento) rafId = requestAnimationFrame(frame);
  };
  frame();   // al menos un cuadro (también sirve si hay movimiento reducido)
}

// ===== Construir WAV (PCM 16-bit) =====
function construirWav(chunks, sr) {
  const largo = chunks.reduce((n, c) => n + c.length, 0);
  const datos = new Float32Array(largo);
  let off = 0; for (const c of chunks) { datos.set(c, off); off += c.length; }

  const buffer = new ArrayBuffer(44 + datos.length * 2);
  const view = new DataView(buffer);
  const txt = (p, s) => { for (let i = 0; i < s.length; i++) view.setUint8(p + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); view.setUint32(4, 36 + datos.length * 2, true); txt(8, 'WAVE');
  txt(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  txt(36, 'data'); view.setUint32(40, datos.length * 2, true);
  let p = 44;
  for (let i = 0; i < datos.length; i++) {
    const s = Math.max(-1, Math.min(1, datos[i]));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7FFF, true); p += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}

// ===== Enviar al backend =====
async function enviar(wav) {
  setEstado('loading');
  estado.textContent = 'Analizando la muestra…';

  const form = new FormData();
  form.append('audio', wav, 'tos.wav');
  form.append('consent', consent.checked ? 'true' : 'false');

  try {
    const r = await fetch('predict', { method: 'POST', body: form });
    if (!r.ok) throw new Error(r.status);
    mostrarResultado(await r.json());
  } catch (e) {
    setEstado('idle');
    estado.textContent = 'Hubo un error al analizar. Intenta de nuevo.';
  }
}

// ===== Render del resultado =====
function mostrarResultado(data) {
  const prob = data.probability_covid;          // 0..1
  const pct = Math.round(prob * 100);

  // Banda de riesgo → color semántico + redacción prudente
  let tint, icono, titulo, detalle;
  if (pct < 34) {
    tint = getVar('--success'); icono = ICONOS.ok;
    titulo = 'Señal de bajo riesgo estimado';
    detalle = 'El sonido se parece más al de toses negativas. Aun así, no es un diagnóstico.';
  } else if (pct <= 66) {
    tint = getVar('--warning'); icono = ICONOS.duda;
    titulo = 'Resultado poco concluyente';
    detalle = 'La señal no es clara. Repite la grabación en un lugar silencioso.';
  } else {
    tint = getVar('--danger'); icono = ICONOS.alerta;
    titulo = 'Señal de riesgo elevado';
    detalle = 'El sonido comparte rasgos con toses positivas. Considera hacerte una prueba.';
  }

  probNum.innerHTML = pct + '<span class="pct">%</span>';
  medidorArco.style.stroke = tint;
  medidorArco.style.strokeDashoffset = CIRCUNFERENCIA * (1 - prob);
  chip.style.setProperty('--tint', tint);
  chipIcon.innerHTML = icono;
  chipTexto.textContent = titulo;
  significa.textContent = detalle +
    (data.guardado ? ' Gracias, tu grabación se guardó.' : '');

  setEstado('done');
}

// PWA
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
