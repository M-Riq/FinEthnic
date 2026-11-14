# Licence et attribution — `data/language-resources/d7/`

Les fichiers de ce dossier sont une **adaptation** d'une œuvre sous licence
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr). Ils sont diffusés **sous la même licence**.

**Œuvre d'origine :** Mark Van de Velde & Kisito Essele Essele, *Dictionnaire éton–français*, Éditions CLÉ, Yaoundé, 2022.
HAL : [halshs-03847045](https://shs.hal.science/halshs-03847045).

| Fichier | Contenu | Source (SHA-256 du fichier reçu) |
|---|---|---|
| `d7.json` | Lexique éton → français (3 371 entrées), index français → éton, tableaux de la section « Grammaire & phrases » | `dictionnaire_eton_lexique.md`, lexique extrait du PDF du livre (`2d376352…2a86`) |
| `esquisse-grammaticale.json` | Section 8 « Esquisse grammaticale » du livre (p. 18-70) | `docs/sources/grammaire_eton_esquisse_complete.md` (`85b849ac…7dea`) |

## Modifications apportées (CC BY-NC-SA 4.0, §3(a)(1)(B))

Conversion automatique et reproductible par `npm run convert-d7` (`scripts/convert-d7.ts`, `scripts/lib/d7-convert.ts`) :

- passage du Markdown au JSON (formats : `data/schemas/d7.schema.json`, `data/schemas/esquisse.schema.json`), en Unicode NFC ;
- découpage de chaque « Entrée complète » en sens numérotés, définitions, exemples éton → français, renvois (Voir, Syn, Ant), idiomes, proverbes et notes (Litt, Usage, Empr. de, Singulatif). Le texte d'origine reste dans le champ `full`, qui fait foi ; ce que le découpage n'a pas su classer est listé dans `issues` ;
- **non repris** : la colonne « English » du lexique et les colonnes « English » des tableaux de grammaire. Ces traductions ont été ajoutées par une IA lors de l'extraction ; elles ne figurent pas dans le livre ;
- aucune forme éton n'a été ajoutée, corrigée ou inventée.

## Obligations qui subsistent après la conversion

Changer de format ne change pas la licence. Quiconque réutilise ces fichiers, ou l'extension qui les embarque, doit :

1. **citer** les auteurs et l'ouvrage (ci-dessus), indiquer la licence et signaler les modifications ;
2. **ne pas en faire un usage commercial** ;
3. **partager dans les mêmes conditions** (CC BY-NC-SA 4.0) toute œuvre qui en dérive.

Le fichier brut reçu (`dictionnaire_eton_lexique.md`) reste hors de Git (`data/language-resources/raw/`).
