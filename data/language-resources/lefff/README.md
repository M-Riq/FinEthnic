# Extrait de Lefff 3.4 (moteur, MOT2)

`lefff-3.4-finethnic.mlex` est un **extrait modifié** de Lefff 3.4, le lexique morphologique du français de Benoît Sagot :

> Benoît Sagot (2010). *The Lefff, a freely available and large-coverage morphological and syntactic lexicon for French.* LREC 2010.

- **Licence** : LGPL-LR (texte complet dans [`LICENSE-LGPL-LR.txt`](LICENSE-LGPL-LR.txt)). L'extrait reste sous cette licence. Le reste du dépôt n'est pas concerné (LGPL-LR §3).
- **Source** : [ClaudeCoulombe/FrenchLefffLemmatizer](https://github.com/ClaudeCoulombe/FrenchLefffLemmatizer) @ `bc0ebd0135a6cc78f48ddf184069b4c0b9c017d8`, fichier `french_lefff_lemmatizer/data/lefff-3.4.mlex` (SHA-256 vérifié par le script). Les sites de l'INRIA n'étaient pas joignables lors de l'import.
- **Modifications** (date en tête du fichier) : seules sont gardées les lignes dont la forme apparaît dans D7, D8 ou `src/engine/french.ts`, et toutes les lignes du même lemme ; la ponctuation est retirée. Aucune ligne n'est changée.
- **Format** : une ligne par analyse, `forme⇥catégorie⇥lemme⇥traits` (ex. `dépasse	v	dépasser	PS13s`). Les lignes `#` sont l'en-tête.
- **Régénérer** (après un changement de D7 ou de D8) : `npm run build-lefff`. D7 doit être présent dans `data/language-resources/raw/` (hors Git) ; Lefff complet y est téléchargé s'il manque.
