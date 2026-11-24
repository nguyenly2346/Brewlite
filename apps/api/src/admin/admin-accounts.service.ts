import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators';
import { CreateAccountDto, UpdateAccountDto } from './admin.dto';

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  isActive: true,
  loyaltyPoints: true,
  createdAt: true,
  _count: { select: { orders: true } },
} as const;

@Injectable()
export class AdminAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.user.findMany({
      select: ACCOUNT_SELECT,
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateAccountDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký tài khoản');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        role: dto.role,
      },
      select: ACCOUNT_SELECT,
    });
  }

  async update(id: string, dto: UpdateAccountDto, actor: AuthenticatedUser) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const losesAdminAccess =
      target.role === UserRole.ADMIN &&
      target.isActive &&
      ((dto.role !== undefined && dto.role !== UserRole.ADMIN) || dto.isActive === false);

    if (losesAdminAccess) {
      if (target.id === actor.id) {
        throw new BadRequestException('Không thể tự khóa hoặc hạ quyền tài khoản đang đăng nhập');
      }
      await this.assertNotLastAdmin(target.id);
    }

    const data: {
      fullName?: string;
      phone?: string | null;
      role?: UserRole;
      isActive?: boolean;
      passwordHash?: string;
    } = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.update({ where: { id }, data, select: ACCOUNT_SELECT });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!target) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }
    if (target.id === actor.id) {
      throw new BadRequestException('Không thể tự xóa tài khoản đang đăng nhập');
    }
    if (target._count.orders > 0) {
      throw new ConflictException(
        'Tài khoản đã có đơn hàng nên không thể xóa (sẽ mất lịch sử đơn). Hãy khóa tài khoản thay vì xóa.',
      );
    }
    if (target.role === UserRole.ADMIN && target.isActive) {
      await this.assertNotLastAdmin(target.id);
    }
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async assertNotLastAdmin(excludeId: string) {
    const others = await this.prisma.user.count({
      where: { role: UserRole.ADMIN, isActive: true, id: { not: excludeId } },
    });
    if (others === 0) {
      throw new BadRequestException('Phải còn ít nhất một tài khoản quản trị đang hoạt động');
    }
  }
}
