import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators';
import { getPaymentProvider, getVnpayConfig } from '../payment-config';
import { CreateVnpayPaymentDto } from './vnpay.dto';
import { VnpayCallbackResult, VnpayPaymentsService } from './vnpay-payments.service';

@Controller('payments')
export class VnpayController {
  constructor(private readonly vnpayPayments: VnpayPaymentsService) {}

  /** Công khai: frontend hỏi để biết nên hiện luồng QR VNPay hay luồng mock. */
  @Get('config')
  getConfig() {
    const provider = getPaymentProvider();
    return {
      provider,
      vnpay: provider === 'vnpay' ? { qrTtlMinutes: getVnpayConfig().qrTtlMinutes } : null,
    };
  }

  @Post('vnpay/create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVnpayPaymentDto,
    @Req() req: Request,
  ) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.socket?.remoteAddress;
    return this.vnpayPayments.createPayment(user, dto.orderId, ip);
  }

  /** VNPay gọi server-to-server (GET). Luôn trả HTTP 200 kèm RspCode theo đặc tả của VNPay. */
  @Get('vnpay/ipn')
  async ipn(@Query() query: Record<string, unknown>) {
    const result = await this.vnpayPayments.handleCallback(query);
    return { RspCode: result.rspCode, Message: result.message };
  }

  /** Trình duyệt khách quay về từ trang VNPay: xác thực rồi chuyển hướng 303 về website. */
  @Get('vnpay/return')
  async returnFromVnpay(@Query() query: Record<string, unknown>, @Res() res: Response) {
    const result = await this.vnpayPayments.handleCallback(query);
    res.redirect(HttpStatus.SEE_OTHER, this.frontendUrlFor(result));
  }

  private frontendUrlFor(result: VnpayCallbackResult): string {
    const { frontendUrl } = getVnpayConfig();
    if (!result.orderId) return `${frontendUrl}/orders`;
    const base = `${frontendUrl}/orders/${encodeURIComponent(result.orderId)}`;
    switch (result.outcome) {
      case 'paid':
        return `${base}?paid=1`;
      case 'failed':
        return `${base}?pay=failed`;
      case 'paid_unapplied':
        return `${base}?pay=review`;
      default:
        return base;
    }
  }
}
