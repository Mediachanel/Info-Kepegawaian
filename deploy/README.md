# Deploy Package

Paket `sisdmk2-casaos-deploy.zip` harus dibuat dari source yang aktif di repo ini:

- `frontend/` untuk UI Next.js
- `backend/` untuk API Next.js
- `docker-compose.yml` untuk orkestrasi container

Jangan memakai zip lama berbasis `src/app/...` monolitik, karena isinya sudah tidak
sesuai dengan struktur repo saat ini dan dapat membuat domain aktif menampilkan
aplikasi yang berbeda dengan source terbaru.

Untuk membuat ulang zip deploy:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/build-deploy-zip.ps1
```
