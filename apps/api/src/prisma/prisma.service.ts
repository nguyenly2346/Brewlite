import { Injectable, OnModuleInit, OnModuleDestroy, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { runDatabaseSeed } from '../../prisma/seed';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap {
  async onModuleInit() {
    await this.$connect();
  }

  async onApplicationBootstrap() {
    try {
      const productCount = await this.product.count();
      if (productCount === 0) {
        await runDatabaseSeed(this);
      }
    } catch {
      try {
        await runDatabaseSeed(this);
      } catch {
        return;
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
