/** Ressources du moteur intégrées au script de contenu par `build.mjs` (chargeur texte). */
declare module '*.data' {
  const text: string;
  export default text;
}
