import { createViewer } from './viewer.js';
import { createIdle } from './idle.js';
import { buildUI } from './ui.js';

const SMURF_GLB_URL = new URL('../../Smur_male6.glb', import.meta.url).href;

const canvas = document.getElementById('stage');
const panelsEl = document.getElementById('panels');
const statusEl = document.getElementById('status');

function setStatus(msg) { statusEl.textContent = msg; }

(async () => {
  const viewer = await createViewer(canvas, setStatus);

  // Idle controller — bound to the smurf armature once it loads.
  const idle = createIdle(null, null);
  viewer.setIdleUpdate(idle.update);

  viewer.onModelLoaded = (v) => {
    idle.rebind(v.armature, v.morphIndex);
    buildUI(panelsEl, { viewer: v, idle });
    const counts = [];
    counts.push(`${v.animations.size} animation${v.animations.size === 1 ? '' : 's'}`);
    counts.push(`${v.procAnimations.actions.size} procedural`);
    counts.push(`${v.morphIndex.allNames.length} morphs (${v.morphIndex.arkit.length} ARKit)`);
    if (v.armature?.hasSkeleton) counts.push(`rig: ${v.armature.rig}`);
    setStatus(`${v.currentFileName || 'model'} · ${counts.join(' · ')}`);
  };

  try {
    await viewer.loadGLB(SMURF_GLB_URL, 'Smur_male6.glb');
  } catch (err) {
    console.error(err);
    setStatus('Failed to load Smur_male6.glb — see console');
  }
})().catch((err) => {
  console.error(err);
  setStatus('Failed to initialize — see console');
});
