import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class AppShellTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'app/app.vue' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `<template>
    <NuxtPage />
</template>
`;
    }
}
