import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { OrderCancellationService } from './order-cancellation.service';
import { JwtAuthGuard } from '../common/guards';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderCancellationController {
  constructor(
    private readonly cancellationService: OrderCancellationService,
  ) {}

  @Post(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { cancelReason?: string },
  ) {
    return this.cancellationService.cancelOrder(
      id,
      user,
      body.cancelReason,
    );
  }
}