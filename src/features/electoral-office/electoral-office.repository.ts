import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElectoralOffice, OfficeCategory } from './electoral-office.entity';

@Injectable()
export class ElectoralOfficeRepository {
  constructor(
    @InjectRepository(ElectoralOffice)
    private readonly repository: Repository<ElectoralOffice>,
  ) {}

  async create(data: Partial<ElectoralOffice>): Promise<ElectoralOffice> {
    const office = this.repository.create(data);
    return this.repository.save(office);
  }

  async findAll(): Promise<ElectoralOffice[]> {
    return this.repository.find({
      relations: {
        state: true,
        lgas: true,
        wards: true,
      },
      order: { title: 'ASC' },
    });
  }

  async findOne(id: number): Promise<ElectoralOffice | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        state: true,
        lgas: true,
        wards: true,
      },
    });
  }

  async findByCategory(
    category: OfficeCategory,
    isActive?: boolean,
  ): Promise<ElectoralOffice[]> {
    const whereCondition: { category: OfficeCategory; isActive?: boolean } = {
      category,
    };
    if (isActive !== undefined) {
      whereCondition.isActive = isActive;
    }

    return this.repository.find({
      where: whereCondition,
      relations: {
        state: true,
        lgas: true,
        wards: true,
      },
      order: { title: 'ASC' },
    });
  }

  async save(office: ElectoralOffice): Promise<ElectoralOffice> {
    return this.repository.save(office);
  }

  async remove(id: number): Promise<ElectoralOffice | null> {
    const office = await this.findOne(id);
    if (!office) {
      return null;
    }
    return this.repository.remove(office);
  }
}
