import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="id">
      <Head>
        <meta name="theme-color" content="#f3f6f7" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Space+Grotesk:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `tailwind.config = {
  theme: {
    extend: {
      colors: {
        ink: '#0c1f2a',
        mist: '#f6f1e8',
        sea: '#1b9aaa',
        clay: '#d86b3d',
        moss: '#4d7c6a',
        slate: '#52616b',
        cloud: '#fdfbf7',
        brand: '#0f9d94',
        cpns: '#06b6d4',
        pppk: '#22c55e',
        pro: '#0f766e',
        pjlp: '#6d28d9',
        brandSoft: '#e9fbf8',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 12px 40px rgba(12, 31, 42, 0.12)',
        card: '0 6px 20px rgba(12, 31, 42, 0.12)',
      },
    },
  },
};`,
          }}
        />
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>
      <body className="font-body text-ink">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
