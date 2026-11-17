# Modules complémentaires de Three.js (examples/jsm)

- Version : three@0.160.1 (npm), révision 160, identique à `js/vendor/three.module.min.js` (`const t="160"`).
- Copiés le 14/11/2026 depuis `node_modules/three/examples/jsm/` (installé dans `_CHANTIER_TALENT/ecosysteme/outils/`).
- Licence : MIT, copyright 2010-2023 Three.js Authors (fichier `LICENSE`). Le transcodeur Basis (`libs/basis/`) : `basis_transcoder.js` est sans en-tête de licence dans le fichier ; projet Basis Universal (Binomial LLC), licence Apache-2.0 d'après son dépôt ; non utilisé par la page, à ne pas publier.
- Aucune requête vers un autre domaine : le transcodeur et les modules sont servis par le site.

## Fichiers
LICENSE environments/RoomEnvironment.js libs/basis/basis_transcoder.js libs/basis/basis_transcoder.wasm libs/ktx-parse.module.js libs/zstddec.module.js loaders/KTX2Loader.js loaders/SVGLoader.js postprocessing/EffectComposer.js postprocessing/MaskPass.js postprocessing/OutputPass.js postprocessing/Pass.js postprocessing/RenderPass.js postprocessing/ShaderPass.js postprocessing/UnrealBloomPass.js shaders/CopyShader.js shaders/LuminosityHighPassShader.js shaders/OutputShader.js utils/WorkerPool.js 

## Modification faite
Une seule : dans chaque module qui l'importe, la ligne `} from 'three';` est remplacée par `} from '../../three.module.min.js';` (chemin relatif vers `js/vendor/three.module.min.js`, sans outil de construction ni import map). 10 fichiers :
`environments/RoomEnvironment.js` (l. 13), `postprocessing/Pass.js` (l. 6), `postprocessing/ShaderPass.js` (l. 4), `postprocessing/RenderPass.js` (l. 3), `postprocessing/UnrealBloomPass.js` (l. 11), `postprocessing/OutputPass.js` (l. 11), `postprocessing/EffectComposer.js` (l. 7), `shaders/LuminosityHighPassShader.js` (l. 3), `loaders/KTX2Loader.js` (l. 45), `loaders/SVGLoader.js` (l. 15).
Rien d'autre n'est changé. Note : `js/talents/frise.js` n'importe pas Three.js (seulement GSAP côté talents.js) ; le chemin relatif ci-dessus est donc la convention retenue.

## Utilisation
```js
import { RoomEnvironment } from './vendor/three-addons/environments/RoomEnvironment.js';
const ktx2 = new KTX2Loader().setTranscoderPath('/js/vendor/three-addons/libs/basis/').detectSupport(renderer);
```
Essai réel : `_CHANTIER_TALENT/ecosysteme/outils/essais/essai.html`.

## Licences des sous-parties
`libs/basis/` : Apache-2.0 (README de Three.js, dépôt BinomialLLC/basis_universal). `libs/zstddec.module.js` et `libs/ktx-parse.module.js` : MIT (Don McCurdy), fournis par Three.js.
