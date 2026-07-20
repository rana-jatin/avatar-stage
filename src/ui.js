import { setMorph, getMorph, resetMorphs, groupByRegion } from './morphs.js';
import { PRESETS, tweenPreset } from './presets.js';
import { textToVisemes, playVisemeSequence } from './lipsync.js';
import { ROLES } from './armature.js';

function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of [].concat(children)) {
    if (c == null) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
}

function panel(title, open = false) {
  const d = el('details', { className: 'panel', open });
  d.append(el('summary', {}, title));
  const body = el('div', { className: 'body' });
  d.append(body);
  return { root: d, body };
}

const ROLE_LABELS = {
  hip: 'Hip',
  spine: 'Spine',
  chest: 'Chest',
  upperChest: 'Upper Chest',
  neck: 'Neck',
  head: 'Head',
  leftShoulder: 'L Shoulder',
  leftUpperArm: 'L Upper Arm',
  leftLowerArm: 'L Forearm',
  leftHand: 'L Hand',
  leftThumbPalm: 'L Thumb Palm',
  leftIndexPalm: 'L Index Palm',
  leftMiddlePalm: 'L Middle Palm',
  leftRingPalm: 'L Ring Palm',
  leftPinkyPalm: 'L Pinky Palm',
  rightShoulder: 'R Shoulder',
  rightUpperArm: 'R Upper Arm',
  rightLowerArm: 'R Forearm',
  rightHand: 'R Hand',
  rightThumbPalm: 'R Thumb Palm',
  rightIndexPalm: 'R Index Palm',
  rightMiddlePalm: 'R Middle Palm',
  rightRingPalm: 'R Ring Palm',
  rightPinkyPalm: 'R Pinky Palm',
  leftUpperLeg: 'L Thigh',
  leftLowerLeg: 'L Shin',
  leftFoot: 'L Foot',
  rightUpperLeg: 'R Thigh',
  rightLowerLeg: 'R Shin',
  rightFoot: 'R Foot',
};

export function buildUI(container, ctx) {
  const { viewer, idle, onUploadFile } = ctx;
  const {
    animations,
    morphIndex,
    armature,
    procAnimations,
    frameHead,
    frameBody,
    currentFileName,
  } = viewer;

  container.innerHTML = '';

  // ----- Upload -----
  const up = panel('Upload', true);
  const fileInput = el('input', { type: 'file', accept: '.glb,.gltf', className: 'file-hidden' });
  const uploadBtn = el('button', { className: 'btn wide' }, 'Upload GLB / glTF');
  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) onUploadFile(f);
    fileInput.value = '';
  });
  const fileLabel = el(
    'div',
    { className: 'file-name' },
    currentFileName || '(demo model — drop a GLB on the stage to swap)',
  );
  up.body.append(uploadBtn, fileInput, fileLabel);
  container.append(up.root);

  // ----- Armature (summary + bone remap) -----
  const armP = panel('Armature', false);
  if (!armature || !armature.hasSkeleton) {
    armP.body.append(el('div', { className: 'empty' }, 'No skeleton detected in this GLB.'));
  } else {
    const meta = el('div', { className: 'meta-row' });
    meta.append(
      el('span', { className: 'tag' }, `rig: ${armature.rig}`),
      el('span', { className: 'tag' }, `${armature.bones.size} bones`),
    );
    armP.body.append(meta);

    // Per-role bone remap: lets you reassign which bone drives each humanoid
    // role when the detected mapping isn't quite right.
    const allBoneNames = [...armature.bones.keys()].sort();
    const overrideGrid = el('div', { className: 'override-grid' });
    for (const role of ROLES) {
      const cur = armature.resolved[role];
      const row = el('div', { className: 'override-row' });
      const lbl = el('label', { className: cur ? '' : 'missing' }, ROLE_LABELS[role] || role);
      const sel = el('select', { className: 'override-select' });
      sel.append(el('option', { value: '' }, '— none —'));
      for (const n of allBoneNames) {
        const opt = el('option', { value: n }, n);
        if (cur && cur.name === n) opt.selected = true;
        sel.append(opt);
      }
      sel.addEventListener('change', () => {
        armature.setOverride(role, sel.value);
        lbl.className = sel.value ? '' : 'missing';
        // Idle behaviors need to re-pick head/spine bones immediately.
        idle.rebind(armature, morphIndex);
      });
      row.append(lbl, sel);
      overrideGrid.append(row);
    }
    armP.body.append(overrideGrid);
    const hint = el(
      'div',
      { className: 'hint' },
      'Changing a bone here updates idle behaviors immediately. Procedural animations use the mapping captured when the model loaded.',
    );
    armP.body.append(hint);
  }
  container.append(armP.root);

  // ----- Animations -----
  const anim = panel('Animations', true);
  let currentAction = null;
  const animBtns = new Map();

  function stopAnimation() {
    if (currentAction) {
      currentAction.fadeOut(0.25);
      const ending = currentAction;
      setTimeout(() => ending.stop(), 260);
      animBtns.get(currentAction)?.classList.remove('active');
      currentAction = null;
    }
    idle.suppressHeadSway(false);
  }

  function playAnimation(action) {
    if (currentAction === action) return;
    if (currentAction) {
      currentAction.fadeOut(0.25);
      animBtns.get(currentAction)?.classList.remove('active');
    }
    action.reset().setEffectiveWeight(1).fadeIn(0.25).play();
    animBtns.get(action)?.classList.add('active');
    currentAction = action;
    idle.suppressHeadSway(true);
  }

  if (animations.size === 0) {
    anim.body.append(
      el(
        'div',
        { className: 'empty' },
        'No embedded animations in this model. Use the Procedural Animations panel.',
      ),
    );
  } else {
    const grid = el('div', { className: 'btn-grid' });
    for (const [name, action] of animations) {
      const b = el('button', { className: 'btn', title: name }, name);
      b.addEventListener('click', () => playAnimation(action));
      animBtns.set(action, b);
      grid.append(b);
    }
    const stopBtn = el('button', { className: 'btn danger wide' }, 'Stop animation');
    stopBtn.addEventListener('click', stopAnimation);
    anim.body.append(grid, stopBtn);
  }
  container.append(anim.root);

  // ----- Procedural animations -----
  const proc = panel(`Procedural Animations (${procAnimations.status.length})`, true);
  if (!armature || !armature.hasSkeleton) {
    proc.body.append(el('div', { className: 'empty' }, 'Requires a skinned mesh with a skeleton.'));
  } else {
    let currentProc = null;
    function stopProc() {
      if (currentProc) {
        currentProc.fadeOut(0.25);
        setTimeout(() => {
          try {
            currentProc.stop();
          } catch {}
        }, 260);
        currentProc = null;
      }
      idle.suppressHeadSway(false);
    }
    function playProc(action) {
      if (currentProc === action) return;
      if (currentProc) currentProc.fadeOut(0.25);
      action.reset().setEffectiveWeight(1).fadeIn(0.25).play();
      currentProc = action;
      // Procedural anims are additive; idle sway is fine to continue.
    }
    const procGrid = el('div', { className: 'btn-grid' });
    for (const s of procAnimations.status) {
      const action = procAnimations.actions.get(s.name);
      const b = el(
        'button',
        {
          className: 'btn' + (s.ready ? '' : ' disabled'),
          title: s.ready ? s.name : `Missing bones: ${s.missing.join(', ')}`,
          disabled: !s.ready,
        },
        s.name,
      );
      if (action) b.addEventListener('click', () => playProc(action));
      procGrid.append(b);
    }
    const stopBtn = el('button', { className: 'btn danger wide' }, 'Stop procedural');
    stopBtn.addEventListener('click', stopProc);
    proc.body.append(procGrid, stopBtn);
  }
  container.append(proc.root);

  // ----- Expressions -----
  const exp = panel('Expression presets', false);
  const expGrid = el('div', { className: 'btn-grid' });
  let tweening = false;
  for (const name of Object.keys(PRESETS)) {
    const b = el('button', { className: 'btn' }, name);
    b.addEventListener('click', async () => {
      if (tweening) return;
      tweening = true;
      await tweenPreset(morphIndex, setMorph, getMorph, name);
      tweening = false;
      refreshSliders();
    });
    expGrid.append(b);
  }
  exp.body.append(expGrid);
  container.append(exp.root);

  // ----- Idle behaviors -----
  const idleP = panel('Idle behaviors', false);
  const toggle = (label, initial, onChange) => {
    const row = el('label', { className: 'toggle-row' });
    const cb = el('input', { type: 'checkbox', checked: initial });
    cb.addEventListener('change', () => onChange(cb.checked));
    row.append(el('span', {}, label), cb);
    return row;
  };
  idleP.body.append(
    toggle('Auto-blink', idle.state.blink.enabled, (v) => idle.setBlinkEnabled(v)),
    toggle('Breathing', idle.state.breathing.enabled, (v) => idle.setBreathingEnabled(v)),
    toggle('Head sway', idle.state.headSway.enabled, (v) => idle.setHeadSwayEnabled(v)),
  );
  container.append(idleP.root);

  // ----- Camera -----
  const cam = panel('Camera', false);
  const camGrid = el('div', { className: 'btn-grid' });
  const headBtn = el('button', { className: 'btn' }, 'Frame head');
  headBtn.addEventListener('click', frameHead);
  const bodyBtn = el('button', { className: 'btn' }, 'Frame body');
  bodyBtn.addEventListener('click', frameBody);
  camGrid.append(headBtn, bodyBtn);
  cam.body.append(camGrid);
  container.append(cam.root);

  // ----- Lip-sync test -----
  const lip = panel('Lip-sync test (no audio)', false);
  const lipInput = el('input', { type: 'text', className: 'search', value: 'hello world' });
  const lipBtn = el('button', { className: 'btn wide' }, 'Play viseme sequence');
  let cancelLip = null;
  lipBtn.addEventListener('click', () => {
    if (cancelLip) {
      cancelLip();
      cancelLip = null;
    }
    const seq = textToVisemes(lipInput.value);
    cancelLip = playVisemeSequence(morphIndex, seq, 95);
  });
  lip.body.append(lipInput, lipBtn);
  container.append(lip.root);

  // ----- Blendshape sliders -----
  const sl = panel(`Blendshape sliders (${morphIndex.allNames.length})`, false);
  if (morphIndex.allNames.length === 0) {
    sl.body.append(el('div', { className: 'empty' }, 'No morph targets on this model.'));
  } else {
    const search = el('input', {
      type: 'search',
      className: 'search',
      placeholder: 'Filter morphs…',
    });
    sl.body.append(search);
    const groupContainer = el('div');
    sl.body.append(groupContainer);

    const listed = morphIndex.arkit.length > 0 ? morphIndex.arkit : morphIndex.allNames;
    const groups = groupByRegion(listed);
    const sliderRows = [];

    function makeRow(name) {
      const row = el('div', { className: 'slider-row' });
      const labelEl = el('label', { title: name }, name);
      const input = el('input', { type: 'range', min: 0, max: 1, step: 0.01 });
      const val = el('span', { className: 'val' }, '0.00');
      input.value = getMorph(morphIndex, name).toFixed(2);
      val.textContent = Number(input.value).toFixed(2);
      input.addEventListener('input', () => {
        setMorph(morphIndex, name, Number(input.value));
        val.textContent = Number(input.value).toFixed(2);
      });
      row.append(labelEl, input, val);
      sliderRows.push({ row, input, val, name });
      return row;
    }

    for (const [region, names] of groups) {
      const g = el('div', { className: 'slider-group' });
      g.append(el('h3', {}, region));
      for (const n of names) g.append(makeRow(n));
      groupContainer.append(g);
    }

    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      for (const { row, name } of sliderRows) {
        row.style.display = name.toLowerCase().includes(q) ? '' : 'none';
      }
    });

    function refreshSliders() {
      for (const { input, val, name } of sliderRows) {
        const v = getMorph(morphIndex, name);
        input.value = v.toFixed(2);
        val.textContent = v.toFixed(2);
      }
    }
    // Expose refresh to expression-preset callback above.
    container.refreshSliders = refreshSliders;

    const resetBtn = el('button', { className: 'btn danger wide' }, 'Reset all morphs');
    resetBtn.style.marginTop = '8px';
    resetBtn.addEventListener('click', () => {
      resetMorphs(morphIndex);
      refreshSliders();
    });
    sl.body.append(resetBtn);
  }
  container.append(sl.root);

  // Allow expression presets to refresh sliders without circular ref.
  function refreshSliders() {
    if (typeof container.refreshSliders === 'function') container.refreshSliders();
  }
}
