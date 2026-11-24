import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AdminAccountsService } from './admin-accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './admin.dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { AuthenticatedUser, CurrentUser, Roles } from '../common/decorators';

@Controller('admin/accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminAccountsController {
  constructor(private readonly accountsService: AdminAccountsService) {}

  @Get()
  async list() {
    return this.accountsService.list();
  }

  @Post()
  async create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.accountsService.update(id, dto, actor);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.accountsService.remove(id, actor);
  }
}
