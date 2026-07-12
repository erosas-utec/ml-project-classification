// Lógica de la app: grabar la tos como WAV en el navegador y mandarla al backend.
// Grabo en WAV (PCM) a propósito para que el servidor lo lea con librosa sin
// depender de ffmpeg. Uso la Web Audio API para capturar el audio crudo.

const btnGrabar = document.getElementById('btnGrabar');
const estado = document.getElementById('estado');
const resultado = document.getElementById('resultado');
const etiqueta = document.getElementById('etiqueta');
const barraProb = document.getElementById('barraProb');
const probTexto = document.getElementById('probTexto');
const consent = document.getElementById('consent');

let grabando = false;
let audioContext, source, processor, stream;
let chunks = [];
let sampleRate = 44100;

btnGrabar.addEventListener('click', () => {
  if (!grabando) iniciarGrabacion();
  else detenerGrabacion();
});

async function iniciarGrabacion() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    estado.textContent = '❌ No pude acceder al micrófono. Revisa los permisos.';
    return;
  }
  chunks = [];
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  sampleRate = audioContext.sampleRate;
  source = audioContext.createMediaStreamSource(stream);
  // ScriptProcessorNode: simple y compatible en todos lados para capturar PCM
  processor = audioContext.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  source.connect(processor);
  processor.connect(audioContext.destination);

  grabando = true;
  btnGrabar.textContent = '⏹ Detener';
  btnGrabar.classList.add('grabando');
  estado.textContent = '🔴 Grabando... tose ahora y toca Detener.';
  resultado.classList.add('oculto');
}

async function detenerGrabacion() {
  grabando = false;
  processor.disconnect();
  source.disconnect();
  stream.getTracks().forEach((t) => t.stop());
  await audioContext.close();

  btnGrabar.classList.remove('grabando');
  btnGrabar.textContent = '🎤 Grabar tos';

  // Si la grabación fue demasiado corta, no la mando (evita audio inservible)
  const muestras = chunks.reduce((n, c) => n + c.length, 0);
  if (muestras < sampleRate * 0.4) {
    estado.textContent = '⏱️ Grabación muy corta. Mantén la grabación mientras toses.';
    return;
  }

  const wav = construirWav(chunks, sampleRate);
  enviar(wav);
}

// Une los pedazos de audio y arma un archivo WAV de 16 bits
function construirWav(chunks, sr) {
  let largo = chunks.reduce((n, c) => n + c.length, 0);
  const datos = new Float32Array(largo);
  let offset = 0;
  for (const c of chunks) { datos.set(c, offset); offset += c.length; }

  const buffer = new ArrayBuffer(44 + datos.length * 2);
  const view = new DataView(buffer);
  const escribir = (pos, texto) => {
    for (let i = 0; i < texto.length; i++) view.setUint8(pos + i, texto.charCodeAt(i));
  };
  escribir(0, 'RIFF');
  view.setUint32(4, 36 + datos.length * 2, true);
  escribir(8, 'WAVE');
  escribir(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  escribir(36, 'data');
  view.setUint32(40, datos.length * 2, true);
  // Float32 [-1,1] -> Int16
  let pos = 44;
  for (let i = 0; i < datos.length; i++) {
    const s = Math.max(-1, Math.min(1, datos[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    pos += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}

async function enviar(wav) {
  estado.textContent = '⏳ Analizando...';
  btnGrabar.disabled = true;

  const form = new FormData();
  form.append('audio', wav, 'tos.wav');
  form.append('consent', consent.checked ? 'true' : 'false');

  try {
    const r = await fetch('predict', { method: 'POST', body: form });
    if (!r.ok) throw new Error('respuesta ' + r.status);
    const data = await r.json();
    mostrarResultado(data);
  } catch (e) {
    estado.textContent = '❌ Error al analizar. Intenta de nuevo.';
  } finally {
    btnGrabar.disabled = false;
  }
}

function mostrarResultado(data) {
  estado.textContent = 'Listo. Puedes grabar otra vez.';
  const esPositivo = data.prediction === 'Positive';
  const prob = Math.round(data.probability_covid * 100);

  etiqueta.textContent = esPositivo ? '🟥 Probablemente POSITIVO' : '🟩 Probablemente NEGATIVO';
  etiqueta.className = 'etiqueta ' + (esPositivo ? 'positivo' : 'negativo');
  barraProb.style.width = prob + '%';
  probTexto.textContent = `Probabilidad estimada de COVID: ${prob}%` +
    (data.guardado ? ' · grabación guardada, ¡gracias!' : '');
  resultado.classList.remove('oculto');
}

// Registro el service worker para que sea PWA instalable
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
