import { Controller, Get, Module } from '@nestjs/common';
import { AssignmentsController } from './assignments/assignments.controller';
import { AssignmentsService } from './assignments/assignments.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { CoursesController } from './courses/courses.controller';
import { CoursesService } from './courses/courses.service';
import { BotService } from './line/bot.service';
import { LineController } from './line/line.controller';
import { PrismaModule } from './prisma/prisma.service';

@Controller('health')
class HealthController {
  @Get()
  health(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [HealthController, AuthController, CoursesController, AssignmentsController, LineController],
  providers: [AuthService, AuthGuard, CoursesService, AssignmentsService, BotService],
})
export class AppModule {}
