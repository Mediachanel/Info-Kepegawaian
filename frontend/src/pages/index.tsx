import Head from 'next/head';
import { useRouter } from 'next/router';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getPegawai, login } from '@/lib/api';

type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  status?: string;
};

type StatusTone = '' | 'success' | 'error' | 'warn';

const fallbackFaq: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'Mutasi',
    question: 'Apa itu usulan mutasi pegawai?',
    answer:
      'Usulan mutasi adalah proses pengajuan perpindahan pegawai untuk penempatan baru sesuai kebutuhan organisasi.',
  },
  {
    id: 'faq-2',
    category: 'Pemutusan JF',
    question: 'Kapan pemutusan jabatan fungsional diajukan?',
    answer:
      'Pemutusan JF diajukan saat terdapat perubahan kebutuhan formasi atau kebijakan organisasi terkait jabatan fungsional.',
  },
  {
    id: 'faq-3',
    category: 'Akun',
    question: 'Bagaimana jika lupa password?',
    answer:
      'Silakan hubungi admin Subkelompok Kepegawaian untuk reset atau bantuan akses akun.',
  },
];

function formatClock(date: Date) {
  const hari = date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const jam = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${hari} - ${jam} WIB`;
}

function toBadgeStatus(message: string) {
  const text = message.toLowerCase();
  if (!text) return '-';
  if (text.includes('memuat')) return 'Memuat';
  if (text.includes('siap')) return 'Siap';
  if (text.includes('contoh')) return 'Contoh';
  if (text.includes('gagal')) return 'Gagal';
  return message;
}

export default function Home() {
  const router = useRouter();
  const [clock, setClock] = useState('Memuat...');
  const [serverReady, setServerReady] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    tone: StatusTone;
  }>({
    message: 'menunggu koneksi server...',
    tone: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ username: '', password: '' });

  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [faqStatus, setFaqStatus] = useState('menunggu data.');
  const [faqCategory, setFaqCategory] = useState('');
  const [faqSearch, setFaqSearch] = useState('');
  const [activeFaqId, setActiveFaqId] = useState('');

  useEffect(() => {
    setClock(formatClock(new Date()));
    const timer = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const checkServer = async () => {
      try {
        await getPegawai({ limit: 1 });
        if (!active) return;
        setServerReady(true);
        setStatus({ message: 'Server siap, Silahkan login.', tone: 'success' });
      } catch (err: any) {
        if (!active) return;
        const message = err?.message || 'tidak dapat terhubung';
        setStatus({
          message: `Gagal konek server: ${message}`,
          tone: 'error',
        });
      }
    };
    checkServer();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setFaqStatus('memuat data...');
    const timer = setTimeout(() => {
      setFaqItems(fallbackFaq);
      setFaqStatus('gunakan data contoh');
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const faqCategories = useMemo(
    () =>
      Array.from(new Set(faqItems.map((item) => item.category).filter(Boolean))).sort(),
    [faqItems]
  );

  const filteredFaq = useMemo(() => {
    const term = faqSearch.toLowerCase().trim();
    return faqItems.filter((item) => {
      if (faqCategory && item.category.toLowerCase() !== faqCategory.toLowerCase()) {
        return false;
      }
      if (!term) return true;
      return (
        item.question.toLowerCase().includes(term) ||
        item.answer.toLowerCase().includes(term)
      );
    });
  }, [faqItems, faqCategory, faqSearch]);

  useEffect(() => {
    if (!filteredFaq.length) {
      setActiveFaqId('');
      return;
    }
    if (filteredFaq.some((item) => item.id === activeFaqId)) return;
    setActiveFaqId(filteredFaq[0].id);
  }, [filteredFaq, activeFaqId]);

  const activeFaq = useMemo(
    () => filteredFaq.find((item) => item.id === activeFaqId),
    [filteredFaq, activeFaqId]
  );

  const statusClass = ['status', status.tone].filter(Boolean).join(' ');
  const faqStatusBadge = toBadgeStatus(faqStatus);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!serverReady || loading) return;
    setLoading(true);
    setStatus({ message: 'Memproses login...', tone: '' });
    try {
      const response = await login(form.username.trim(), form.password);
      if (!response?.ok) {
        setStatus({
          message: response?.error || 'Login gagal',
          tone: 'error',
        });
        return;
      }
      setStatus({ message: 'Login berhasil. Membuka dashboard...', tone: 'success' });
      router.push('/dashboard');
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Login gagal';
      setStatus({ message: `Gagal login: ${message}`, tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>SI Data Pegawai - Masuk</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/foto/Dinkes.png" />
      </Head>
      <div className="landing-page">
        <header>
          <div className="brand">
            <img src="/foto/Dinkes.png" alt="Logo Dinkes" />
            <div className="title">
              Subkelompok Kepegawaian
              <br />
              <span style={{ fontWeight: 600, color: '#4a5c55' }}>
                Dinas Kesehatan
              </span>
            </div>
          </div>
          <div className="pill">
            <span className="dot" />
            <span>{clock}</span>
          </div>
        </header>

        <main>
          <section className="hero">
            <div>
              <div className="tag">Informasi Kepegawaian</div>
              <h1>Layanan Kepegawaian Dinas Kesehatan Provinsi DKI Jakarta</h1>
              <p>
                Akses informasi perencanaan dan pendayagunaan pegawai,
                kesejahteraan pegawai, pengembangan karir, serta disiplin pegawai
                terintegrasi.
              </p>
              <a className="cta" href="#" aria-disabled="true">
                Baca Selengkapnya
              </a>
            </div>
            <div className="login-card">
              <h3>Masuk Sistem Informasi Data Pegawai</h3>
              <form onSubmit={handleLogin}>
                <div>
                  <label htmlFor="login-username">Username / UKPD ID</label>
                  <input
                    id="login-username"
                    name="username"
                    placeholder="Username"
                    required
                    value={form.username}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, username: event.target.value }))
                    }
                  />
                </div>
                <div style={{ marginTop: '10px' }}>
                  <label htmlFor="login-password">Password</label>
                  <div className="input-wrap">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      required
                      value={form.password}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="toggle-visibility"
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 5c5 0 9.27 3.11 11 7-1.73 3.89-6 7-11 7S2.73 15.89 1 12c1.73-3.89 6-7 11-7Zm0 2c-3.76 0-7.09 2.2-8.74 5 1.65 2.8 4.98 5 8.74 5s7.09-2.2 8.74-5C19.09 9.2 15.76 7 12 7Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn"
                  disabled={!serverReady || loading}
                >
                  Masuk
                </button>
              </form>
              <div className="muted">Lupa password? Hubungi admin Kepegawaian</div>
              <div className={statusClass}>Status: {status.message}</div>
            </div>
            <div className="bubble" />
            <div className="bubble small" />
          </section>

          <section className="faq-section">
            <div className="faq-card">
              <div className="faq-hero">
                <div className="faq-hero-text">
                  <div className="faq-kicker">QnA Layanan</div>
                  <h3 className="faq-title">Pusat jawaban cepat kepegawaian</h3>
                  <p className="faq-sub">
                    Temukan aturan, syarat, dan alur kerja mutasi atau pemutusan
                    JF dengan cepat, tanpa perlu scroll panjang.
                  </p>
                  <div className="faq-search-wrap">
                    <span className="faq-search-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M10 2a8 8 0 0 1 6.32 12.9l4.4 4.4-1.4 1.4-4.4-4.4A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z" />
                      </svg>
                    </span>
                    <input
                      className="faq-search"
                      placeholder="Cari pertanyaan..."
                      value={faqSearch}
                      onChange={(event) => setFaqSearch(event.target.value)}
                    />
                    <div className="faq-count">{filteredFaq.length} pertanyaan</div>
                  </div>
                </div>
                <div className="faq-hero-panel">
                  <div className="faq-panel-row">
                    <span className="faq-panel-label">Total FAQ</span>
                    <span className="faq-panel-value">{filteredFaq.length}</span>
                  </div>
                  <div className="faq-panel-row">
                    <span className="faq-panel-label">Status Data</span>
                    <span className="faq-panel-value">{faqStatusBadge}</span>
                  </div>
                  <div className="faq-panel-note">
                    Gunakan pencarian untuk menyaring jawaban instan berbasis kategori.
                  </div>
                </div>
              </div>

              <div className="faq-tags">
                {['Semua', ...faqCategories].map((tag) => {
                  const key = tag === 'Semua' ? '' : tag;
                  const isActive = faqCategory === key;
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`faq-tag${isActive ? ' active' : ''}`}
                      onClick={() => setFaqCategory(key)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <div className="faq-body">
                <div className="faq-list">
                  {filteredFaq.length === 0 ? (
                    <div className="faq-empty">Belum ada FAQ yang ditampilkan.</div>
                  ) : (
                    filteredFaq.map((item, index) => {
                      const preview =
                        item.answer.length > 120
                          ? `${item.answer.slice(0, 120)}...`
                          : item.answer;
                      const active = item.id === activeFaqId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`faq-item${active ? ' active' : ''}`}
                          aria-pressed={active}
                          onClick={() => setActiveFaqId(item.id)}
                        >
                          <div className="faq-item-index">{index + 1}</div>
                          <div className="faq-item-body">
                            <div className="faq-item-head">
                              <span className="faq-chip">{item.category}</span>
                              <span className="faq-item-meta">FAQ {index + 1}</span>
                            </div>
                            <div className="faq-item-title">{item.question}</div>
                            <div className="faq-item-preview">{preview || '-'}</div>
                          </div>
                          <div className="faq-item-arrow" aria-hidden="true" />
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="faq-detail">
                  <div className="faq-detail-head">
                    <div className="faq-chip">{activeFaq?.category || 'Umum'}</div>
                    <div className="faq-detail-meta">
                      Status: {activeFaq?.status || '-'}
                    </div>
                  </div>
                  <h4 className="faq-detail-title">
                    {activeFaq?.question || 'Pilih pertanyaan di daftar.'}
                  </h4>
                  <div className="faq-detail-answer">
                    {activeFaq?.answer || 'Jawaban akan tampil otomatis di sini.'}
                  </div>
                </div>
              </div>

              <div className="faq-status">Status FAQ: {faqStatus}</div>
            </div>
          </section>
        </main>

        <footer>
          (c) 2025 SI Data Informasi dan Layanan Keppegawaian. Sub Kelompok
          Kepegawaian Dinas Kesehatan Provinsi DKI Jakarta.
        </footer>
      </div>
    </>
  );
}
