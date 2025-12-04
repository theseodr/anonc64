/* ------------------------------------------------------------------
   main.js – Version 5 (ES module, fixed library loading)
   ------------------------------------------------------------------ */

// Wait for globals to load from CDN
const waitForGlobals = async () => {
  let attempts = 0;
  while ((!globalThis.Y || !globalThis.fabric) && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  if (!globalThis.Y || !globalThis.fabric) {
    console.error('Failed to load required libraries');
    return false;
  }
  return true;
};

const ready = await waitForGlobals();
if (!ready) throw new Error('Required libraries failed to load');

// Initialize Yjs document & WebRTC provider
const ydoc = new Y.Doc();
const webrtcProvider = new Y.WebrtcProvider('anon-c64-room', ydoc, {});

// Shared data structures
const yChat   = ydoc.getText('chat');   // chat log (plain text)
const yCanvas = ydoc.getMap('canvas'); // whiteboard objects

// Fabric canvas – initialize
const canvas = new fabric.Canvas('whiteboard', {
  isDrawingMode: true,
  selection: false
});
canvas.freeDrawingBrush.width = 2;
canvas.freeDrawingBrush.color = '#00d7d7';

// Sync Fabric objects with Yjs
canvas.on('path:created', ({ path }) => {
  const obj = path.toObject(['stroke', 'strokeWidth']);
  const id  = Y.utils.generateID();
  yCanvas.set(id, obj);
});

// Chat UI – timestamps + scrolling
const msgBox = document.getElementById('messages');
const input  = document.getElementById('msg-input');

function renderChat() {
  const lines = yChat.toString().split('\n');
  msgBox.innerHTML = lines.map(line => {
    const [ts, msg] = line.split('|', 2);
    return `<div class="message"><span class="timestamp">${ts}</span>${msg}</div>`;
  }).join('');
  msgBox.scrollTop = msgBox.scrollHeight;
}

yChat.observe(() => renderChat());

input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && input.value.trim()) {
    const ts = new Date().toLocaleTimeString();
    yChat.insert(yChat.length, `${ts}|${input.value}\n`);
    input.value = '';
  }
});

// Toolbar button handlers
document.getElementById('btn-clear').addEventListener('click', () => {
  canvas.clear();
  yCanvas.clear();
});

document.getElementById('btn-tor').addEventListener('click', () => {
  window.torEnabled = !window.torEnabled;
  alert('Tor mode: ' + (window.torEnabled ? 'ON' : 'OFF'));
});

document.getElementById('brush-color').addEventListener('change', e => {
  canvas.freeDrawingBrush.color = e.target.value;
});

document.getElementById('brush-size').addEventListener('input', e => {
  canvas.freeDrawingBrush.width = parseInt(e.target.value, 10);
});

document.getElementById('shape-select').addEventListener('change', e => {
  console.log('Shape selected:', e.target.value);
});

document.getElementById('btn-upload').addEventListener('click', () => {
  alert('Upload video feature – not yet implemented.');
});

document.getElementById('btn-youtube').addEventListener('click', () => {
  const url = prompt('Enter YouTube video URL:');
  if (url) {
    alert('Loading YouTube video – not yet implemented: ' + url);
  }
});

document.getElementById('btn-sticker').addEventListener('click', () => {
  alert('Sticker upload – not yet implemented.');
});

document.getElementById('btn-gif').addEventListener('click', () => {
  alert('GIF upload – not yet implemented.');
});
