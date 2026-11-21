
import { Test, TestingModule } from '@nestjs/testing';
import { OrderCancellationService } from './order-cancellation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrderCancellationService', () => {
  let service: OrderCancellationService;

  const mockPrismaService = {
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderCancellationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrderCancellationService>(
      OrderCancellationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
