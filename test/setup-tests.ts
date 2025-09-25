import { ConsoleLogger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { modifyApp } from '../src/main';

export const getAppForTesting = async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  return modifyApp(
    moduleFixture.createNestApplication({
      logger: new ConsoleLogger({ prefix: 'E2E Test' }),
    }),
  );
};

beforeAll(() => {
  if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'test';
  }
});
