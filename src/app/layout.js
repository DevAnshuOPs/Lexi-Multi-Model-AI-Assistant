import './globals.css'
import Providers from './Providers'

export const metadata = {
  title: 'LEXI AI Assistant',
  description: 'Multimodal AI Assistant with Native Audio',
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
