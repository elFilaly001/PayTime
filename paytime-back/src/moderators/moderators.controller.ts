import { Controller } from '@nestjs/common';
import { ModeratorsService } from './moderators.service';

@Controller('moderators')
export class ModeratorsController {
  constructor(private readonly moderatorsService: ModeratorsService) {}
}
