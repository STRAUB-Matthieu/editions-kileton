# Emblème du talent — *La France des talents*, tome 1

Piste B, « La source », choisie par Matthieu Straub le 14/11/2026. Fichiers maîtres, optimisés par svgo, sans ressource extérieure, lettres converties en tracés (Cormorant Garamond du site). Planche de contrôle : `_CHANTIER_TALENT/docs/design/embleme-final-planche.png`. Source régénérable : `_CHANTIER_TALENT/docs/design/embleme-final/generer.py`.

**Avers** : la croix latine est la seule chose claire ; la gravure de terre qui couvre le champ s'amincit à son approche. La lumière vient de la croix.
**Revers** : le lys frappé en creux, comme l'empreinte laissée dans la terre ; « MT · XXV » (Matthieu 25) en bas.

## Rôle de chaque fichier
| Fichier | Rôle | Taille d'emploi | Poids |
| --- | --- | --- | --- |
| `talent-avers.svg` | Maître couleur de l'avers, 1080 × 1080. Repli sans WebGL, acte 2 statique, images de partage. | 96 px et plus | 10,3 ko |
| `talent-revers.svg` | Maître couleur du revers, 1080 × 1080. | 96 px et plus | 10,2 ko |
| `talent-avers-relief.svg` | Carte de hauteur de l'avers pour la pièce 3D (jamais affichée telle quelle). Convention écrite dans le fichier. | rasteriser à 1024 px | 10,7 ko |
| `talent-revers-relief.svg` | Carte de hauteur du revers, même convention. | rasteriser à 1024 px | 5,9 ko |
| `talent-trait.svg` | Version trait, une couleur (`currentColor`) : pied de page, impression, tampon, icônes monochromes. | 16 à 64 px | 3,2 ko |
| `talent-28.svg` | Dessiné au pixel pour 28 px : bande du livre, pastille, favicon, avatar. | 20 à 48 px | 0,9 ko |

## Convention des cartes de hauteur
Gris `#808080` = champ (hauteur 0) ; plus clair = plus haut, plus sombre = plus creux ; hauteur = (valeur − 128) / 112. Aplats seulement, sans dégradé : le chanfrein se fait au rendu (flou de 2 à 4 px sur la carte rasterisée à 1024 px). Niveaux : croix `#F0F0F0` (+1) · listel `#E6E6E6` · tranche `#B4B4B4` · champ `#808080` · filet du bord et bande du lys `#5A5A5A` · strates gravées `#4A4A4A` · lettres `#3C3C3C` · lys en creux `#2A2A2A`. Hors du disque : transparent. Pour l'émission de lumière de l'avers, le masque de la croix = pixels ≥ `#F0F0F0`.

## Couleurs (accord Patrie, `nuancier.py check` : 0 note étrangère)
Or `#D4AF37` (champ, `--or`) · Or bruni `#A8842F` (tranche, filets, bande du lys, `--or-bruni`) · Or pâle `#E8D48B` (bord éclairé des creux, filet de la croix, `--or-pale`) · Incandescence `#FFF3D6` (la croix, `--incandescence`) · Ambre profond `#532800` (gravure de terre, fond des creux). Ni `#000` ni `#FFF`. La version trait prend la couleur du texte : Outrenoir `#141218` sur clair, Nacre `#F7F5F1` sur sombre, Or `#D4AF37` ou Or bruni `#A8842F` en accent ; aucune autre.

## Zone de protection
Autour de la pièce, un vide égal au quart de son diamètre (270 px pour 1080 ; 7 px pour 28 ; 4 px pour 16). Aucun texte, filet ni bord d'image dans cette zone.

## Tailles minimales
Maîtres couleur : 96 px. En dessous, `talent-28.svg` (de 20 à 48 px) ou `talent-trait.svg` (de 16 à 64 px). Le revers ne descend pas sous 48 px : sa légende devient illisible (le lys seul se lit encore à 28 px).

## Interdits
- Pas de croix à branches égales, pas de croix touchant le listel : la croix reste latine, branche basse 2,8 fois la haute, à distance du bord.
- Pas de rotation, d'étirement, de recadrage du disque, de recoloration (hors `currentColor` de la version trait), d'ombre portée, de halo, de lueur, de biseau ajouté.
- Pas de superposition sur la couverture ; la couverture ne se modifie jamais. Pas de nouveau logo mêlant l'emblème et le mot KILETON.
- Les cartes de hauteur ne s'affichent pas : elles servent seulement au relief 3D.
