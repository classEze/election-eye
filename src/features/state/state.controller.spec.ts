import { Test, TestingModule } from '@nestjs/testing';
import { StateController } from './state.controller';
import { StateService } from './state.service';
import { State } from './state.entity';
import { Response } from 'express';

describe('StateController', () => {
  let controller: StateController;
  let service: jest.Mocked<StateService>;

  const mockState: State = {
    id: 1,
    name: 'Lagos',
    code: 'LAG',
    lgas: [],
    electoralOffices: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      generateTemplate: jest.fn(),
      uploadStates: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StateController],
      providers: [{ provide: StateService, useValue: mockService }],
    }).compile();

    controller = module.get<StateController>(StateController);
    service = module.get(StateService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('template endpoints', () => {
    it('downloadTemplate should set headers and return template CSV', () => {
      const mockRes = {
        set: jest.fn(),
      } as unknown as Response;

      service.generateTemplate.mockReturnValue('Name,Code\nLagos,LAG\n');
      const result = controller.downloadTemplate(mockRes);

      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'text/csv',
        'Content-Disposition':
          'attachment; filename="states_upload_template.csv"',
      });
      expect(result).toEqual('Name,Code\nLagos,LAG\n');
    });
  });

  describe('create', () => {
    it('should call service.create and return created state', async () => {
      service.create.mockResolvedValue(mockState);
      const result = await controller.create({ name: 'Lagos', code: 'LAG' });
      expect(service.create).toHaveBeenCalledWith({
        name: 'Lagos',
        code: 'LAG',
      });
      expect(result).toEqual(mockState);
    });
  });

  describe('uploadState', () => {
    it('should call service.uploadStates and return all states', async () => {
      const file = {
        originalname: 'states.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('Name,Code\nLagos,LAG\n'),
      } as Express.Multer.File;

      service.uploadStates.mockResolvedValue([mockState]);
      const result = await controller.uploadState(file);
      expect(service.uploadStates).toHaveBeenCalledWith(file);
      expect(result).toEqual([mockState]);
    });
  });

  describe('findAll', () => {
    it('should return all states', async () => {
      service.findAll.mockResolvedValue([mockState]);
      const result = await controller.findAll();
      expect(result).toEqual([mockState]);
    });
  });

  describe('findOne', () => {
    it('should return a single state', async () => {
      service.findOne.mockResolvedValue(mockState);
      const result = await controller.findOne('1');
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockState);
    });
  });

  describe('update', () => {
    it('should update and return the state for PUT', async () => {
      service.update.mockResolvedValue({ ...mockState, name: 'Lagos Updated' });
      const result = await controller.update('1', { name: 'Lagos Updated' });
      expect(service.update).toHaveBeenCalledWith(1, { name: 'Lagos Updated' });
      expect(result.name).toEqual('Lagos Updated');
    });

    it('should update and return the state for PATCH', async () => {
      service.update.mockResolvedValue({ ...mockState, name: 'Lagos Updated' });
      const result = await controller.patchUpdate('1', {
        name: 'Lagos Updated',
      });
      expect(service.update).toHaveBeenCalledWith(1, { name: 'Lagos Updated' });
      expect(result.name).toEqual('Lagos Updated');
    });
  });

  describe('remove', () => {
    it('should remove and return the deleted state', async () => {
      service.remove.mockResolvedValue(mockState);
      const result = await controller.remove('1');
      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockState);
    });
  });
});
