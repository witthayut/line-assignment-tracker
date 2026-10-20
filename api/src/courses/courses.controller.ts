import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { validate } from '../common/http';
import { parseCourseInput } from '../common/validation';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { CoursesService } from './courses.service';

@Controller('courses')
@UseGuards(AuthGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.courses.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: unknown) {
    const data = validate(() => parseCourseInput(body, false));
    return this.courses.create(user.id, data);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() body: unknown) {
    const data = validate(() => parseCourseInput(body, true));
    return this.courses.update(user.id, id, data);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.courses.remove(user.id, id);
  }
}
