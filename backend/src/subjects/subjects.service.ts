import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from './entities/subject.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectsRepo: Repository<Subject>,
  ) {}

  create(dto: CreateSubjectDto): Promise<Subject> {
    const subject = this.subjectsRepo.create(dto);
    return this.subjectsRepo.save(subject);
  }

  findAll(): Promise<Subject[]> {
    return this.subjectsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Subject> {
    const subject = await this.subjectsRepo.findOne({ where: { id } });
    if (!subject) throw new NotFoundException(`No existe la materia ${id}.`);
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<Subject> {
    const subject = await this.findOne(id);
    Object.assign(subject, dto);
    return this.subjectsRepo.save(subject);
  }

  async remove(id: string): Promise<void> {
    const result = await this.subjectsRepo.delete(id);
    if (!result.affected) throw new NotFoundException(`No existe la materia ${id}.`);
  }
}
