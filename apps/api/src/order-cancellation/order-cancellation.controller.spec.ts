
import { Test, TestingModule } from '@nestjs/testing';
import { OrderCancellationController } from './order-cancellation.controller';
import { OrderCancellationService } from './order-cancellation.service';

describe('OrderCancellationController', () => {
  let controller: OrderCancellationController;

  const mockOrderCancellationService = {
    cancelOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderCancellationController],
      providers: [
        {
          provide: OrderCancellationService,
          useValue: mockOrderCancellationService,
        },
      ],
    }).compile();

    controller = module.get<OrderCancellationController>(
      OrderCancellationController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
