
import "./style.css";

export const metadata = {
  title: "Vintly V5.1 AI",
  description: "Studio IA pour recréer des photos de vente",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
