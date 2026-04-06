const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkJenisPegawai() {
  try {
    const result = await prisma.pegawai_master.groupBy({
      by: ['jenis_pegawai'],
      _count: {
        id_pegawai: true
      }
    });

    console.log('\nJenis Pegawai dan jumlahnya:');
    console.log('================================');
    let total = 0;
    result.forEach((item) => {
      console.log(`${item.jenis_pegawai || 'NULL'}: ${item._count.id_pegawai}`);
      total += item._count.id_pegawai;
    });
    
    console.log('================================');
    console.log(`Total Pegawai: ${total}\n`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJenisPegawai();
