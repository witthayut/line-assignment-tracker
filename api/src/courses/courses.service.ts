import { Injectable, NotFoundException } from '@nestjs/common';
import type { Course } from '@prisma/client';
import { CourseData, pickCourseColor } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

export interface CourseView {
  id: string;
  code: string | null;
  name: string;
  professor: string | null;
  color: string;
  openCount: number;
}

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<CourseView[]> {
    const courses = await this.prisma.course.findMany({
      where: { userId },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { assignments: { where: { state: 'CONFIRMED', status: { not: 'COMPLETE' } } } } },
      },
    });
    return courses.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      professor: c.professor,
      color: c.color,
      openCount: c._count.assignments,
    }));
  }

  async create(userId: string, data: CourseData): Promise<Course> {
    const count = await this.prisma.course.count({ where: { userId } });
    return this.prisma.course.create({
      data: {
        userId,
        name: data.name ?? 'Untitled course',
        code: data.code ?? null,
        professor: data.professor ?? null,
        color: data.color ?? pickCourseColor(count),
      },
    });
  }

  async update(userId: string, id: string, data: CourseData): Promise<Course> {
    await this.mustOwn(userId, id);
    return this.prisma.course.update({ where: { id }, data });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.mustOwn(userId, id);
    await this.prisma.course.delete({ where: { id } }); // assignments keep existing with no course
  }

  async mustOwn(userId: string, id: string): Promise<Course> {
    const course = await this.prisma.course.findFirst({ where: { id, userId } });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  /** Used when confirming a draft whose course the AI saw but isn't in the list yet. */
  async findOrCreate(userId: string, code: string | null, name: string | null): Promise<Course | null> {
    if (!code && !name) return null;
    const existing = await this.prisma.course.findFirst({
      where: {
        userId,
        OR: [
          ...(code ? [{ code: { equals: code, mode: 'insensitive' as const } }] : []),
          ...(name ? [{ name: { equals: name, mode: 'insensitive' as const } }] : []),
        ],
      },
    });
    if (existing) return existing;
    return this.create(userId, { code, name: name ?? code ?? 'Untitled course' });
  }
}
