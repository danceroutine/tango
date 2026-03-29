import { describe, expect, it } from 'vitest';
import * as codegen from '../index';
import * as generators from '../generators/index';
import * as migration from '../generators/migration/index';
import * as model from '../generators/model/index';
import * as viewset from '../generators/viewset/index';
import * as mappers from '../mappers/index';
import * as commands from '../commands/index';

describe('codegen exports', () => {
    it('exposes the public codegen API surface', () => {
        expect(typeof codegen.generateMigrationFromModels).toBe('function');
        expect(typeof codegen.generateModelInterface).toBe('function');
        expect(typeof codegen.generateViewSet).toBe('function');
        expect(typeof generators.migration.generateMigrationFromModels).toBe('function');
        expect(typeof generators.model.generateModelInterface).toBe('function');
        expect(typeof generators.viewset.generateViewSet).toBe('function');
        expect(typeof migration.generateMigrationFromModels).toBe('function');
        expect(typeof model.generateModelInterface).toBe('function');
        expect(typeof viewset.generateViewSet).toBe('function');
        expect(typeof mappers.mapFieldTypeToTS).toBe('function');
        expect(typeof mappers.normalizeFields).toBe('function');
        expect(typeof commands.registerCodegenCommands).toBe('function');
    });
});
