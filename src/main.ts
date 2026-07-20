import { createViewer } from './viewer';
import type { Viewer } from './viewer';
import { createIdle } from './idle';
import { buildUI } from './ui';

// Bundled demo model, served from public/. BASE_URL keeps the path correct
// when the site is deployed under a sub-path (e.g. GitHub Pages).
const DEMO_GLB_URL = `${import.meta.env.BASE_URL}models/demo-avatar.glb`;
const DEMO_GLB_NAME = 'demo-avatar.glb';

function mustGet<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id} in index.html`);
  return node as T;
}

const canvas = mustGet<HTMLCanvasElement>('stage');
const panelsEl = mustGet<HTMLElement>('panels');
const statusEl = mustGet<HTMLElement>('status');

function setStatus(msg: string) {
  statusEl.textContent = msg;
}

(async () => {
  const viewer = createViewer(canvas, setStatus);

  // Persistent idle controller — rebinds to each new armature.
  const idle = createIdle(null, null);
  viewer.setIdleUpdate(idle.update);

  async function onUploadFile(file: File) {
    setStatus(`Loading ${file.name}…`);
    try {
      const buf = await file.arrayBuffer();
      await viewer.loadGLB(buf, file.name);
    } catch (err) {
      console.error(err);
      setStatus(`Failed to load ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  viewer.onModelLoaded = (v: Viewer) => {
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
    if (file && /\.(glb|gltf)$/i.test(file.name)) void onUploadFile(file);
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
