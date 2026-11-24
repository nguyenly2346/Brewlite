import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminAccountsController } from './admin-accounts.controller';
import { AdminPromotionsService } from './admin-promotions.service';
import { AdminPromotionsController } from './admin-promotions.controller';

@Module({
  controllers: [AdminController, AdminAccountsController, AdminPromotionsController],
  providers: [AdminService, AdminAccountsService, AdminPromotionsService],
})
export class AdminModule {}
