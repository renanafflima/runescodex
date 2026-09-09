import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

jest.mock('./prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHello: () => 'Hello World!',
            getHealth: async () => ({ status: 'ok', database: 'connected' }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(AppController);
  });

  it('returns hello', () => {
    expect(controller.getHello()).toBe('Hello World!');
  });
});
