import { createViewer } from './viewer.js';
import { createIdle } from './idle.js';
import { buildUI } from './ui.js';

// Bundled demo model, served from public/. BASE_URL keeps the path correct
// when the site is deployed under a sub-path (e.g. GitHub Pages).
const DEMO_GLB_URL = `${import.meta.env.BASE_URL}models/demo-avatar.glb`;
const DEMO_GLB_NAME = 'demo-avatar.glb';

const canvas = document.getElementById('stage');
const panelsEl = document.getElementById('panels');
const statusEl = document.getElementById('status');

function setStatus(msg) {
  statusEl.textContent = msg;
}

(async () => {
  const viewer = await createViewer(canvas, setStatus);

  // Persistent idle controller — rebinds to each new armature.
  const idle = createIdle(null, null);
  viewer.setIdleUpdate(idle.update);

  async function onUploadFile(file) {
    setStatus(`Loading ${file.name}…`);
    try {
      const buf = await file.arrayBuffer();
      await viewer.loadGLB(buf, file.name);
    } catch (err) {
      console.error(err);
      setStatus(`Failed to load ${file.name}: ${err.message || err}`);
    }
  }

  viewer.onModelLoaded = (v) => {
    idle.rebind(v.armature, v.morphIndex);
    buildUI(panelsEl, { viewer: v, idle, onUploadFile });
    const counts = [];
    counts.push(`${v.animations.size} animation${v.animations.size === 1 ? '' : 's'}`);
    counts.push(`${v.procAnimations.actions.size} procedural`);
    counts.push(`${v.morphIndex.allNames.length} morphs (${v.morphIndex.arkit.length} ARKit)`);
    if (v.armature?.hasSkeleton) counts.push(`rig: ${v.armature.rig}`);
    setStatus(`${v.currentFileName || 'model'} · ${counts.join(' · ')}`);
  };

  // Drag-and-drop a GLB onto the stage.
  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && /\.(glb|gltf)$/i.test(file.name)) onUploadFile(file);
  });

  // Render the upload-only UI immediately so the user can pick a file even if
  // the demo model fails to load.
  buildUI(panelsEl, { viewer, idle, onUploadFile });

  try {
    await viewer.loadGLB(DEMO_GLB_URL, DEMO_GLB_NAME);
  } catch (err) {
    console.error(err);
    setStatus('Demo model unavailable — upload a GLB to begin.');
  }
})().catch((err) => {
  console.error(err);
  setStatus('Failed to initialize — see console');
});
