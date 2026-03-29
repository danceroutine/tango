import { describe, expect, it } from 'vitest';
import { generateViewSet } from '../generateViewSet';

describe(generateViewSet, () => {
    it('generates a model-first viewset class', () => {
        const view = generateViewSet('User');

        expect(view).toContain('export class UserViewSet');
        expect(view).toContain("import { UserSerializer } from './serializers'");
        expect(view).toContain('serializer: UserSerializer');
        expect(view).toContain("orderingFields: ['id']");
        expect(view).toContain('FilterSet.define');
    });
});
