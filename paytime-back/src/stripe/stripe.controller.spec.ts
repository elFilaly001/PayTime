import { Test, TestingModule } from '@nestjs/testing';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';

// Create a mock of the StripeService
const mockStripeService = {
  createPaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_test123' }),
  createCustomer: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
  createPaymentToken: jest.fn().mockResolvedValue('tok_test123'),
  attachPaymentMethod: jest.fn().mockResolvedValue({ id: 'pm_test123' }),
  processLoanRepayment: jest.fn().mockResolvedValue({ id: 'pi_test123' }),
  refundPayment: jest.fn().mockResolvedValue({ id: 'ref_test123' }),
  detachPaymentMethod: jest.fn().mockResolvedValue({ id: 'pm_test123' }),
  processPayment: jest.fn().mockResolvedValue({ id: 'pi_test123' }),
  sendPayout: jest.fn().mockResolvedValue({ id: 'po_test123' }),
  getBankAccount: jest.fn().mockResolvedValue('ba_test123'),
};

describe('StripeController', () => {
  let controller: StripeController;
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeController],
      providers: [
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
      ],
    }).compile();

    controller = module.get<StripeController>(StripeController);
    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });


  
});
