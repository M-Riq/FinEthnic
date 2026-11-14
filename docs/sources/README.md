# Sources versionnées (`docs/sources/`)

Ces fichiers sont conservés **tels qu'ils ont été fournis**. Ils servent à l'import initial de la bibliothèque (BM2) et à la traçabilité.

**Règles :**
- ne jamais modifier ces fichiers à la main ;
- une correction passe par le JSON de `data/` (source de vérité, Q5) ;
- une nouvelle version d'une source est ajoutée sous un **nouveau nom**, puis inscrite ci-dessous.

| # | Fichier | Contenu | Ajouté le | SHA-256 |
|---|---|---|---|---|
| D8 | `corpus_fusionne_SAFINUM_Eton.md` | Corpus financier FR fusionné (D4 + textes des pages de D5). Version Markdown de `corpus_fusionne_SAFINUM_Eton.xlsx`. Il contient 315 entrées et 60 textes de pages. **Il ne contient aucune forme en Éton.** | 2026-11-13 | `12d5c3d60877c8a03d554f44007e4b3d27d721ef352224a67ea0545325208231` |
| HAL | `grammaire_eton_esquisse_complete.md` | Section 8 « Esquisse grammaticale » (p. 18-70) du *Dictionnaire éton–français* (Van de Velde & Essele Essele, CLÉ 2022, HAL halshs-03847045), en Markdown, fournie par le responsable. **CC BY-NC-SA 4.0** (voir `THIRD_PARTY.md`). Convertie par `npm run convert-d7` | 2026-11-14 | `85b849acce0a5109b7235c096f659470d1ce8b687de1fa70dd5dc3b3574c7dea` |

Pour vérifier qu'un fichier n'a pas été modifié : `sha256sum docs/sources/<fichier>`.

Le lexique brut de D7 n'est pas versionné ici ; sa conversion JSON l'est dans `data/language-resources/d7/` (Q17 révisée le 2026-11-14, PROJECT_CONTEXT §3.7.4-3).
