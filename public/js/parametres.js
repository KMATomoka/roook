// Page Paramètres : son, partie, affichage. Tout est enregistré dans ce navigateur (localStorage) et s'applique
// tout de suite : les autres pages relisent ces réglages au chargement.
import { $, Chess, getPref, setPref } from './common.js';
import './compte.js'; // barre du haut, menu
import { isMuted, setMuted, isMusicOn, setMusicOn, getVolume, setVolume, playSound } from './sound.js';
import { toast } from './compte.js';

const DEFAULTS = { coups: true, coords: true, autoDame: false, premove: '0', effets: true };

function load() {
  $('#set-sound').checked = !isMuted();
  $('#set-volume').value = Math.round(getVolume() * 100);
  $('#set-volume-txt').textContent = `${Math.round(getVolume() * 100)} %`;
  $('#set-music').checked = isMusicOn();
  $('#set-dests').checked = getPref('coups', DEFAULTS.coups);
  $('#set-coords').checked = getPref('coords', DEFAULTS.coords);
  $('#set-autoqueen').checked = getPref('autoDame', DEFAULTS.autoDame);
  $('#set-premove').checked = getPref('premove', DEFAULTS.premove) === '1';
  $('#set-fx').checked = getPref('effets', DEFAULTS.effets);
  // Sans son, le volume et la musique n'ont pas d'effet
  const off = isMuted();
  for (const id of ['#set-volume', '#set-music', '#set-test']) $(id).disabled = off;
}

const capture = () => new Chess('rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3').move('Nxh4');

$('#set-sound').addEventListener('change', (e) => {
  setMuted(!e.target.checked);
  load();
  if (e.target.checked) playSound(capture(), 'neutral');
});
$('#set-volume').addEventListener('input', (e) => {
  setVolume(Number(e.target.value) / 100);
  $('#set-volume-txt').textContent = `${e.target.value} %`;
});
// En lâchant le curseur : un petit son, pour entendre le nouveau volume
$('#set-volume').addEventListener('change', () => playSound(capture(), 'neutral'));
$('#set-music').addEventListener('change', (e) => setMusicOn(e.target.checked));
$('#set-test').addEventListener('click', () => playSound(capture(), 'neutral'));
$('#set-dests').addEventListener('change', (e) => setPref('coups', e.target.checked));
$('#set-coords').addEventListener('change', (e) => setPref('coords', e.target.checked));
$('#set-autoqueen').addEventListener('change', (e) => setPref('autoDame', e.target.checked));
$('#set-premove').addEventListener('change', (e) => setPref('premove', e.target.checked ? '1' : '0'));
$('#set-fx').addEventListener('change', (e) => setPref('effets', e.target.checked));
$('#set-reset').addEventListener('click', () => {
  for (const [k, v] of Object.entries(DEFAULTS)) setPref(k, v);
  setMuted(false);
  setVolume(1);
  setMusicOn(true);
  load();
  toast('Réglages remis par défaut.', { cls: 'info', duration: 2200 });
});

load();
