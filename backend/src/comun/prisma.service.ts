import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    // Sesión en UTC: el adaptador envía los timestamps sin zona horaria (ver DECISIONES D-15).
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        options: '-c timezone=UTC',
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
