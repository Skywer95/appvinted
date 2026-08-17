
"use client";

import { useEffect, useMemo, useState } from "react";

const sceneNames = {
  oak: "Parquet chêne clair",
  studio: "Studio doux",
  beige: "Beige premium",
  dressing: "Dressing moderne",
  concrete: "Urbain",
};

async function compressImage(file, maxSide = 1600, quality = 0.78) {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("Compression impossible.");

  return new File(
    [blob],
    file.name.replace(/\.[^.]+$/, "") + ".jpg",
    { type: "image/jpeg" }
  );
}

export default function Page() {
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [scene, setScene] = useState("oak");
  const [position, setPosition] = useState("flat");
  const [quality, setQuality] = useState("medium");
  const [brightness, setBrightness] = useState(65);
  const [warmth, setWarmth] = useState(50);
  const [shadow, setShadow] = useState(35);
  const [extra, setExtra] = useState("");
  const [allRefs, setAllRefs] = useState(true);
  const [outputs, setOutputs] = useState([]);
  const [outputIndex, setOutputIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState("");
  const [api, setApi] = useState(null);

  const [article, setArticle] = useState("");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [details, setDetails] = useState("");
  const [carrier, setCarrier] = useState("Chronopost");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetch("/api/recreate")
      .then(r => r.json())
      .then(setApi)
      .catch(() => setApi({ ok: false }));
  }, []);

  useEffect(() => {
    return () => photos.forEach(p => URL.revokeObjectURL(p.url));
  }, [photos]);

  async function addPhotos(event) {
    setError("");
    const incoming = [...event.target.files].slice(0, 10 - photos.length);
    event.target.value = "";

    const prepared = [];
    for (const f of incoming) {
      const compressed = await compressImage(f);
      prepared.push({
        originalName: f.name,
        file: compressed,
        url: URL.createObjectURL(compressed),
      });
    }
    setPhotos(prev => [...prev, ...prepared]);
  }

  function removePhoto(i) {
    setPhotos(prev => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[i].url);
      copy.splice(i, 1);
      return copy;
    });
    setSelectedPhoto(v => Math.max(0, Math.min(v, photos.length - 2)));
  }

  function refsForRequest() {
    if (!photos.length) return [];
    if (!allRefs) return [photos[selectedPhoto]];
    // 4 références max pour garder un payload confortable sur Vercel.
    return photos.slice(0, 4);
  }

  async function oneGeneration(index, total) {
    const fd = new FormData();
    const refs = refsForRequest();

    refs.forEach((p) => fd.append("images", p.file, p.file.name));
    fd.append("settings", JSON.stringify({
      scene, position, quality, brightness, warmth, shadow, extra
    }));

    setProgressText(
      total > 1
        ? `Génération ${index + 1} sur ${total}…`
        : "Recréation complète de la photo…"
    );

    const r = await fetch("/api/recreate", {
      method: "POST",
      body: fd,
    });
    const j = await r.json();

    if (!r.ok) throw new Error(j.error || "La génération a échoué.");
    return j.image;
  }

  async function generate(count) {
    if (!photos.length) {
      setError("Ajoutez au moins une photo de l'article.");
      return;
    }

    setLoading(true);
    setError("");
    setOutputs([]);
    setOutputIndex(0);

    try {
      // Important : les variantes sont volontairement séquentielles.
      // Une seule image traverse la réponse Vercel à la fois.
      const result = [];
      for (let i = 0; i < count; i++) {
        result.push(await oneGeneration(i, count));
      }
      setOutputs(result);
      setProgressText("");
    } catch (e) {
      setError(e.message);
      setProgressText("");
    } finally {
      setLoading(false);
    }
  }

  function generateDescription() {
    const a = article.trim();
    const b = brand.trim();
    const s = size.trim();
    const c = color.trim();
    const d = details.trim();

    setTitle(`✨ ${[a, b, c, s && `Taille ${s}`].filter(Boolean).join(" • ")}`);

    const lines = [
      "Bonjour,",
      "",
      `Je vous propose ${a ? `cet article ${a.toLowerCase()}` : "cet article"}${b ? ` ${b}` : ""}${c ? ` de couleur ${c.toLowerCase()}` : ""}. ${d ? `${d}.` : "Il est soigneusement présenté et prêt pour une seconde vie."}`,
      "",
      ...(s ? [`📏 Taille : ${s}`] : []),
      ...(c ? [`🎨 Couleur : ${c}`] : []),
      ...(d ? [`🔎 Détails : ${d}`] : []),
      "",
      carrier === "Chronopost"
        ? "📦 Envoi soigné et rapide — Chronopost privilégié lorsque c'est possible."
        : `📦 Envoi soigné — transporteur préféré : ${carrier}.`,
      "",
      "💬 Si vous souhaitez une mesure, une précision ou une photo supplémentaire, n'hésitez pas à me contacter. Je vous répondrai rapidement. 😊",
    ];

    setDescription(lines.join("\n"));
  }

  async function copyText() {
    await navigator.clipboard.writeText(`${title}\n\n${description}`);
  }

  function downloadSelected() {
    if (!outputs.length) return;
    const a = document.createElement("a");
    a.href = outputs[outputIndex];
    a.download = `vintly-${scene}-${outputIndex + 1}.jpg`;
    a.click();
  }

  function reset() {
    photos.forEach(p => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setOutputs([]);
    setSelectedPhoto(0);
    setOutputIndex(0);
    setError("");
    setTitle("");
    setDescription("");
  }

  const selectedImage = outputs[outputIndex] || photos[selectedPhoto]?.url || null;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">VINTLY <span>V5.1</span></div>
        <button className="new" onClick={reset}>＋ Nouvelle annonce</button>

        <nav>
          <button>⌂ Tableau de bord</button>
          <button>▣ Mes annonces</button>
          <button className="activeNav">✦ Studio IA</button>
          <button>◉ Descriptions</button>
          <button>⚙ Paramètres</button>
        </nav>

        <div className="sideInfo">
          <b>Vraie recréation IA</b>
          <p>
            La photo n'est plus un simple détourage. GPT Image reçoit votre
            article comme référence et reconstruit toute la prise de vue.
          </p>
        </div>
      </aside>

      <main>
        <header>
          <div className="steps">
            <span>1 Photos</span>
            <span className="activeStep">2 Mise en valeur IA</span>
            <span>3 Description</span>
          </div>
          <div className={api?.apiKeyConfigured ? "api ok" : "api bad"}>
            {api === null
              ? "Vérification…"
              : api?.apiKeyConfigured
                ? "● API prête"
                : "● Clé API manquante"}
          </div>
        </header>

        <div className="workspace">
          <section className="panel photosPanel">
            <h2>Photos ({photos.length})</h2>

            <div className="gallery">
              {photos.map((p, i) => (
                <div
                  key={p.url}
                  className={`thumb ${selectedPhoto === i ? "selected" : ""}`}
                  onClick={() => setSelectedPhoto(i)}
                >
                  <img src={p.url} alt="" />
                  <button
                    className="delete"
                    onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                  >×</button>
                </div>
              ))}

              <label className="add">
                <b>＋</b>
                <span>Ajouter des photos</span>
                <small>compression automatique</small>
                <input type="file" accept="image/*" multiple onChange={addPhotos} />
              </label>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={allRefs}
                onChange={e => setAllRefs(e.target.checked)}
              />
              Utiliser plusieurs angles comme références
            </label>

            <div className="hint">
              Jusqu'à 4 références sont envoyées à l'IA. Les fichiers sont réduits
              automatiquement pour rester compatibles avec Vercel.
            </div>
          </section>

          <section className="panel centerPanel">
            <div className="panelTitle">
              <h2>Photo recréée — {sceneNames[scene]}</h2>
              <span>Réaliste ✨</span>
            </div>

            <div className="stage">
              {selectedImage
                ? <img src={selectedImage} alt="Aperçu" />
                : <div className="empty">Ajoutez une photo pour commencer.</div>}
              {loading && (
                <div className="loading">
                  <div className="spinner" />
                  <b>{progressText}</b>
                  <p>
                    L'IA reconstruit le décor, l'éclairage et la prise de vue
                    en conservant l'article comme référence.
                  </p>
                </div>
              )}
            </div>

            <div className="sceneGrid">
              {[
                ["oak", "🪵", "Parquet clair"],
                ["studio", "⬜", "Studio doux"],
                ["beige", "🤍", "Beige premium"],
                ["dressing", "🧺", "Dressing"],
                ["concrete", "🧱", "Urbain"],
              ].map(([id, emoji, label]) => (
                <button
                  key={id}
                  className={scene === id ? "scene activeScene" : "scene"}
                  onClick={() => setScene(id)}
                >
                  {emoji}<br />{label}
                </button>
              ))}
            </div>

            <div className="generateRow">
              <button className="primary" disabled={loading} onClick={() => generate(1)}>
                ✨ Recréer la photo
              </button>
              <button className="secondary" disabled={loading} onClick={() => generate(3)}>
                Générer 3 variantes
              </button>
            </div>

            <div className="variants">
              {[0,1,2].map(i => (
                <button
                  key={i}
                  className={`variant ${outputs[i] && outputIndex === i ? "variantSelected" : ""}`}
                  onClick={() => outputs[i] && setOutputIndex(i)}
                >
                  {outputs[i]
                    ? <img src={outputs[i]} alt={`Variante ${i+1}`} />
                    : <span>Variante {i+1}</span>}
                </button>
              ))}
            </div>

            {outputs.length > 0 && (
              <button className="download" onClick={downloadSelected}>
                ⇩ Télécharger l'image sélectionnée
              </button>
            )}

            {error && <div className="error">{error}</div>}
          </section>

          <section className="panel settingsPanel">
            <h2>Mise en valeur</h2>

            <label>Qualité</label>
            <select value={quality} onChange={e => setQuality(e.target.value)}>
              <option value="low">Rapide / économique</option>
              <option value="medium">Standard — recommandé</option>
              <option value="high">Haute qualité</option>
            </select>

            <label>Position</label>
            <div className="positions">
              {[
                ["flat", "À plat"],
                ["centered", "Centré"],
                ["slight", "Léger angle"],
              ].map(([id,label]) => (
                <button
                  key={id}
                  className={position === id ? "pos activePos" : "pos"}
                  onClick={() => setPosition(id)}
                >{label}</button>
              ))}
            </div>

            <div className="sliderGrid">
              <div><span>Lumière {brightness}%</span><input type="range" min="20" max="100" value={brightness} onChange={e=>setBrightness(e.target.value)} /></div>
              <div><span>Chaleur {warmth}%</span><input type="range" min="0" max="100" value={warmth} onChange={e=>setWarmth(e.target.value)} /></div>
              <div><span>Ombres {shadow}%</span><input type="range" min="0" max="100" value={shadow} onChange={e=>setShadow(e.target.value)} /></div>
            </div>

            <label>Consigne supplémentaire</label>
            <textarea
              value={extra}
              onChange={e => setExtra(e.target.value)}
              placeholder="Ex. parquet encore plus clair, lumière naturelle venant de gauche…"
            />

            <div className="fidelity">
              <b>Fidélité produit</b>
              <p>
                Le prompt interdit volontairement de modifier la forme, les logos,
                coutures, poches, zip ou défauts visibles de l'article.
              </p>
            </div>

            <h2 className="descTitle">Description</h2>
            <div className="formGrid">
              <input value={article} onChange={e=>setArticle(e.target.value)} placeholder="Article" />
              <input value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Marque" />
              <input value={size} onChange={e=>setSize(e.target.value)} placeholder="Taille" />
              <input value={color} onChange={e=>setColor(e.target.value)} placeholder="Couleur" />
              <input className="wide" value={details} onChange={e=>setDetails(e.target.value)} placeholder="Détails : vintage, oversize…" />
              <select className="wide" value={carrier} onChange={e=>setCarrier(e.target.value)}>
                <option>Chronopost</option>
                <option>Mondial Relay</option>
                <option>Colissimo</option>
                <option>Relais Colis</option>
              </select>
            </div>

            <button className="secondary full" onClick={generateDescription}>
              Générer la description
            </button>
            <input className="textOutput" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Titre" />
            <textarea className="description" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description" />
            <button className="primary full" onClick={copyText}>Copier le texte</button>
          </section>
        </div>
      </main>
    </div>
  );
}
