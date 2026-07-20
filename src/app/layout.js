import './globals.css'
import Providers from './Providers'

export const metadata = {
  title: 'LEXI AI Assistant',
  description: 'Multimodal AI Assistant with Native Audio',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
