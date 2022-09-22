import { handler } from './get-by-name';

describe('get-by-name unit test', () => {
   test('handler', async () => {
      expect(await handler({} as any)).toStrictEqual({ body: 'g' });
   });
});
