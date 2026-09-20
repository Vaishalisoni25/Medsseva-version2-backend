const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.cmsBanner.updateMany({
  where: { title: { startsWith: '[PROMO]' } },
  data: { bannerType: 'PROMO' }
}).then(async (res) => {
  const banners = await p.cmsBanner.findMany({ where: { bannerType: 'PROMO' } });
  for (const b of banners) {
    if (b.title.startsWith('[PROMO]')) {
      await p.cmsBanner.update({
        where: { id: b.id },
        data: { title: b.title.replace('[PROMO]', '').trim() }
      });
    }
  }
  console.log('Fixed banners!');
  p.$disconnect();
});
