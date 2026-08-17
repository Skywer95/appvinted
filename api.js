
const SCENES = {
  oak: "a modern premium light oak parquet floor, pale natural European oak, wide clean contemporary planks, subtle realistic wood grain, elegant warm-neutral tone, no rustic damage or scratches",
  studio: "a premium minimalist product photography studio, warm off-white seamless background and floor, soft diffused natural daylight",
  beige: "a refined warm beige premium interior, contemporary neutral floor, editorial fashion photography",
  dressing: "a modern minimalist dressing room with pale oak flooring, cream neutral tones and a discreet softly blurred background",
  concrete: "a clean modern light grey microcement floor, premium contemporary streetwear aesthetic"
};

const POSITIONS = {
  flat: "The item is laid perfectly flat and photographed straight down from directly above, symmetrical, centered and naturally arranged.",
  centered: "The item is laid flat, straight, centered and evenly framed with comfortable margins.",
  slight: "The item is laid flat with a very subtle natural angle, while remaining clear and suitable as the main marketplace image."
};

function promptFor(s = {}) {
  return `
Create a completely NEW photorealistic resale marketplace product photograph using the supplied reference image(s).

CRITICAL PRODUCT FIDELITY:
- Preserve the exact real item shown in the references.
- Keep its real shape, proportions, volume, colour, material, texture and visible condition.
- Preserve the exact construction: panels, quilting, stitching, collar, zipper, pockets, hems, buttons and hardware.
- Preserve visible logos, brand marks and label placement as faithfully as possible.
- Preserve genuine visible wear or defects.
- Do NOT repair, redesign, modernize, beautify or invent product details.
- Never transform the product into a different model.

RECREATE THE ENTIRE PHOTOGRAPH:
- Completely replace the original room, floor and background.
- New environment: ${SCENES[s.scene] || SCENES.oak}.
- ${POSITIONS[s.position] || POSITIONS.flat}
- Entire item visible, never cropped, with comfortable margins.
- Realistic subtle contact shadow so the item genuinely rests on the surface.
- Soft professional natural-looking illumination.
- Desired brightness: ${s.brightness ?? 65}/100.
- Desired warmth: ${s.warmth ?? 50}/100.
- Desired shadow intensity: ${s.shadow ?? 35}/100.
- Natural realistic textile texture, folds, depth and volume.
- Crisp but believable smartphone / professional marketplace photography.
- No text, watermark, border, hands, mannequin, hanger or added props.
${s.extra ? `- Seller request: ${String(s.extra).trim()}` : ""}

The result must look like a real photograph that could genuinely have been taken with this exact item placed in the new environment.
`.trim();
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Format d'image invalide.");
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok:true, apiKeyConfigured:Boolean(process.env.OPENAI_API_KEY) });
  }
  if (req.method !== "POST") return res.status(405).json({ error:"Méthode non autorisée." });

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error:"OPENAI_API_KEY n'est pas configurée dans Vercel." });
    }

    const { images = [], settings = {} } = req.body || {};
    if (!Array.isArray(images) || !images.length) {
      return res.status(400).json({ error:"Aucune image reçue." });
    }

    const fd = new FormData();
    fd.append("model","gpt-image-2");
    fd.append("prompt",promptFor(settings));
    fd.append("quality",["low","medium","high"].includes(settings.quality) ? settings.quality : "medium");
    fd.append("size","1024x1536");
    fd.append("output_format","jpeg");
    fd.append("output_compression","80");
    fd.append("n","1");

    for (let i=0;i<Math.min(images.length,4);i++) {
      const {mime,buffer}=dataUrlToBlob(images[i]);
      fd.append("image[]", new Blob([buffer],{type:mime || "image/jpeg"}), `reference-${i+1}.jpg`);
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:fd
    });

    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    if (!response.ok) {
      return res.status(response.status).json({ error:data?.error?.message || "Erreur OpenAI pendant la génération." });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error:"Aucune image retournée." });

    return res.status(200).json({ image:`data:image/jpeg;base64,${b64}` });
  } catch (err) {
    return res.status(500).json({ error:err?.message || "Erreur serveur." });
  }
}
