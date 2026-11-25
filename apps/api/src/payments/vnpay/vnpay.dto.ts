import { IsNotEmpty, IsString } from 'class-validator';

export class CreateVnpayPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã đơn hàng không được để trống' })
  orderId!: string;
}
