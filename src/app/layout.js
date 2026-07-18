import './globals.css';

export const metadata = {
  title: 'Nexus AI - Multimodal Assistant',
  description: 'A premium, fast multimodal AI assistant.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
