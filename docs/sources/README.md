# Sources versionnées (`docs/sources/`)

Ces fichiers sont conservés **tels qu'ils ont été fournis**. Ils servent à l'import initial de la bibliothèque (BM2) et à la traçabilité.

**Règles :**
- ne jamais modifier ces fichiers à la main ;
- une correction passe par le JSON de `data/` (source de vérité, Q5) ;
- une nouvelle version d'une source est ajoutée sous un **nouveau nom**, puis inscrite ci-dessous.

| # | Fichier | Contenu | Ajouté le | SHA-256 |
|---|---|---|---|---|
| D8 | `corpus_fusionne_SAFINUM_Eton.md` | Corpus financier FR fusionné (D4 + textes des pages de D5). Version Markdown de `corpus_fusionne_SAFINUM_Eton.xlsx`. Il contient 315 entrées et 60 textes de pages. **Il ne contient aucune forme en Éton.** | 2026-11-13 | `12d5c3d60877c8a03d554f44007e4b3d27d721ef352224a67ea0545325208231` |

Pour vérifier qu'un fichier n'a pas été modifié : `sha256sum docs/sources/<fichier>`.

Le dictionnaire éton–français (D7) n'est **jamais** versionné ici (PROJECT_CONTEXT §3.7.4-3).
