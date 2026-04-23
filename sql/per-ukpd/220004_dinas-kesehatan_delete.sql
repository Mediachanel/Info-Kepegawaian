-- Hapus data pegawai Dinas Kesehatan (UKPD 220004) sebelum import ulang
-- Cakupan:
-- 1. sisdmk2.pegawai
-- 2. si_data.alamat
-- 3. si_data.riwayat_jabatan
-- 4. si_data.riwayat_pangkat
-- 5. si_data.riwayat_pendidikan
-- 6. si_data.pasangan
-- 7. si_data.anak
-- Baris di tabel ukpd tidak dihapus otomatis. Aktifkan bagian opsional bila perlu.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TEMPORARY TABLE IF EXISTS `tmp_delete_pegawai_dinkes`;
CREATE TEMPORARY TABLE `tmp_delete_pegawai_dinkes` (
  `id_pegawai` INT NOT NULL,
  PRIMARY KEY (`id_pegawai`)
) ENGINE=Memory
AS
SELECT DISTINCT `id_pegawai`
FROM `sisdmk2`.`pegawai`
WHERE `id_ukpd` = 220004
   OR `ukpd_id` = 220004
   OR `nama_ukpd` = 'Dinas Kesehatan';

SELECT COUNT(*) AS `target_pegawai_dinkes`
FROM `tmp_delete_pegawai_dinkes`;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM `information_schema`.`tables`
    WHERE `table_schema` = 'si_data'
      AND `table_name` = 'alamat'
  ),
  'DELETE a FROM `si_data`.`alamat` a INNER JOIN `tmp_delete_pegawai_dinkes` t ON t.`id_pegawai` = a.`id_pegawai`',
  'SELECT ''skip si_data.alamat'' AS `info`'
);
PREPARE `stmt` FROM @sql;
EXECUTE `stmt`;
DEALLOCATE PREPARE `stmt`;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM `information_schema`.`tables`
    WHERE `table_schema` = 'si_data'
      AND `table_name` = 'pasangan'
  ),
  'DELETE p FROM `si_data`.`pasangan` p INNER JOIN `tmp_delete_pegawai_dinkes` t ON t.`id_pegawai` = p.`id_pegawai`',
  'SELECT ''skip si_data.pasangan'' AS `info`'
);
PREPARE `stmt` FROM @sql;
EXECUTE `stmt`;
DEALLOCATE PREPARE `stmt`;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM `information_schema`.`tables`
    WHERE `table_schema` = 'si_data'
      AND `table_name` = 'anak'
  ),
  'DELETE a FROM `si_data`.`anak` a INNER JOIN `tmp_delete_pegawai_dinkes` t ON t.`id_pegawai` = a.`id_pegawai`',
  'SELECT ''skip si_data.anak'' AS `info`'
);
PREPARE `stmt` FROM @sql;
EXECUTE `stmt`;
DEALLOCATE PREPARE `stmt`;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM `information_schema`.`tables`
    WHERE `table_schema` = 'si_data'
      AND `table_name` = 'riwayat_jabatan'
  ),
  'DELETE r FROM `si_data`.`riwayat_jabatan` r INNER JOIN `tmp_delete_pegawai_dinkes` t ON t.`id_pegawai` = r.`id_pegawai`',
  'SELECT ''skip si_data.riwayat_jabatan'' AS `info`'
);
PREPARE `stmt` FROM @sql;
EXECUTE `stmt`;
DEALLOCATE PREPARE `stmt`;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM `information_schema`.`tables`
    WHERE `table_schema` = 'si_data'
      AND `table_name` = 'riwayat_pangkat'
  ),
  'DELETE r FROM `si_data`.`riwayat_pangkat` r INNER JOIN `tmp_delete_pegawai_dinkes` t ON t.`id_pegawai` = r.`id_pegawai`',
  'SELECT ''skip si_data.riwayat_pangkat'' AS `info`'
);
PREPARE `stmt` FROM @sql;
EXECUTE `stmt`;
DEALLOCATE PREPARE `stmt`;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM `information_schema`.`tables`
    WHERE `table_schema` = 'si_data'
      AND `table_name` = 'riwayat_pendidikan'
  ),
  'DELETE r FROM `si_data`.`riwayat_pendidikan` r INNER JOIN `tmp_delete_pegawai_dinkes` t ON t.`id_pegawai` = r.`id_pegawai`',
  'SELECT ''skip si_data.riwayat_pendidikan'' AS `info`'
);
PREPARE `stmt` FROM @sql;
EXECUTE `stmt`;
DEALLOCATE PREPARE `stmt`;

DELETE p
FROM `sisdmk2`.`pegawai` p
INNER JOIN `tmp_delete_pegawai_dinkes` t
  ON t.`id_pegawai` = p.`id_pegawai`;

-- Opsional: hapus juga baris UKPD Dinas Kesehatan.
-- Jalankan hanya jika memang ingin reset row UKPD-nya juga.
-- DELETE FROM `sisdmk2`.`ukpd`
-- WHERE `id_ukpd` = 220004
--    OR `ukpd_id` = 220004
--    OR `nama_ukpd` = 'Dinas Kesehatan';

SELECT COUNT(*) AS `sisa_pegawai_dinkes`
FROM `sisdmk2`.`pegawai`
WHERE `id_ukpd` = 220004
   OR `ukpd_id` = 220004
   OR `nama_ukpd` = 'Dinas Kesehatan';

DROP TEMPORARY TABLE IF EXISTS `tmp_delete_pegawai_dinkes`;

SET FOREIGN_KEY_CHECKS = 1;
