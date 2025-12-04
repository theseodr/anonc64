/* ------------------------------------------------------------------
   main.js – Version 5 (ES module, fixed library loading)
   ------------------------------------------------------------------ */

import * as Y from 'yjs';
import * as fabric from 'fabric';
import { torFetch, setTorEnabled, torEnabled } from './lib/tor-client.js';

const generateStrokeId = () => {
  return 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
};

/**
 * Derive a stable, per-user stroke color as a HEX string so it
 * can be used both by Fabric and <input type="color">.
 */
const hslToHex = (h, s, l) => {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const getColorForClient = (clientId) => {
  const base = typeof clientId === 'number' ? clientId : Number(clientId) || 0;
  const hue = (base * 47) % 360;
  return hslToHex(hue, 80, 60);
};

const initC64App = async () => {
  // Initialize Yjs document (local-only, no WebRTC in this build)
  const ydoc = new Y.Doc();

  // Shared data structures
  const yChat   = ydoc.getText('chat');   // chat log (plain text)
  const yCanvas = ydoc.getMap('canvas'); // whiteboard objects

  const connPanel = document.getElementById('connection-panel');
  const connText  = document.getElementById('connection-text');

  const renderConnectionStatus = () => {
    if (!connText) return;
    const torStatus = torEnabled ? 'ON' : 'OFF';
    connText.textContent = `RTC: disabled, Yjs: local-only, Tor: ${torStatus}`;
  };
  renderConnectionStatus();

  // Per-user drawing identity
  const clientId = ydoc.clientID;
  const userColor = getColorForClient(clientId);
  const userLabel = `Artist #${clientId % 1000}`;

  // Grab DOM elements
  const whiteboardEl = document.getElementById('whiteboard');
  const msgBox = document.getElementById('messages');
  const input  = document.getElementById('msg-input');
  const bgVideo = document.getElementById('bg-video');
  const userIndicator = document.getElementById('user-indicator');

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

  // Ensure a drawing brush exists for Fabric v6
  if (!canvas.freeDrawingBrush) {
    canvas.isDrawingMode = true;
    // PencilBrush is the default free drawing tool
    // @ts-ignore - PencilBrush is available on the fabric namespace at runtime
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
  }

  canvas.freeDrawingBrush.width = 2;
  canvas.freeDrawingBrush.color = userColor;

  console.log('C64 canvas initialized');

  // Helper to add an object from Yjs to Fabric
  const addObjectFromY = (key, data) => {
    if (!data) return;
    fabric.util.enlivenObjects([data], objs => {
      objs.forEach(o => {
        o.id = key;
        if (data.authorColor) {
          o.set('stroke', data.authorColor);
        }
      });
      if (objs.length) {
        canvas.add(...objs);
        canvas.renderAll();
      }
    });
  };

  // Initial load of existing canvas objects from Yjs
  yCanvas.forEach((data, key) => {
    addObjectFromY(key, data);
  });

  // Sync Fabric objects with Yjs – local creations go into Yjs
  canvas.on('path:created', ({ path }) => {
    const id = generateStrokeId();
    path.set('id', id);
    path.set('authorId', clientId);
    path.set('authorColor', userColor);

    const obj = path.toObject(['stroke', 'strokeWidth', 'id', 'authorId', 'authorColor']);
    console.log('[Draw] path created', { id, clientId, color: userColor });
    yCanvas.set(id, obj);
  });

  // Apply remote updates from Yjs into Fabric
  yCanvas.observe(event => {
    if (event.transaction.local) return; // ignore our own local changes

    event.changes.keys.forEach((change, key) => {
      if (change.action === 'add' || change.action === 'update') {
        const data = yCanvas.get(key);
        addObjectFromY(key, data);
      } else if (change.action === 'delete') {
        const obj = canvas.getObjects().find(o => o.id === key);
        if (obj) {
          canvas.remove(obj);
          canvas.renderAll();
        }
      }
    });
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
      const msg = input.value.trim();
      console.log('[Chat] sending message', msg);
      const ts = new Date().toLocaleTimeString();
      yChat.insert(yChat.length, `${ts}|${msg}\n`);
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

  // Reflect per-user color in the toolbar UI
  if (brushColor) {
    brushColor.value = userColor;
  }
  if (userIndicator) {
    userIndicator.innerHTML = `You: <span style="
      display:inline-block;
      width:12px;
      height:12px;
      margin-left:4px;
      border:1px solid #ffffff;
      background:${userColor};
    " aria-hidden="true"></span> <span class="sr-only">${userLabel}</span>`;
  }

  btnClear?.addEventListener('click', () => {
    canvas.clear();
    yCanvas.clear();
  });

  btnTor?.addEventListener('click', async () => {
    const newFlag = !torEnabled;
    setTorEnabled(newFlag);
    console.log('Tor mode toggled, now:', newFlag);

    // Example proxied request to demonstrate Tor-aware fetching.
    // If a local proxy is not configured, this will fall back to direct fetch.
    try {
      const resp = await torFetch('https://example.com', { method: 'HEAD' });
      console.log('[Tor test] example.com status:', resp.status);
    } catch (err) {
      console.error('[Tor test] request failed:', err);
    }

    renderConnectionStatus();
    alert('Tor mode: ' + (newFlag ? 'ON' : 'OFF'));
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

  let currentVideoObjectUrl = null;

  btnUpload?.addEventListener('click', () => {
    if (!bgVideo) {
      alert('Background video element is missing.');
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/*';

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      if (currentVideoObjectUrl) {
        URL.revokeObjectURL(currentVideoObjectUrl);
        currentVideoObjectUrl = null;
      }

      currentVideoObjectUrl = URL.createObjectURL(file);
      console.log('[Video] Loaded local file as background video.');
      bgVideo.src = currentVideoObjectUrl;
      bgVideo.play().catch(err => console.error('[Video] play() failed', err));
    });

    fileInput.click();
  });

  const extractYouTubeId = (url) => {
    let match = url.match(/^https?:\/\/youtu\.be\/([^?&#]+)/);
    if (match) return match[1];
    match = url.match(/[?&]v=([^&#]+)/);
    if (match) return match[1];
    match = url.match(/embed\/([^?&#]+)/);
    if (match) return match[1];
    return null;
  };

  btnYoutube?.addEventListener('click', async () => {
    const url = prompt('Enter YouTube video URL:');
    if (!url) return;

    const videoId = extractYouTubeId(url);
    if (!videoId) {
      alert('Could not extract a YouTube video ID from that URL.');
      return;
    }

    console.log('[YouTube] Testing reachability via torFetch');
    try {
      const resp = await torFetch(url, { method: 'HEAD' });
      console.log('[YouTube] HEAD status:', resp.status);
    } catch (err) {
      console.error('[YouTube] HEAD request failed:', err);
    }

    let iframe = document.getElementById('yt-embed');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'yt-embed';
      document.body.appendChild(iframe);
    }

    iframe.setAttribute('allow', 'autoplay');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&mute=1&playlist=${videoId}`;

    // Pause any local video playback to avoid audio overlap
    if (bgVideo) {
      bgVideo.pause();
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
