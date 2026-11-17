// Choix du palier de qualité par detect-gpu, avec les données hébergées dans le site.
// Rend 'haut' (niveau 3 et WebGL2), 'moyen' (niveau 2), 'bas' (niveau 1) ou 'aucun' (niveau 0 ou sans WebGL).
// (n'importe pas index.js : le choix du palier ne doit pas charger Three.js)
const webgl2 = () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } };

export async function choisirPalier() {
  if (!webgl2()) return 'aucun';
  try {
    const { getGPUTier } = await import('../../vendor/detect-gpu/index.mjs');
    const benchmarksURL = new URL('../../vendor/detect-gpu/benchmarks', import.meta.url).href;
    const r = await getGPUTier({ benchmarksURL });
    return ['aucun', 'bas', 'moyen', 'haut'][r.tier] ?? 'bas';
  } catch (e) {
    return 'bas'; // données illisibles : prudence
  }
}
