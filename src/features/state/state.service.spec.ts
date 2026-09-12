import { Test, TestingModule } from '@nestjs/testing';
import { StateService } from './state.service';
import { StateRepository } from './state.repository';
import { DataSource } from 'typeorm';
import { State } from './state.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('StateService', () => {
  let service: StateService;
  let repository: jest.Mocked<StateRepository>;
  let dataSource: any;

  const mockState: State = {
    id: 1,
    name: 'Lagos State',
    code: 'LAG',
    lgas: [],
    electoralOffices: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      bulkInsert: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByName: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const mockDS = {
      getMetadata: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StateService,
        { provide: StateRepository, useValue: mockRepo },
        { provide: DataSource, useValue: mockDS },
      ],
    }).compile();

    service = module.get<StateService>(StateService);
    repository = module.get(StateRepository);
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTemplate', () => {
    it('should generate a valid CSV template with human-readable headers and sample data', () => {
      const template = service.generateTemplate();
      expect(template).toContain('Name');
      expect(template).toContain('Code');
      expect(template).toContain('Lagos State');
      expect(template).toContain('LAG');
    });
  });

  describe('uploadStates', () => {
    it('should throw BadRequestException if no file or buffer provided', async () => {
      await expect(service.uploadStates(null as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadStates({} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for non-csv file extension and mimetype', async () => {
      const file = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('dummy content'),
      } as Express.Multer.File;

      await expect(service.uploadStates(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if CSV file is empty', async () => {
      const file = {
        originalname: 'states.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('   '),
      } as Express.Multer.File;

      await expect(service.uploadStates(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if CSV is missing required headers', async () => {
      const file = {
        originalname: 'states.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('WrongHeader,AnotherWrong\nLagos,LAG\n'),
      } as Express.Multer.File;

      await expect(service.uploadStates(file)).rejects.toThrow(
        /Invalid CSV headers\. Missing expected header/,
      );
    });

    it('should throw BadRequestException if CSV has no data rows', async () => {
      const file = {
        originalname: 'states.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('Name,Code\n \n'),
      } as Express.Multer.File;

      await expect(service.uploadStates(file)).rejects.toThrow(
        /CSV file has no data rows/,
      );
    });

    it('should throw BadRequestException if a row has empty value for required column', async () => {
      const file = {
        originalname: 'states.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('Name,Code\n"   ",LAG\n'),
      } as Express.Multer.File;

      await expect(service.uploadStates(file)).rejects.toThrow(
        /Row 1 validation failed: Column "Name" cannot be empty/,
      );
    });

    it('should parse valid CSV, bulk insert and return all states', async () => {
      const file = {
        originalname: 'states.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('Name,Code\nLagos State,LAG\nKano State,KNO\n'),
      } as Express.Multer.File;

      repository.bulkInsert.mockResolvedValue(undefined);
      repository.findAll.mockResolvedValue([mockState]);

      const result = await service.uploadStates(file);
      expect(repository.bulkInsert).toHaveBeenCalledWith([
        { name: 'Lagos State', code: 'LAG' },
        { name: 'Kano State', code: 'KNO' },
      ]);
      expect(repository.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockState]);
    });

    it('should tolerate arbitrary spacing and casing in headers', async () => {
      const file = {
        originalname: 'states.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('  name  ,   coDE   \nDelta State,DEL\n'),
      } as Express.Multer.File;

      repository.bulkInsert.mockResolvedValue(undefined);
      repository.findAll.mockResolvedValue([mockState]);

      const result = await service.uploadStates(file);
      expect(repository.bulkInsert).toHaveBeenCalledWith([
        { name: 'Delta State', code: 'DEL' },
      ]);
      expect(result).toEqual([mockState]);
    });

    it('should deduplicate case-insensitively using statesDuplicateKey', async () => {
      const file = {
        originalname: 'states.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(
          'Name,Code\nLagos State,LAG\nlagos state,LAG_DUP\nRivers State,RVR\n',
        ),
      } as Express.Multer.File;

      repository.bulkInsert.mockResolvedValue(undefined);
      repository.findAll.mockResolvedValue([mockState]);

      await service.uploadStates(file);
      expect(repository.bulkInsert).toHaveBeenCalledWith([
        { name: 'Lagos State', code: 'LAG' },
        { name: 'Rivers State', code: 'RVR' },
      ]);
    });
  });

  describe('create', () => {
    it('should create and return a new state', async () => {
      repository.findByName.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockState);

      const result = await service.create({ name: 'Lagos State', code: 'LAG' });
      expect(result).toEqual(mockState);
      expect(repository.create).toHaveBeenCalledWith({
        name: 'Lagos State',
        code: 'LAG',
      });
    });

    it('should throw BadRequestException if state name already exists', async () => {
      repository.findByName.mockResolvedValue(mockState);

      await expect(
        service.create({ name: 'Lagos State', code: 'LAG' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all states', async () => {
      repository.findAll.mockResolvedValue([mockState]);
      const result = await service.findAll();
      expect(result).toEqual([mockState]);
    });
  });

  describe('findOne', () => {
    it('should return state by id', async () => {
      repository.findOne.mockResolvedValue(mockState);
      const result = await service.findOne(1);
      expect(result).toEqual(mockState);
    });

    it('should throw NotFoundException if state not found', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the updated state', async () => {
      repository.findOne.mockResolvedValue(mockState);
      repository.update.mockResolvedValue({
        ...mockState,
        name: 'Lagos State',
      });

      const result = await service.update(1, { name: 'Lagos State' });
      expect(result.name).toEqual('Lagos State');
    });

    it('should throw NotFoundException if state to update not found', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.update(99, { name: 'New Name' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove and return the deleted state', async () => {
      repository.findOne.mockResolvedValue(mockState);
      repository.remove.mockResolvedValue(mockState);

      const result = await service.remove(1);
      expect(result).toEqual(mockState);
    });

    it('should throw NotFoundException if state to remove not found', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });
});
