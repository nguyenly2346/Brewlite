import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
} from '../promotions/promotions.dto';

@Injectable()
export class AdminPromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.promotion.findMany({
      orderBy: [{ isActive: 'desc' }, { expiresAt: 'desc' }],
    });
  }

  async create(dto: CreatePromotionDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.promotion.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException(`Mã khuyến mãi ${code} đã tồn tại`);
    }

    const created = await this.prisma.promotion.create({
      data: {
        code,
        description: dto.description.trim(),
        discountPercent: dto.discountPercent,
        maxDiscountAmount: dto.maxDiscountAmount,
        minOrderValue: dto.minOrderValue,
        isActive: dto.isActive ?? true,
        expiresAt: new Date(dto.expiresAt),
      },
    });

    await this.audit('PROMOTION_CREATE', code, `Tạo mã ${code} (-${dto.discountPercent}%)`);
    return created;
  }

  async update(id: string, dto: UpdatePromotionDto) {
    const existing = await this.prisma.promotion.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy mã khuyến mãi');
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.discountPercent !== undefined ? { discountPercent: dto.discountPercent } : {}),
        ...(dto.maxDiscountAmount !== undefined ? { maxDiscountAmount: dto.maxDiscountAmount } : {}),
        ...(dto.minOrderValue !== undefined ? { minOrderValue: dto.minOrderValue } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt: new Date(dto.expiresAt) } : {}),
      },
    });

    await this.audit('PROMOTION_UPDATE', existing.code, `Cập nhật mã ${existing.code}`);
    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.promotion.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy mã khuyến mãi');
    }

    await this.prisma.promotion.delete({ where: { id } });
    await this.audit('PROMOTION_DELETE', existing.code, `Xóa mã ${existing.code}`);
    return { deleted: true, id };
  }

  private async audit(action: string, entityId: string, details: string) {
    await this.prisma.auditLog.create({
      data: { action, entityType: 'PROMOTION', entityId, details },
    });
  }
}
