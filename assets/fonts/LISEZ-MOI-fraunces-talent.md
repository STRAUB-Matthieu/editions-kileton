# Fraunces allégée pour la page « Le talent déterré »

Fichiers : `fraunces-talent-normal.woff2` (86 928 o) et `fraunces-talent-italic.woff2` (21 300 o).
Utilisés seulement par `france-des-talents-v2.html` (déclarés dans `css/talent.css`, famille CSS « Fraunces Talent »).

## Origine
Tirés, sans retouche de dessin, des deux fichiers du site `fraunces-latin-full-normal.woff2` et
`fraunces-latin-full-italic.woff2` (Fraunces 1.000, The Fraunces Project Authors, github.com/undercasetype/Fraunces),
qui restent intacts et servent toujours les autres pages.

- Romain : police variable réduite aux axes que la page emploie : graisse 330 à 400, `opsz` 14 à 144, `SOFT` 0 à 30, `WONK` fixé à 1.
- Italique : instance fixe graisse 320, `opsz` 36, `SOFT` 0, `WONK` 1 (seul usage : le sous-titre).
- Mêmes caractères que l'original (toute sa table de caractères ; même `unicode-range`), toutes les fonctions OpenType gardées.

## Commande exacte (depuis la racine du site, fontTools 4.60.1)
```
python3 _CHANTIER_TALENT/docs/demo/page/lcp/polices.py
```
Le script appelle `fontTools.varLib.instancer.instantiateVariableFont` avec les limites ci-dessus, puis
`fontTools.subset` (toutes les fonctions OpenType, tous les noms, tous les caractères d'origine), et écrit en woff2.

## Licence
SIL Open Font License 1.1 (https://openfontlicense.org), comme l'original. Les métadonnées de la police
(nom 0 : « Copyright 2020 The Fraunces Project Authors (github.com/undercasetype/Fraunces) » ; nom 14 : lien vers l'OFL)
ne déclarent aucun nom de police réservé : la version modifiée peut garder son nom interne. Elle est servie sous un nom
de famille CSS distinct (« Fraunces Talent ») et n'est pas vendue seule.
