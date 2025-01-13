import { Controller } from '@nestjs/common';
import { TickestService } from './tickest.service';

@Controller('tickest')
export class TickestController {
  constructor(private readonly tickestService: TickestService) {}
}
