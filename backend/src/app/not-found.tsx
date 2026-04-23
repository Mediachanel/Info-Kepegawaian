export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#f8fafc',
      }}
    >
      <section
        style={{
          maxWidth: 640,
          width: '100%',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          padding: 32,
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 12 }}>Halaman tidak ditemukan</h1>
        <p style={{ margin: 0, color: '#475569', lineHeight: 1.7 }}>
          Jika Anda ingin membuka aplikasi, gunakan frontend di{' '}
          <a href="http://localhost:3004">http://localhost:3004</a>. Port 3000 hanya
          menyediakan backend API.
        </p>
      </section>
    </main>
  );
}
