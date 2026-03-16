import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const bd = await prisma.bD.findFirst()
  console.log(bd?.email, bd?.password)
}
main()
