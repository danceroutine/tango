<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

let nextDiagramId = 0;
let mermaidInstancePromise: Promise<(typeof import('mermaid'))['default']> | undefined;
let renderQueue: Promise<void> = Promise.resolve();

function getMermaid(): Promise<(typeof import('mermaid'))['default']> {
    if (!mermaidInstancePromise) {
        mermaidInstancePromise = import('mermaid').then(({ default: mermaid }) => mermaid);
    }

    return mermaidInstancePromise;
}

function isDarkMode(): boolean {
    return document.documentElement.classList.contains('dark');
}

function buildMermaidConfig(darkMode: boolean) {
    const palette = darkMode
        ? {
              background: '#1f0d12',
              surface: '#2c1218',
              surfaceAlt: '#3a151d',
              text: '#ffdbe8',
              textMuted: '#f2b6cb',
              border: '#f9b4ca',
          }
        : {
              background: '#fff9fb',
              surface: '#fde7ee',
              surfaceAlt: '#f8d7e2',
              text: '#2e1117',
              textMuted: '#5b2732',
              border: '#b23a48',
          };

    return {
        startOnLoad: false,
        theme: 'base' as const,
        securityLevel: 'loose' as const,
        themeVariables: {
            background: palette.background,
            primaryColor: palette.surface,
            primaryBorderColor: palette.border,
            primaryTextColor: palette.text,
            secondaryColor: palette.surfaceAlt,
            secondaryBorderColor: palette.border,
            secondaryTextColor: palette.text,
            tertiaryColor: palette.surface,
            tertiaryBorderColor: palette.border,
            tertiaryTextColor: palette.text,
            lineColor: palette.textMuted,
            textColor: palette.text,
            mainBkg: palette.surface,
            secondBkg: palette.surfaceAlt,
            tertiaryBkg: palette.surface,
            actorBkg: palette.surface,
            actorBorder: palette.border,
            actorTextColor: palette.text,
            actorLineColor: palette.textMuted,
            signalColor: palette.textMuted,
            signalTextColor: palette.text,
            labelBoxBkgColor: palette.surfaceAlt,
            labelBoxBorderColor: palette.border,
            labelTextColor: palette.text,
            loopTextColor: palette.text,
            noteBkgColor: palette.surface,
            noteBorderColor: palette.border,
            noteTextColor: palette.text,
            activationBorderColor: palette.border,
            activationBkgColor: palette.surfaceAlt,
            sequenceNumberColor: palette.text,
        },
    };
}

const props = defineProps<{
    chart?: string;
    diagramId?: string;
    semanticPalette?: 'relation-seam';
}>();

const container = ref<HTMLElement | null>(null);
const source = ref<HTMLElement | null>(null);
const resolvedDiagramId = props.diagramId ?? `tango-mermaid-${++nextDiagramId}`;
let themeObserver: MutationObserver | undefined;
let lastDarkMode = false;

function getCssVariable(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildSemanticClassDefs(): string[] {
    if (props.semanticPalette !== 'relation-seam') {
        return [];
    }

    return [
        `classDef appFacing fill:${getCssVariable('--tango-mermaid-app-fill')},stroke:${getCssVariable('--tango-mermaid-app-stroke')},color:${getCssVariable('--tango-mermaid-app-text')},stroke-width:2px`,
        `classDef authoring fill:${getCssVariable('--tango-mermaid-author-fill')},stroke:${getCssVariable('--tango-mermaid-author-stroke')},color:${getCssVariable('--tango-mermaid-author-text')},stroke-width:2px`,
        `classDef artifact fill:${getCssVariable('--tango-mermaid-artifact-fill')},stroke:${getCssVariable('--tango-mermaid-artifact-stroke')},color:${getCssVariable('--tango-mermaid-artifact-text')},stroke-width:2px`,
        `classDef unresolved fill:${getCssVariable('--tango-mermaid-warning-fill')},stroke:${getCssVariable('--tango-mermaid-warning-stroke')},color:${getCssVariable('--tango-mermaid-warning-text')},stroke-width:2px`,
    ];
}

async function renderDiagram(): Promise<void> {
    await nextTick();

    const baseSourceText = props.chart?.trim() ?? source.value?.textContent?.trim();
    const sourceText = [baseSourceText, ...buildSemanticClassDefs()].filter(Boolean).join('\n');
    if (!container.value || !sourceText) {
        return;
    }

    const target = container.value;
    const darkMode = isDarkMode();
    lastDarkMode = darkMode;

    renderQueue = renderQueue.then(async () => {
        const mermaid = await getMermaid();
        mermaid.initialize(buildMermaidConfig(darkMode));
        const { svg } = await mermaid.render(resolvedDiagramId, sourceText);

        if (container.value === target) {
            target.innerHTML = svg;
        }
    });

    await renderQueue;
}

onMounted(() => {
    void renderDiagram();

    themeObserver = new MutationObserver(() => {
        const darkMode = isDarkMode();
        if (darkMode !== lastDarkMode) {
            void renderDiagram();
        }
    });

    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
    });
});

onBeforeUnmount(() => {
    themeObserver?.disconnect();
});
</script>

<template>
    <div class="mermaid-diagram">
        <div v-if="!chart" ref="source" style="display: none">
            <slot />
        </div>
        <div ref="container" />
    </div>
</template>
