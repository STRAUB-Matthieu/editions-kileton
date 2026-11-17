# js/talent/son : la conduite sonore

- `sons.js` : générateurs Web Audio (grondement, frottement, tintement, nappe, coup, salle), sans fichier. Hasard à graine (`fixerGraine`).
- `conduite.js` : en tête, la table du son en données (`TABLE`) et les emplacements réservés (`DEFAUTS.reserve`, inactifs : bande-son, deux voix). Puis le moteur : `creerConduite(reglages)` (contrat § 3.3 : `demarrer`, `setTime`, `evenement`, `couper`, `suspendre`, `reprendre`, `actif`, plus `inspecter` pour les essais) et `rendreHorsLigne(dureeS, pasS, options)`.
- Règles : aucun `AudioContext` avant `demarrer()` (dans un clic). Le gain maître est une fonction exacte de T (trois silences à 0). Les sons ponctuels ne jouent qu'en avançant, d'un pas de moins de 0,5 s ; seule exception : le tintement de 64,8 si le saut arrive entre 64,8 et 66,0. La table va jusqu'à T = 92,0 (silence 4 de 89,90 à 92,0) ; au-delà la page garde T = 92 et envoie les événements `'frappe' {k}` (k = 1 à 3, 4 = tintement doux) et `'pastille'`.

