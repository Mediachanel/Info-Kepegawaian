import { prisma } from './src/lib/prisma'

async function testConnection() {
  try {
    console.log('🔄 Checking all jenis pegawai...')
    
    // Get distinct jenis_pegawai values
    const jenisPegawai = await prisma.pegawai_master.groupBy({
      by: ['jenis_pegawai'],
      _count: {
        id_pegawai: true
      }
    })
    
    console.log('\nJenis Pegawai dan jumlahnya:')
    console.log('================================')
    let total = 0
    jenisPegawai.forEach((item: any) => {
      console.log(`${item.jenis_pegawai || 'NULL'}: ${item._count.id_pegawai}`)
      total += item._count.id_pegawai
    })
    
    console.log('================================')
    console.log(`Total Pegawai: ${total}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
