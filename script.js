import { isAutoplay, mountReel } from './reel/reel.js';

const card = document.querySelector('.invite');
const field = card.querySelector('.field');
const link = card.querySelector('.link');
const sweep = card.querySelector('.sweep');
const button = card.querySelector('.copy');
const label = button.querySelector('.copy-label');
const iconCopy = button.querySelector('.icon-copy');
const iconCheck = button.querySelector('.icon-check');
const iconError = button.querySelector('.icon-error');
const ring = button.querySelector('.ring rect');
const tip = card.querySelector('.tip');
const status = document.querySelector('[role="status"]');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// The reel and its recordings always use the light theme.
if (isAutoplay) document.documentElement.dataset.reel = '';

const HOLD = 2000; // how long "Copied" stays before the button resets
let resetTimer = 0;
let busy = false;

/** Writes the label one letter per span so the letters can roll in one after another. */
function setLabel(text, roll = true) {
  label.setAttribute('aria-hidden', 'true');
  label.replaceChildren(...[...text].map((ch) => Object.assign(document.createElement('span'), { className: 'ch', textContent: ch })));
  button.setAttribute('aria-label', text === 'Copy' ? 'Copy invite link' : text);
  if (!roll || reduceMotion.matches) return;
  [...label.children].forEach((ch, i) => ch.animate(
    { translate: ['0 110%', '0 0'], opacity: [0, 1] },
    { duration: 300, delay: i * 28, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'backwards' },
  ));
}

/** Swaps which of the three icons is showing: the old one spins out, the new one spins in. */
function showIcon(next) {
  for (const icon of [iconCopy, iconCheck, iconError]) {
    const on = icon === next;
    const was = getComputedStyle(icon).opacity !== '0';
    icon.style.opacity = on ? '1' : '0';
    icon.style.scale = on ? '1' : '0.3';
    icon.style.rotate = on ? '0deg' : '-90deg';
    if (reduceMotion.matches || on === was) continue;
    icon.animate(
      on ? { opacity: [0, 1], scale: [0.3, 1.25, 1], rotate: ['-90deg', '8deg', '0deg'] } : { opacity: [1, 0], scale: [1, 0.3], rotate: ['0deg', '90deg'] },
      { duration: on ? 420 : 200, easing: on ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'ease-in' },
    );
  }
}

/**
 * The copy itself, made visible: the link is highlighted left to right, then a copy of it lifts
 * off and flies into the button, which swallows it with a squash.
 */
async function flyCopy() {
  const linkBox = link.getBoundingClientRect();
  const fieldBox = field.getBoundingClientRect();
  const buttonBox = button.getBoundingClientRect();
  const scale = fieldBox.width / field.offsetWidth; // the reel stage is scaled down
  const width = Math.min(link.scrollWidth, link.clientWidth);

  sweep.animate({ width: ['0px', `${width}px`], opacity: [1, 1] }, { duration: 240, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
  await new Promise((r) => setTimeout(r, 200));

  const ghost = document.createElement('span');
  ghost.className = 'ghost';
  ghost.textContent = link.textContent;
  ghost.style.left = `${(linkBox.left - fieldBox.left) / scale}px`;
  ghost.style.top = `${(linkBox.top - fieldBox.top) / scale}px`;
  field.append(ghost);
  const dx = (buttonBox.left + buttonBox.width / 2 - linkBox.left) / scale - ghost.offsetWidth / 2;
  await ghost.animate(
    [
      { translate: '0 0', scale: 1, rotate: '0deg', opacity: 0 },
      { translate: '0 -16px', scale: 1.04, rotate: '-2deg', opacity: 1, offset: 0.3 },
      { translate: `${dx}px -6px`, scale: 0.25, rotate: '4deg', opacity: 0.9 },
    ],
    { duration: 520, easing: 'cubic-bezier(0.5, 0, 0.2, 1)' },
  ).finished;
  ghost.remove();
  sweep.animate({ opacity: [1, 0] }, { duration: 400, fill: 'forwards' });
  button.animate({ scale: ['1 1', '1.1 0.86', '0.96 1.05', '1 1'] }, { duration: 420, easing: 'ease-out' });
}

function showTip() {
  tip.style.opacity = '1';
  if (reduceMotion.matches) return;
  tip.animate({ opacity: [0, 1], translate: ['0 8px', '0 0'], scale: [0.85, 1] }, { duration: 320, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
}

function hideTip() {
  tip.style.opacity = '0';
  if (!reduceMotion.matches) tip.animate({ opacity: [1, 0], translate: ['0 0', '0 4px'] }, { duration: 180 });
}

/** Clipboard API with a fallback for older browsers and non-secure pages. */
async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = Object.assign(document.createElement('textarea'), { value: text });
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy refused');
}

function resetButton() {
  clearTimeout(resetTimer);
  button.classList.remove('is-error');
  hideTip();
  showIcon(iconCopy);
  setLabel('Copy');
  busy = false;
}

async function copy() {
  if (busy) return;
  busy = true;
  clearTimeout(resetTimer);
  if (!reduceMotion.matches) button.animate({ scale: [1, 0.94, 1] }, { duration: 160 });
  try {
    await writeClipboard(link.textContent);
  } catch {
    // Refused (permissions, an insecure page): select the link so Ctrl/Cmd+C still works.
    getSelection().selectAllChildren(link);
    button.classList.add('is-error');
    showIcon(iconError);
    setLabel('Ctrl+C');
    status.textContent = "Couldn't copy automatically. The link is selected, press Ctrl+C or Cmd+C.";
    if (!reduceMotion.matches) button.animate({ translate: ['0 0', '-6px 0', '5px 0', '-3px 0', '0 0'] }, { duration: 380 });
    resetTimer = setTimeout(resetButton, 3200);
    return;
  }
  status.textContent = 'Invite link copied to clipboard';
  if (!reduceMotion.matches) await flyCopy();
  showIcon(iconCheck);
  setLabel('Copied');
  showTip();
  if (!reduceMotion.matches) ring.animate({ strokeDashoffset: [0, 100], opacity: [1, 1] }, { duration: HOLD, easing: 'linear' });
  resetTimer = setTimeout(resetButton, HOLD);
}

button.addEventListener('click', () => { void copy(); });
setLabel('Copy', false);

function reset() {
  for (const el of [button, ring, tip, sweep, iconCopy, iconCheck, iconError]) el.getAnimations().forEach((a) => a.cancel());
  field.querySelectorAll('.ghost').forEach((el) => el.remove());
  sweep.style.width = '0';
  getSelection().removeAllRanges();
  resetButton();
  status.textContent = '';
}

/* ---------- Reel mode ---------- */

// Reel recordings run in a headless browser that may refuse the clipboard: pretend it worked.
if (isAutoplay && navigator.clipboard) navigator.clipboard.writeText = () => Promise.resolve();

mountReel({
  eyebrow: 'UI animation #11',
  title: 'Did it',
  accent: 'copy?',
  demo: card,
  demoScale: 1.9,
  file: 'copy-button-animation/script.js',
  code: `
// Show the copy happening: a copy of the
// link lifts off and flies into the button.
ghost.animate([
  { translate: '0 0', opacity: 0 },
  { translate: '0 -16px', opacity: 1, offset: 0.3 },
  { translate: \`\${dx}px -6px\`, scale: 0.25 },
], { duration: 520 });`,
  reset,
  async play({ cursor, sleep }) {
    await sleep(700);
    await cursor.click(button);
    cursor.park();
    await sleep(2900);
    await cursor.click(button);
    cursor.park();
    await sleep(2900);
  },
});
