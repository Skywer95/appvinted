
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SCENES = {
  oak: `un parquet moderne en chêne clair naturel, grandes lames propres et contemporaines,
        veinage réaliste subtil, teinte bois clair premium, aucune rayure, aucun aspect rustique ancien`,
  studio: `un studio photo produit minimaliste haut de gamme, fond et sol blanc cassé chaud,
           lumière naturelle douce et homogène`,
  beige: `un intérieur beige clair premium, sol minéral doux et contemporain,
          ambiance éditoriale mode haut de gamme`,
  dressing: `un dressing moderne minimaliste avec parquet chêne clair, tons crème neutres,
             arrière-plan discret et légèrement flouté`,
  concrete: `un sol microciment gris clair moderne, environnement streetwear premium,
             propre et contemporain`,
};

const POSITIONS = {
  flat: `L'article est posé parfaitement à plat et photographié strictement à la verticale,
         appareil photo directement au-dessus, composition symétrique.`,
  centered: `L'article est posé à plat, parfaitement droit et centré avec des marges régulières.`,
  slight: `L'article reste posé à plat avec un angle très léger et naturel,
           tout en restant parfaitement lisible comme photo principale d'une annonce.`,
};

function makePrompt(s) {
  const scene = SCENES[s.scene] || SCENES.oak;
  const position = POSITIONS[s.position] || POSITIONS.flat;
  const extra = String(s.extra || "").trim();

  return `
Recrée entièrement une NOUVELLE photographie produit photoréaliste à partir des photos de référence fournies.

OBJECTIF :
Créer une photo principale extrêmement vendeuse, réaliste et propre pour une annonce de seconde main,
dans le même esprit qu'une photographie professionnelle de marketplace.

FIDÉLITÉ ABSOLUE DE L'ARTICLE :
- L'article vendu doit rester le même article réel.
- Conserve sa forme, ses proportions, son volume, sa couleur réelle et sa matière.
- Conserve exactement les panneaux, coutures, poches, zip, col, ourlets, boutons et éléments de construction visibles.
- Conserve les logos, marques, étiquettes et leur emplacement aussi fidèlement que possible.
- Conserve les défauts et traces réellement visibles. Ne répare et ne rajeunis pas artificiellement le produit.
- N'invente aucune poche, couture, inscription, fermeture ou détail absent des références.
- Ne transforme surtout pas l'article en un autre modèle.
- Lorsque plusieurs références sont présentes, utilise-les ensemble pour comprendre précisément le produit.

RECRÉATION DE LA PHOTO :
- Supprime entièrement le décor original des photos.
- Nouveau décor : ${scene}.
- ${position}
- L'article entier est visible, jamais coupé, avec une marge confortable autour.
- Ombres de contact réalistes et discrètes sous le vêtement pour qu'il repose réellement sur le sol.
- Éclairage naturel doux de qualité studio, sans flash agressif.
- Intensité lumineuse souhaitée : ${s.brightness ?? 65}/100.
- Chaleur de la lumière : ${s.warmth ?? 50}/100.
- Intensité des ombres : ${s.shadow ?? 35}/100.
- Texture du tissu, plis, matelassage et relief réalistes.
- Netteté naturelle, pas de rendu plastique ou 3D.
- Photo crédible prise avec un excellent smartphone ou appareil photo.
- Composition portrait adaptée à une photo principale Vinted.
- Aucun texte ajouté, aucun watermark, aucune bordure, aucune main, aucun mannequin, aucun cintre.
${extra ? `- Instruction supplémentaire du vendeur : ${extra}` : ""}

Le résultat doit ressembler à une vraie photo qui aurait réellement pu être prise avec cet article posé dans ce nouveau décor.
`.trim();
}

export async function GET() {
  return Response.json({
    ok: true,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: "gpt-image-2",
  });
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY n'est pas configurée dans Vercel." },
        { status: 500 }
      );
    }

    const form = await request.formData();
    const images = form.getAll("images").filter(x => x instanceof File);
    const rawSettings = form.get("settings");

    if (!images.length) {
      return Response.json({ error: "Aucune photo reçue." }, { status: 400 });
    }

    let settings = {};
    try {
      settings = JSON.parse(String(rawSettings || "{}"));
    } catch {
      return Response.json({ error: "Réglages invalides." }, { status: 400 });
    }

    // On reste volontairement loin sous les 4.5 Mo Vercel.
    const totalBytes = images.reduce((n, f) => n + f.size, 0);
    if (totalBytes > 3_600_000) {
      return Response.json(
        { error: "Les références compressées dépassent 3,6 Mo. Utilisez moins de photos." },
        { status: 413 }
      );
    }

    const fd = new FormData();
    fd.append("model", "gpt-image-2");
    fd.append("prompt", makePrompt(settings));
    fd.append("quality", ["low", "medium", "high"].includes(settings.quality) ? settings.quality : "medium");
    fd.append("size", "1024x1536");
    fd.append("output_format", "jpeg");
    fd.append("output_compression", "82");
    fd.append("n", "1");

    // GPT Image 2 traite déjà les références en haute fidélité :
    // ne pas envoyer input_fidelity avec ce modèle.
    for (const image of images.slice(0, 4)) {
      fd.append("image[]", image, image.name || "reference.jpg");
    }

    const openai = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: fd,
    });

    const text = await openai.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!openai.ok) {
      console.error("OpenAI image error", text);
      return Response.json(
        { error: data?.error?.message || "Erreur OpenAI pendant la génération." },
        { status: openai.status }
      );
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return Response.json({ error: "Aucune image retournée par l'IA." }, { status: 502 });
    }

    return Response.json({
      image: `data:image/jpeg;base64,${b64}`,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error?.message || "Erreur serveur inattendue." },
      { status: 500 }
    );
  }
}
