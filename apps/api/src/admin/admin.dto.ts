import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class AdjustInventoryDto {
  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantityChange?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchaseQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  packPrice?: number;

  @IsIn(['IMPORT', 'ADJUSTMENT'], { message: 'Loại giao dịch kho phải là IMPORT hoặc ADJUSTMENT' })
  type!: 'IMPORT' | 'ADJUSTMENT';

  @IsString()
  @IsNotEmpty({ message: 'Lý do điều chỉnh không được để trống' })
  reason!: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;
}

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  unit!: string;

  @IsOptional()
  @IsString()
  purchaseUnit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001, { message: 'Quy cách đóng gói phải lớn hơn 0' })
  purchaseUnitSize?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentStock!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minThreshold!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPerUnit!: number;
}

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unit?: string;

  @IsOptional()
  @IsString()
  purchaseUnit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  purchaseUnitSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minThreshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPerUnit?: number;
}

export class UpsertRecipeDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001, { message: 'Định lượng phải lớn hơn 0' })
  quantityNeeded!: number;
}

export class UpdateRecipeDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001, { message: 'Định lượng phải lớn hơn 0' })
  quantityNeeded!: number;
}

export class CreateAccountDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(100)
  fullName!: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsEnum(UserRole, { message: 'Vai trò phải là CUSTOMER hoặc ADMIN' })
  role!: UserRole;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Vai trò phải là CUSTOMER hoặc ADMIN' })
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  @MaxLength(100)
  password?: string;
}
