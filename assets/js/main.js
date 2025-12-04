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

const initC64App = async () => {
  const ready = await waitForGlobals();
  if (!ready) throw new Error('Required libraries failed to load');

  // Initialize Yjs document & WebRTC provider
  const ydoc = new Y.Doc();
  const webrtcProvider = new Y.WebrtcProvider('anon-c64-room', ydoc, {});

  // Shared data structures
  const yChat   = ydoc.getText('chat');   // chat log (plain text)
  const yCanvas = ydoc.getMap('canvas'); // whiteboard objects

  // Grab DOM elements
  const whiteboardEl = document.getElementById('whiteboard');
  const msgBox = document.getElementById('messages');
  const input  = document.getElementById('msg-input');

  if (!whiteboardEl || !msgBox || !input) {
    console.error('C64 init error: missing core DOM elements', {
      whiteboardEl, msgBox, input
    });
    return;
  }

  // Fabric canvas – initialize
  const canvas = new fabric.Canvas(whiteboardEl, {
    isDrawingMode: true,
    selection: false
  });
  canvas.freeDrawingBrush.width = 2;
  canvas.freeDrawingBrush.color = '#00d7d7';

  console.log('C64 canvas initialized');

  // Sync Fabric objects with Yjs
  canvas.on('path:created', ({ path }) => {
    const obj = path.toObject(['stroke', 'strokeWidth']);
    const id  = Y.utils.generateID();
    yCanvas.set(id, obj);
  });

  // Chat UI – timestamps + scrolling
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
  const btnClear   = document.getElementById('btn-clear');
  const btnTor     = document.getElementById('btn-tor');
  const brushColor = document.getElementById('brush-color');
  const brushSize  = document.getElementById('brush-size');
  const shapeSel   = document.getElementById('shape-select');
  const btnUpload  = document.getElementById('btn-upload');
  const btnYoutube = document.getElementById('btn-youtube');
  const btnSticker = document.getElementById('btn-sticker');
  const btnGif     = document.getElementById('btn-gif');

  if (!btnClear || !btnTor || !brushColor || !brushSize || !shapeSel ||
      !btnUpload || !btnYoutube || !btnSticker || !btnGif) {
    console.warn('C64 init warning: some toolbar elements missing');
  }

  btnClear?.addEventListener('click', () => {
    canvas.clear();
    yCanvas.clear();
  });

  btnTor?.addEventListener('click', () => {
    window.torEnabled = !window.torEnabled;
    alert('Tor mode: ' + (window.torEnabled ? 'ON' : 'OFF'));
  });

  brushColor?.addEventListener('change', e => {
    canvas.freeDrawingBrush.color = e.target.value;
  });

  brushSize?.addEventListener('input', e => {
    canvas.freeDrawingBrush.width = parseInt(e.target.value, 10);
  });

  shapeSel?.addEventListener('change', e => {
    console.log('Shape selected:', e.target.value);
  });

  btnUpload?.addEventListener('click', () => {
    alert('Upload video feature – not yet implemented.');
  });

  btnYoutube?.addEventListener('click', () => {
    const url = prompt('Enter YouTube video URL:');
    if (url) {
      alert('Loading YouTube video – not yet implemented: ' + url);
    }
  });

  btnSticker?.addEventListener('click', () => {
    alert('Sticker upload – not yet implemented.');
  });

  btnGif?.addEventListener('click', () => {
    alert('GIF upload – not yet implemented.');
  });

  console.log('C64 chat & toolbar initialized');
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initC64App().catch(err => console.error('C64 init failed', err));
  }, { once: true });
} else {
  initC64App().catch(err => console.error('C64 init failed', err));
}
