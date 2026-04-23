const apiEndpoints = [
  '/api/auth/login',
  '/api/auth/me',
  '/api/dashboard-stats',
  '/api/pegawai',
  '/api/ukpd',
];

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '32px 16px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 760,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
          padding: 32,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 999,
            background: '#dcfce7',
            color: '#166534',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Backend aktif
        </div>

        <h1 style={{ margin: '18px 0 10px', fontSize: 32, lineHeight: 1.15 }}>
          API Sistem Informasi Kepegawaian
        </h1>
        <p style={{ margin: 0, color: '#475569', lineHeight: 1.7 }}>
          Port <strong>3000</strong> dipakai untuk backend API. Untuk tampilan aplikasi,
          buka frontend di <strong>http://localhost:3004</strong>.
        </p>

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <a
            href="http://localhost:3004"
            style={{
              textDecoration: 'none',
              background: '#0284c7',
              color: '#fff',
              padding: '12px 18px',
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            Buka Frontend
          </a>
          <a
            href="/api/ukpd"
            style={{
              textDecoration: 'none',
              background: '#e2e8f0',
              color: '#0f172a',
              padding: '12px 18px',
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            Cek API
          </a>
        </div>

        <div style={{ marginTop: 28 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Endpoint utama</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#334155', lineHeight: 1.8 }}>
            {apiEndpoints.map((endpoint) => (
              <li key={endpoint}>
                <code>{endpoint}</code>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
