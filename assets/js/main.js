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

// When hosted on anon.p2p.pm we talk to the PHP backend at /api.
// In the Lovable preview we stay fully local and do not make any HTTP calls.
const C64_HOSTNAME = 'anon.p2p.pm';
const API_BASE = window.location.hostname === C64_HOSTNAME ? '/api' : null;

const apiFetch = async (path, options = {}) => {
  if (!API_BASE) return null;
  try {
    const res = await fetch(API_BASE + path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      console.warn('[API] Non-OK response for', path, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] Request failed for', path, err);
    return null;
  }
};

const initC64App = async () => {
  // Initialize Yjs document (local-only, no WebRTC in this build)
  const ydoc = new Y.Doc();

  // Shared data structures
  const yChat   = ydoc.getText('chat');   // chat log (plain text)
  const yCanvas = ydoc.getMap('canvas');  // whiteboard objects

  const connPanel = document.getElementById('connection-panel');
  const connText  = document.getElementById('connection-text');

  // Lightweight status model for the in-app panel
  let canvasReady = false;
  let chatMessagesCount = 0;
  let videoState = 'none'; // 'none' | 'local' | 'youtube'
  let currentTool = 'free';

  const hasBackend = !!API_BASE;
  let chatMessages = [];
  let lastChatTimestamp = 0;
  let lastStrokeTimestamp = 0;

  let lastApiSuccessAt = null;
  let backendReachable = hasBackend ? null : false;

  const backendPanel = document.getElementById('backend-panel');
  const backendText  = document.getElementById('backend-text');

  const renderBackendDebug = () => {
    if (!backendText) return;
    const host = window.location.hostname || 'unknown';
    const mode = hasBackend ? 'PHP mode' : 'local-only';

    let backendLabel;
    if (!hasBackend) {
      backendLabel = 'disabled (local preview)';
    } else if (backendReachable === null) {
      backendLabel = 'checking';
    } else if (backendReachable) {
      backendLabel = 'OK';
    } else {
      backendLabel = 'unreachable';
    }

    const lastTs = lastApiSuccessAt
      ? new Date(lastApiSuccessAt).toLocaleTimeString()
      : 'never';

    backendText.textContent =
      `Host: ${host} | Mode: ${mode} | Backend: ${backendLabel} | Last API success: ${lastTs}`;
  };

  const callApi = async (path, options = {}) => {
    const result = await apiFetch(path, options);
    if (result !== null && hasBackend) {
      backendReachable = true;
      lastApiSuccessAt = Date.now();
    } else if (hasBackend) {
      backendReachable = false;
    }
    renderBackendDebug();
    return result;
  };

  const renderConnectionStatus = () => {
    if (!connText) return;
    const torStatus = torEnabled ? 'ON' : 'OFF';
    const canvasStatus = canvasReady ? 'ready' : 'initializing';
    const chatStatus =
      chatMessagesCount > 0
        ? `${chatMessagesCount} msg${chatMessagesCount > 1 ? 's' : ''}`
        : 'idle';
    const videoStatus =
      videoState === 'local' ? 'local video' :
      videoState === 'youtube' ? 'YouTube' :
      'none';
    const backendStatus =
      !hasBackend ? 'local-only' :
      backendReachable === null ? 'checking' :
      backendReachable ? 'OK' : 'unreachable';

    connText.textContent =
      `Canvas: ${canvasStatus} | Chat: ${chatStatus} | Tor: ${torStatus} | Video: ${videoStatus} | Backend: ${backendStatus}`;
  };
  renderBackendDebug();
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

  // Match the canvas backing size to the viewport so drawing covers the full board.
  const resizeCanvas = () => {
    const rect = whiteboardEl.getBoundingClientRect();
    canvas.setWidth(rect.width);
    canvas.setHeight(rect.height);
    if (whiteboardEl instanceof HTMLCanvasElement) {
      whiteboardEl.width = rect.width;
      whiteboardEl.height = rect.height;
    }
    canvas.renderAll();
  };

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Ensure a drawing brush exists for Fabric v6
  if (!canvas.freeDrawingBrush) {
    canvas.isDrawingMode = true;
    // PencilBrush is the default free drawing tool
    // @ts-ignore - PencilBrush is available on the fabric namespace at runtime
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
  }

  canvas.freeDrawingBrush.width = 2;
  canvas.freeDrawingBrush.color = userColor;
  canvasReady = true;
  renderConnectionStatus();

  // Shape drawing state
  let isDrawingShape = false;
  let shapeOrigin = null;
  let activeShape = null;

  canvas.on('mouse:down', (opt) => {
    if (currentTool === 'free') return;
    const pointer = canvas.getPointer(opt.e);
    isDrawingShape = true;
    shapeOrigin = { x: pointer.x, y: pointer.y };

    const strokeColor = canvas.freeDrawingBrush?.color || userColor;
    const strokeWidth = canvas.freeDrawingBrush?.width || 2;

    if (currentTool === 'rect') {
      activeShape = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        originX: 'left',
        originY: 'top',
        width: 1,
        height: 1,
        fill: 'transparent',
        stroke: strokeColor,
        strokeWidth,
        selectable: false,
        evented: false,
      });
    } else if (currentTool === 'circle') {
      activeShape = new fabric.Circle({
        left: pointer.x,
        top: pointer.y,
        originX: 'center',
        originY: 'center',
        radius: 1,
        fill: 'transparent',
        stroke: strokeColor,
        strokeWidth,
        selectable: false,
        evented: false,
      });
    } else {
      return;
    }

    canvas.add(activeShape);
  });

  canvas.on('mouse:move', (opt) => {
    if (!isDrawingShape || !activeShape || !shapeOrigin) return;
    const pointer = canvas.getPointer(opt.e);

    if (currentTool === 'rect') {
      const width = pointer.x - shapeOrigin.x;
      const height = pointer.y - shapeOrigin.y;
      activeShape.set({
        left: Math.min(pointer.x, shapeOrigin.x),
        top: Math.min(pointer.y, shapeOrigin.y),
        width: Math.abs(width),
        height: Math.abs(height),
      });
    } else if (currentTool === 'circle') {
      const dx = pointer.x - shapeOrigin.x;
      const dy = pointer.y - shapeOrigin.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      activeShape.set({
        radius,
        left: shapeOrigin.x,
        top: shapeOrigin.y,
      });
    }

    canvas.requestRenderAll();
  });

  canvas.on('mouse:up', () => {
    if (!isDrawingShape || !activeShape) {
      isDrawingShape = false;
      shapeOrigin = null;
      return;
    }

    isDrawingShape = false;
    shapeOrigin = null;

    const id = generateStrokeId();
    activeShape.set('id', id);
    activeShape.set('authorId', clientId);
    activeShape.set('authorColor', userColor);

    const obj = activeShape.toObject(['stroke', 'strokeWidth', 'id', 'authorId', 'authorColor', 'radius', 'width', 'height']);
    console.log('[Draw] shape created', { id, clientId, tool: currentTool, color: userColor });
    yCanvas.set(id, obj);
    if (hasBackend) {
      persistStrokeToBackend(id, obj);
    }

    activeShape = null;
  });

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
  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const labelForIp = (ip) => {
    if (!ip) return 'anon';
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      hash = ((hash << 5) - hash + ip.charCodeAt(i)) | 0;
    }
    const n = Math.abs(hash % 1000);
    return `peer-${n.toString().padStart(3, '0')}`;
  };

  const renderChatLocal = () => {
    const raw = yChat.toString();
    const lines = raw.split('\n').filter(Boolean);
    chatMessagesCount = lines.length;
    msgBox.innerHTML = lines
      .map((line) => {
        const [ts, msg] = line.split('|', 2);
        return `<div class="message"><span class="timestamp">${escapeHtml(ts)}</span>${escapeHtml(msg)}</div>`;
      })
      .join('');
    msgBox.scrollTop = msgBox.scrollHeight;
    renderConnectionStatus();
  };

  const renderChatBackend = () => {
    chatMessagesCount = chatMessages.length;
    msgBox.innerHTML = chatMessages
      .map((m) => {
        const ts = new Date(m.created_at || Date.now()).toLocaleTimeString();
        const nick = labelForIp(m.ip);
        const tooltip = `IP: ${m.ip || 'unknown'}\nRDNS: ${m.rdns || 'reverse DNS not available'}`;
        return `<div class="message"><span class="timestamp">${escapeHtml(ts)}</span><span class="nick" title="${escapeHtml(tooltip)}">${escapeHtml(nick)}</span>: ${escapeHtml(m.text || '')}</div>`;
      })
      .join('');
    msgBox.scrollTop = msgBox.scrollHeight;
    renderConnectionStatus();
  };

  const pollMessages = async () => {
    if (!hasBackend) return;
    const data = await callApi('/list_messages.php?since=' + lastChatTimestamp);
    if (!data || !Array.isArray(data.messages)) return;
    let changed = false;
    for (const m of data.messages) {
      chatMessages.push(m);
      if (m.created_at && m.created_at > lastChatTimestamp) {
        lastChatTimestamp = m.created_at;
      }
      changed = true;
    }
    if (changed) {
      renderChatBackend();
    }
  };

  if (hasBackend) {
    // Initial load + polling for new chat messages
    pollMessages();
    setInterval(pollMessages, 2000);
  } else {
    // Local-only chat via Yjs when no backend is available (Lovable preview, etc.)
    yChat.observe(() => renderChatLocal());
    renderChatLocal();
  }

  input.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const trimmed = input.value.trim();
    if (!trimmed) return;

    if (hasBackend) {
      console.log('[Chat] sending message via backend', trimmed);
      const payload = { text: trimmed };
      const result = await callApi('/send_message.php', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      input.value = '';
      if (result && result.ok) {
        chatMessages.push({
          id: result.id,
          text: result.text,
          created_at: result.created_at,
          ip: result.ip,
          rdns: result.rdns,
        });
        if (result.created_at && result.created_at > lastChatTimestamp) {
          lastChatTimestamp = result.created_at;
        }
        renderChatBackend();
      } else {
        // Fallback: optimistic local echo
        chatMessages.push({
          id: Date.now(),
          text: trimmed,
          created_at: Date.now(),
          ip: '',
          rdns: '',
        });
        renderChatBackend();
      }
    } else {
      console.log('[Chat] sending message (local only)', trimmed);
      const ts = new Date().toLocaleTimeString();
      yChat.insert(yChat.length, `${ts}|${trimmed}\n`);
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
  const btnExport  = document.getElementById('btn-export');
  const videoIndicator = document.getElementById('video-indicator');
  const videoPlayPause = document.getElementById('video-play-pause');
  const videoVolume = document.getElementById('video-volume');
  const videoSeek = document.getElementById('video-seek');
  const chatEl = document.getElementById('chat');
  const chatResizer = document.getElementById('chat-resizer');

  if (!btnClear || !btnTor || !brushColor || !brushSize || !shapeSel ||
      !btnUpload || !btnYoutube || !btnSticker || !btnGif) {
    console.warn('C64 init warning: some toolbar elements missing');
  }

  // Make chat sidebar width adjustable via drag handle
  if (chatEl && chatResizer) {
    let isResizing = false;

    const startResize = (event) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      event.preventDefault();
    };

    const stopResize = () => {
      if (!isResizing) return;
      isResizing = false;
      document.body.style.cursor = '';
    };

    const onResizeMove = (event) => {
      if (!isResizing) return;
      const point = event.touches && event.touches[0] ? event.touches[0] : event;
      const clientX = point.clientX;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      if (!viewportWidth || !clientX) return;

      const newChatWidthPx = viewportWidth - clientX;
      let newChatWidthPct = (newChatWidthPx / viewportWidth) * 100;
      const minPct = 18;
      const maxPct = 55;
      if (newChatWidthPct < minPct) newChatWidthPct = minPct;
      if (newChatWidthPct > maxPct) newChatWidthPct = maxPct;
      document.documentElement.style.setProperty('--c64-chat-width', `${newChatWidthPct}%`);
    };

    chatResizer.addEventListener('mousedown', startResize);
    chatResizer.addEventListener('touchstart', startResize, { passive: false });
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('touchmove', onResizeMove, { passive: false });
    window.addEventListener('mouseup', stopResize);
    window.addEventListener('touchend', stopResize);
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

  btnExport?.addEventListener('click', () => {
    try {
      const dataUrl = canvas.toDataURL({ format: 'png' });
      if (!dataUrl) {
        alert('Unable to export whiteboard image.');
        return;
      }
      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      const filename = `c64-board-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('[Export] Failed to export canvas', err);
      alert('Export failed.');
    }
  });

  btnTor?.addEventListener('click', () => {
    const newFlag = !torEnabled;
    setTorEnabled(newFlag);
    console.log('Tor mode toggled, now:', newFlag);
    renderConnectionStatus();
  });

  brushColor?.addEventListener('change', e => {
    canvas.freeDrawingBrush.color = e.target.value;
  });

  brushSize?.addEventListener('input', e => {
    canvas.freeDrawingBrush.width = parseInt(e.target.value, 10);
  });

  shapeSel?.addEventListener('change', e => {
    const value = e.target.value;
    currentTool = value;
    console.log('Shape selected:', value);
    canvas.isDrawingMode = value === 'free';
  });

  let currentVideoObjectUrl = null;
  const videoQueue = [];

  const playObjectUrl = (url) => {
    if (!bgVideo || !url) return;
    console.log('[Video] Playing background video.');
    bgVideo.src = url;
    bgVideo.play().catch(err => console.error('[Video] play() failed', err));
    videoState = 'local';
    renderConnectionStatus();
  };

  const playNextVideoInQueue = () => {
    if (currentVideoObjectUrl) {
      URL.revokeObjectURL(currentVideoObjectUrl);
      currentVideoObjectUrl = null;
    }
    const nextUrl = videoQueue.shift();
    if (!nextUrl) {
      videoState = 'none';
      renderConnectionStatus();
      return;
    }
    currentVideoObjectUrl = nextUrl;
    playObjectUrl(currentVideoObjectUrl);
  };

  if (bgVideo) {
    bgVideo.addEventListener('ended', () => {
      playNextVideoInQueue();
    });
  }

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

      const objectUrl = URL.createObjectURL(file);

      if (!currentVideoObjectUrl) {
        // No active video, play immediately
        currentVideoObjectUrl = objectUrl;
        console.log('[Video] Loaded local file as background video.');
        playObjectUrl(currentVideoObjectUrl);
      } else {
        // Queue for later playback
        videoQueue.push(objectUrl);
        console.log('[Video] Queued additional background video. Queue length:', videoQueue.length);
      }
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

  btnYoutube?.addEventListener('click', () => {
    const url = prompt('Enter YouTube video URL:');
    if (!url) return;

    const videoId = extractYouTubeId(url);
    if (!videoId) {
      alert('Could not extract a YouTube video ID from that URL.');
      return;
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

    videoState = 'youtube';
    currentVideoIndex = 0;
    renderConnectionStatus();
    updateVideoIndicator();
  });

  btnSticker?.addEventListener('click', () => {
    alert('Sticker upload – not yet implemented.');
  });

  btnGif?.addEventListener('click', () => {
    alert('GIF upload – not yet implemented.');
  });

  // Compact help overlay for first-time visitors
  const helpToggle = document.getElementById('help-toggle');
  const helpOverlay = document.getElementById('help-overlay');
  const helpClose = document.getElementById('help-close');
  const helpDontShow = document.getElementById('help-dont-show');
  const HELP_SEEN_KEY = 'c64_help_seen_v1';

  const setHelpVisibility = (visible) => {
    if (!helpOverlay) return;
    helpOverlay.hidden = !visible;
  };

  helpToggle?.addEventListener('click', () => {
    if (!helpOverlay) return;
    setHelpVisibility(helpOverlay.hidden);
  });

  helpClose?.addEventListener('click', () => {
    setHelpVisibility(false);
    if (helpDontShow && helpDontShow instanceof HTMLInputElement && helpDontShow.checked) {
      try {
        window.localStorage.setItem(HELP_SEEN_KEY, '1');
      } catch {
        // ignore storage errors
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && helpOverlay && !helpOverlay.hidden) {
      setHelpVisibility(false);
    }
  });

  try {
    const seen = window.localStorage.getItem(HELP_SEEN_KEY);
    if (!seen) {
      setHelpVisibility(true);
    }
  } catch {
    // If storage is unavailable, still show the overlay once.
    setHelpVisibility(true);
  }

  console.log('C64 chat & toolbar initialized');
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initC64App().catch(err => console.error('C64 init failed', err));
  }, { once: true });
} else {
  initC64App().catch(err => console.error('C64 init failed', err));
}
