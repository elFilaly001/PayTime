import { Test, TestingModule } from '@nestjs/testing';
import { TickestController } from './tickest.controller';
import { TickestService } from './tickest.service';

describe('TickestController', () => {
  let controller: TickestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TickestController],
      providers: [TickestService],
    }).compile();

    controller = module.get<TickestController>(TickestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
