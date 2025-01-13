import { Test, TestingModule } from '@nestjs/testing';
import { TickestService } from './tickest.service';

describe('TickestService', () => {
  let service: TickestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TickestService],
    }).compile();

    service = module.get<TickestService>(TickestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
