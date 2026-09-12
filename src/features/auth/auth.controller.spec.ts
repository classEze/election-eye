import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './auth.dto';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signIn: jest.fn(),
            adminSignIn: jest.fn(),
            requestPasswordResetToken: jest.fn(),
            requestAdminPasswordResetToken: jest.fn(),
            requestPasswordReset: jest.fn(),
            requestAdminPasswordReset: jest.fn(),
            verifyUserEmail: jest.fn(),
            verifyAdminEmail: jest.fn(),
            resendUserVerification: jest.fn(),
            resendAdminVerification: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should validate login payloads using LoginDto', async () => {
    const invalidDto = plainToInstance(LoginDto, {
      emailAddress: 'not-an-email',
      password: 'short',
    });

    const errors = await validate(invalidDto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
