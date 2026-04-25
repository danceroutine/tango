import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class PageTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'app/pages/index.server.vue' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `<script setup lang="ts">
import { TodoModel, TodoReadSchema } from '~~/lib/models';

const todos = await TodoModel.objects.query().orderBy('-createdAt').limit(10).fetch(TodoReadSchema);
</script>

<template>
    <main style="font-family: system-ui; margin: 2rem auto; max-width: 60ch;">
        <h1>Tango + Nuxt</h1>
        <p>Showing {{ todos.length }} todos through Tango's runtime-backed model manager.</p>
        <ul>
            <li v-for="todo in todos" :key="todo.id">{{ todo.title }}</li>
        </ul>
    </main>
</template>
`;
    }
}
