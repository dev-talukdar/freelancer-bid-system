import { describe, expect, it } from 'vitest'; import { searchProfileSchema } from './index.js';
describe('search profile validation',()=>{ it('enforces minimum poll interval',()=>{ expect(()=>searchProfileSchema.parse({name:'x',pollIntervalSeconds:5})).toThrow(); }); });
