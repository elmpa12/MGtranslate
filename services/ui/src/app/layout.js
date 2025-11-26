import './globals.css'

export const metadata = {
  title: 'MGtranslate - Real-time Meeting Translation',
  description: 'Simultaneous translation for Google Meet',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
