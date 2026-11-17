// Table du temps de « Le troisième serviteur », scènes 0 à 13 (v2).
// Bornes de scènes 0 à 13 ; arrêt de l'horloge à 92,0.
// Seule source des bornes de scènes pour la page. Données seulement : aucune logique, aucun effet.
// T en secondes (0 = clic sur « Commencer, avec le son ») ; défilement en écrans (1 écran = 100 svh).

// Bornes des scènes : [T début, T fin] et [y début, y fin] en écrans.
export const SCENES = [
  { n: 0, nom: 'le seuil',       t: [0.0, 3.0],   y: [0.00, 1.00] },
  { n: 1, nom: 'le don',         t: [3.0, 11.0],  y: [1.00, 2.50] },
  { n: 2, nom: 'le départ',      t: [11.0, 16.0], y: [2.50, 3.50] },
  { n: 3, nom: 'la peur',        t: [16.0, 29.0], y: [3.50, 6.00] },
  { n: 4, nom: 'le fond',        t: [29.0, 38.0], y: [6.00, 7.50] },
  { n: 5, nom: 'le retour',      t: [38.0, 44.0], y: [7.50, 8.50] },
  { n: 6, nom: 'l’aveu',         t: [44.0, 52.0], y: [8.50, 10.00] },
  { n: 7, nom: 'la bascule',     t: [52.0, 57.0], y: [10.00, 11.00] },
  { n: 8, nom: 'creuser',        t: [57.0, 64.8], y: [11.00, 12.50] },
  { n: 9, nom: 'la révélation',  t: [64.8, 74.0], y: [12.50, 14.00] },
  { n: 10, nom: 'le livre',      t: [74.0, 84.0], y: [14.00, 15.50] },
  { n: 11, nom: 'les deux portes', t: [84.0, 92.0], y: [15.50, 16.50] },
];

// Fin de l'horloge et longueur du défilement des scènes 0 à 11.
export const FIN = 92.0;
export const ECRANS = 16.5;

// Passage d'une scène à la suivante, compté dans la scène qui commence.
export const PASSAGE = 1.05;

// Scène 3, mode automatique : neuf crans (pelletées), puis 0,25 écran linéaire de 28,0 à 29,0.
export const CRANS3 = [16.6, 17.9, 19.1, 20.4, 21.8, 23.1, 24.5, 26.0, 27.6];
export const CRAN3 = { pas: 0.25, duree: 0.45, finLineaire: [28.0, 29.0], pasFinal: 0.25 };

// Immobilités voulues du mode automatique : la page ne défile pas entre debut et fin (l'horloge, elle, avance),
// puis rattrape la position du mode libre en `rattrapage` secondes. Choisies dans des moments où rien ne bouge
// (le retour au T de la position, si le visiteur reprend la main pendant l'immobilité, ne se voit pas).
// Critère du brief : à T = 12,5 ; 45,0 ; 64,0, scrollY ne bouge pas de plus de 2 px en 1 s.
export const IMMOBILES = [
  { debut: 12.45, fin: 14.50, rattrapage: 0.80 },   // scène 2 : la porte a claqué, « puis il part. » est entré
  { debut: 44.95, fin: 50.40, rattrapage: 0.70 },   // scène 6 : l'aveu, silence total 44,0 → 46,5
  { debut: 63.00, fin: 65.05, rattrapage: 0.80 },   // scène 8 → 9 : le souffle retenu, silence total 63,0 → 64,8
];

// Scène 8 : la fenêtre du geste.
export const GESTE8 = { debut: 57.0, fin: 63.0, retraitSeul: 6.0, silence: [63.0, 64.8], indice: 59.0, chuteTerre: 0.6 };

// Retour au seuil si le clic « Commencer » arrive après un défilement.
export const RETOUR_SEUIL = { seuilPx: 8, duree: 0.9 };
// « Reprendre » apparaît 0,4 s après la reprise de main ; s'efface en 0,25 s.
export const REPRENDRE = { apparition: 0.4, effacement: 0.25 };

// Entrées et sorties des textes. entree : T où la première ligne commence à monter ;
// sortie : T où la sortie (0,6 s) commence. Les sorties de T3.1 et T3.2 sont un choix de la page.
export const TEXTES = {
  'titre':  { entree: null, sortie: 0.4 },    // bloc du seuil : présent avant le clic, sort de 0,4 à 1,0
  'T1.1':   { entree: 3.6,  sortie: 10.2 },
  'T2.1':   { entree: 11.6, sortie: 15.4 },
  'T3.i':   { entree: 16.6, sortie: 28.8 },
  'T3.1':   { entree: 17.0, sortie: 22.6 },
  'T3.2':   { entree: 23.4, sortie: 28.4 },
  'T4.1':   { entree: 31.0, sortie: 37.0 },
  'strates':{ entree: 32.0, sortie: 37.0 },
  'T5.1':   { entree: 39.0, sortie: 43.2 },
  'T6.1':   { entree: 44.6, sortie: 51.2 },
  'T6.2':   { entree: 45.4, sortie: 51.2 },
  'T7.1':   { entree: 52.3, sortie: 57.6 },   // lisible 5,3 s (sortie 57,6 → 58,2)
  'T8.1':   { entree: 58.4, sortie: 63.0 },   // sort plus tôt si la pièce est libérée par le geste
  'T9.1a':  { entree: 67.0, sortie: 74.0 },   // les deux phrases sortent ensemble, 74,0 → 74,6
  'T9.1b':  { entree: 69.0, sortie: 74.0 },
  // scène 10 : sortie de tous les textes 84,0 → 84,6
  'T10.1':  { entree: 78.2, sortie: 84.0 },
  'T10.2':  { entree: 78.6, sortie: 84.0 },
  'T10.3':  { entree: 79.2, sortie: 84.0 },
  'T10.5':  { entree: 79.9, sortie: 84.0 },
  // scène 11 : aucune sortie d'horloge ; sortie menée par le défilement (scène 12 a). sansMontee : opacité seule.
  'T11.1':  { entree: 86.2, sortie: Infinity, sortieY: [16.50, 16.62] },
  'T11.2':  { entree: 87.0, sortie: Infinity, sortieY: [16.50, 16.62] },
  'PV6':    { entree: 86.6, sortie: Infinity, sortieY: [16.50, 16.70], sansMontee: true },
  'PV7':    { entree: 86.6, sortie: Infinity, sortieY: [16.50, 16.70], sansMontee: true },
  'B11.1':  { entree: 87.4, sortie: Infinity, sortieY: [16.50, 16.70], sansMontee: true },   // « Acheter le tome 1 »
  'B11.2':  { entree: 87.53, sortie: Infinity, sortieY: [16.50, 16.70], sansMontee: true }, // « Lire l’introduction »
  'T10.6':  { entree: 87.8, sortie: Infinity, sortieY: [16.50, 16.70], sansMontee: true },
  'PV8':    { entree: 87.8, sortie: Infinity, sortieY: [16.50, 16.70], sansMontee: true, fonduLignes: true },   // chaque ligne ne se montre qu'entière dans son masque, puis se fond (jamais lue coupée)
};
// Couverture du tome 1 : demandée au repos dès T ≥ 30 ou 6 écrans (jamais pendant la scène 8).
export const COUVERTURE = { t: 30, ecrans: 6 };
export const ENTREE = { duree: 0.9, ecartLignes: 0.13 };   // chaque ligne monte derrière son masque (expoOut)
export const SORTIE = { duree: 0.6, montee: 12 };          // opacité 1 → 0 et montée de 12 px (power1InOut)

// La porte (scènes 0 à 2 ).
export const PORTE = {
  fente: { avant: 3, ouverte: [14, 18, 22], ouverture: [1.0, 2.6] },   // px à 390 / 768 / 1440 ; power2InOut
  claque: { t: 11.0, duree: 0.12 },                                    // power2In
  effacement: [16.0, 17.0],
};

// Le repère de profondeur : « 2025 », « 2002 », « quarante ans ».
export const REPERE = {
  entree: [29.0, 29.6],
  valeurs: [ { t: 31.0, v: '2025' }, { t: 33.5, v: '2002' }, { t: 36.0, v: 'quarante ans' } ],
  fondu: 0.3,
  attenue: [38.0, 0.8],          // à partir de 38,0, opacité 0,8
  remontee: [64.8, 67.2],        // le point remonte en haut du filet
  effaceValeur: 65.4,
  fin: 67.2,
  coups: [31.0, 33.5, 36.0],     // la pièce descend d'un tiers à chaque coup (0,5 s, power2In)
};

// Instants figés des planches statiques, pour les sons de la planche visible en mouvement réduit.
export const PLANCHES = [0, 9.0, 13.0, 24.0, 37.0, 41.0, 47.0, 56.0, 62.0, 70.0, 82.0, 90.0, 92.0];   // planches 10, 11, 12 : T = 82, 90, et la fin

// Lots de chargement, en écrans de défilement ou en T.
export const LOTS = { entree: { ecrans: 0.3, repos: 1500 }, terre: { t: 8, ecrans: 2.0 }, livre: { t: 50, ecrans: 9.0 }, suite: { t: 84, ecrans: 15.0 } };

/* ================= Scènes 10 à 13 ================= */
// Les tableaux à trois valeurs sont dans l'ordre 390 / 768 / 1440 (largeur < 600, < 1100, au-delà).

// Scène 10 : la couverture sort de l'empreinte, puis glisse au seuil de la porte 1 (§ 2).
export const COUV = {
  entree: [77.4, 78.6], montee: [16, 20, 24],          // opacité 0 → 1 (expoOut) et 16 / 20 / 24 px vers le haut
  glisse: [84.4, 86.4],                                // translation et échelle uniforme (power2InOut)
  sortieY: [16.50, 16.70],                             // scène 12 a : opacité seule
  lys: { x: 0.49, y: 0.516, h: 0.492 },                // lys de la couverture (fractions de l'image)
  lysEmpreinte: { h: 0.426, centre: 0.463 },           // lys de l'empreinte (fractions de D, centre depuis le haut du disque)
  // repli si la scène ne donne pas getState().empreinte : centre (x en fraction de W, y en fraction de h), diamètre en px à la hauteur de référence
  empreinte: [ { x: 0.5, y: 0.370, d: 270, href: 844 }, { x: 0.5, y: 0.371, d: 347, href: 1024 }, { x: 960 / 1440, y: 0.560, d: 582, href: 900 } ],
  porte: [ { l: 100, haut: 0.375 }, { l: 140, haut: 0.370 }, { l: 160, haut: 0.375 } ],   // dans la porte 1, centrée sur elle
  ombre: [10, 14, 16],                                 // ombre de contact sous la couverture (hauteur, px)
};

// Scène 11 : les deux portes (§ 2), les flaques, les boutons.
export const PORTES = {
  trace: [84.6, 85.4], ouverture: [85.4, 86.6],        // cadres tracés depuis le seuil ; battants qui s’ouvrent (power2InOut) ; fin 87,0 → 86,6 pour être à mi-course à 86,0
  // marge, écart, largeur maximale ; haut et seuil en fraction de h
  geo: [ { marge: 12, ecart: 56, l: 155, haut: 0.310, seuil: 0.700 }, { marge: 44, ecart: 100, l: 290, haut: 0.300, seuil: 0.740 }, { marge: 360, ecart: 120, l: 300, haut: 0.300, seuil: 0.800 } ],
  battant: [18, 30, 34], bande: [10, 14, 16],          // battant ouvert, trapèze en perspective (px,  I1 c : 22 demandés à 390, 18 tenus pour laisser 4 px entre les textes de 111 px et les battants) ; bande Incandescence du seuil (px)
  cadre: { linteau: [6, 8, 10], montant: [4, 5, 6], fuite: 0.035 },   // linteau et montants Ardoise (px) ; chant libre du battant ouvert raccourci de 3,5 % de h en haut et en bas
  sol: { pas: [5, 9], visible: 0.6, hors: 0.08 },      // gravure du sol : lignes de 1 px Or bruni, pas de 5 px au seuil à 9 px à 0,16 h ; 60 % dans les flaques, 8 % hors
  flaque: { prof: 0.16, evase: 1.4, fondu: [24, 32, 40] },
  boutons: [ { l: 168, haut: 0.735 }, { l: 240, haut: 0.775 }, { l: 260, haut: 0.835 } ],
  nuit: [83.9, 84.0],                                  // la nuit de la page (vignette Abysse) est sous le canevas dès 84,0 (demande de la scène)
  contour: { t: 87.6, y: 16.60 },                      // pastille en contour tant que « Acheter le tome 1 » est visible
  indice: { t: 94.0, amplitude: 6, periode: 1.6 },     // chevron si la page n'a pas bougé 2 s après la fin
};

// Scène 12 a : le passage de la nuit à la Nacre (§ 3).
export const JOUR = { y: [16.50, 17.10], entete: 0.5, fonduEntete: 0.3, demiAxe: [0.5, 2.6], rapport: 1.6, bande: 0.10, retombee: 0.20, cadres: 0.4 };

// Scène 12 b à e : l'invitation et les trois frappes (§ 2, § 4).
export const FRAPPES = {
  invitation: 17.10, t122: 17.15, pv13: 17.25,         // T12.2 et PV13 entrent au franchissement (entrée par défaut)
  seuils: [17.50, 18.20, 18.90],                       // k_défilement = 1, 2, 3
  ecart: 1.2,                                          // s entre deux frappes au toucher
  sortie: 0.4, delai: 0.25,                            // groupe précédent : 0,4 s ; groupe suivant : 0,25 s après le coup
  logement: 16.60,                                     // l'icône de la pastille s'efface (0,4 s) : la pièce de la scène est la seule
  // repli si la scène ne donne pas getState().piece : centre (fraction de W, fraction de h), diamètre (px)
  piece: [ { x: 0.5, y: 0.240, d: 150 }, { x: 0.5, y: 0.250, d: 220 }, { x: 0.30, y: 0.50, d: 300 } ],
  marge: 24, minimum: 64,                              // bouton : diamètre D + 24 px, jamais moins de 64 px
};

// Scène 13 : la pièce file dans la pastille (§ 6.3). Fin de la partie épinglée.
export const VOL = { y: 19.50, duree: 0.9, depart: 0.1, flip: [0.42, 0.58], fondu: 0.12, battement: 0.32, montee: 0.06 };
export const EPINGLE = { fin: 19.50, canevas: 19.62 };
