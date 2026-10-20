import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Response } from 'express';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { AssignmentsService } from './assignments.service';

@Controller('assignments')
@UseGuards(AuthGuard)
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.assignments.list(user.id);
  }

  /** Works for drafts too (the LIFF edit page loads a draft by id). */
  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.assignments.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: unknown) {
    return this.assignments.create(user.id, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() body: unknown) {
    return this.assignments.update(user.id, id, body);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@CurrentUser() user: User, @Param('id') id: string, @Body() body: unknown) {
    return this.assignments.confirm(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.assignments.remove(user.id, id);
  }

  /** The original screenshot sent to the bot. */
  @Get(':id/image')
  async image(@CurrentUser() user: User, @Param('id') id: string, @Res() res: Response): Promise<void> {
    const file = await this.assignments.imageFile(user.id, id);
    if (!file) throw new NotFoundException('No image');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(file);
  }
}
