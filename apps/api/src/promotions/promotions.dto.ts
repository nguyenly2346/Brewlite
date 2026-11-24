import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ApplyPromotionDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã khuyến mãi' })
  code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Tổng tạm tính không hợp lệ' })
  subtotal!: number;
}

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã khuyến mãi không được để trống' })
  @MaxLength(30, { message: 'Mã khuyến mãi tối đa 30 ký tự' })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Mã khuyến mãi chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới',
  })
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'Mô tả không được để trống' })
  @MaxLength(200)
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Phần trăm giảm phải từ 1 đến 100' })
  @Max(100, { message: 'Phần trăm giảm phải từ 1 đến 100' })
  discountPercent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Mức giảm tối đa không hợp lệ' })
  maxDiscountAmount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Giá trị đơn tối thiểu không hợp lệ' })
  minOrderValue!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsDateString({}, { message: 'Ngày hết hạn không hợp lệ' })
  expiresAt!: string;
}

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Phần trăm giảm phải từ 1 đến 100' })
  @Max(100, { message: 'Phần trăm giảm phải từ 1 đến 100' })
  discountPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxDiscountAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrderValue?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày hết hạn không hợp lệ' })
  expiresAt?: string;
}
