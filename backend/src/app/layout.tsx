import type { ReactNode } from 'react';

export const metadata = {
  title: 'Pegawai API',
  description: 'Backend API untuk sistem informasi kepegawaian.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          fontFamily: 'Segoe UI, Arial, sans-serif',
          background: '#f8fafc',
          color: '#0f172a',
        }}
      >
        {children}
      </body>
    </html>
  );
}
