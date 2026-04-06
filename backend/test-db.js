const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔄 Testing database connection...');
    
    // Test koneksi
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    
    // Test query ke tabel ukpd
    const ukpdCount = await prisma.ukpd.count();
    console.log(`✅ Found ${ukpdCount} UKPD records`);
    
    // Test query ke tabel pegawai_master
    const pegawaiCount = await prisma.pegawai_master.count();
    console.log(`✅ Found ${pegawaiCount} Pegawai records`);
    
    console.log('\n✅ All database connections working correctly!');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
