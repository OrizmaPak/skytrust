const { PrismaClient } = require('@prisma/client');

let prisma;

console.log(process.env.NODE_ENV);

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

prisma.$connect().then(() => {
  console.log('Prisma connected successfully');
}).catch((error) => {  
  // console.error('Prisma connection error:'); 
  console.error('Prisma connection error:', error);
});
 
module.exports = prisma;
   