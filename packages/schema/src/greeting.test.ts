import { describe, it, expect } from 'vitest';
import { greeting } from './greeting';

describe('greeting', () => {
  it('returns the schema package greeting', () => {
    const result = greeting();

    expect(result).toBe('Hello from @danceroutine/tango-schema');
  });
});

