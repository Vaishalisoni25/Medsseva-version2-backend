const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.cmsBanner.findMany().then(b => { console.log(b); p.$disconnect(); });
