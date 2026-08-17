VINTLY V5.1 — GITHUB + VERCEL

MISE EN LIGNE

1. Décompressez ce dossier.
2. Créez un nouveau dépôt GitHub.
3. Envoyez TOUT le contenu de ce dossier à la racine du dépôt.
   Important : n'envoyez jamais de fichier .env ou .env.local contenant une vraie clé.

4. Sur Vercel :
   - Add New > Project
   - Importez le dépôt GitHub.
   - Framework Preset : Next.js (détecté automatiquement).
   - Build command : laissez la valeur par défaut.
   - Output directory : laissez la valeur par défaut.

5. Dans Vercel > Project > Settings > Environment Variables :
   Nom : OPENAI_API_KEY
   Valeur : votre clé API OpenAI
   Environnements : Production + Preview + Development si vous le souhaitez.

6. Redéployez le projet après avoir ajouté la variable.

TEST LOCAL FACULTATIF

1. Installez Node.js.
2. npm install
3. Copiez .env.example en .env.local
4. Ajoutez votre clé dans .env.local
5. npm run dev
6. Ouvrez http://localhost:3000

FONCTIONNEMENT DE LA V5.1

- Les photos sont compressées dans le navigateur avant l'envoi.
- Jusqu'à 4 angles peuvent servir de références à GPT Image.
- La route /api/recreate utilise GPT Image 2 et l'endpoint /v1/images/edits.
- Une variante est générée par requête.
- "Générer 3 variantes" effectue donc 3 requêtes successives.
- Cela évite de dépasser plus facilement les limites de taille des Vercel Functions.
- La clé API reste uniquement côté serveur dans Vercel.
- Le navigateur ne voit jamais la clé OPENAI_API_KEY.

NOTE IMPORTANTE

Une génération via l'API OpenAI est payante selon le modèle, la qualité, la taille et le nombre de références.
Le modèle peut préserver très fortement un article de référence mais une génération IA reste probabiliste :
vérifiez toujours qu'un logo, une couture, un défaut ou une caractéristique du produit n'a pas été modifié avant de publier la photo.
