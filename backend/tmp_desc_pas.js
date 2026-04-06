const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
const env = fs.readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) {
      acc[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    }
    return acc;
  }, {});
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT || 3306,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
  });
  const [rows] = await c.execute('DESCRIBE pasangan');
  console.log(rows.map(r => `${r.Field}\t${r.Type}` ).join('\n'));
  await c.end();
})();
