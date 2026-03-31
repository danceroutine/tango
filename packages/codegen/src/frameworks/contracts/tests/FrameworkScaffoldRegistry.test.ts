import { describe, expect, it } from 'vitest';
import { FrameworkScaffoldRegistry } from '../../registry/FrameworkScaffoldRegistry';
import { ExpressScaffoldStrategy } from '../../strategies/express/ExpressScaffoldStrategy';
import { NextScaffoldStrategy } from '../../strategies/next/NextScaffoldStrategy';
import { NuxtScaffoldStrategy } from '../../strategies/nuxt/NuxtScaffoldStrategy';

describe(FrameworkScaffoldRegistry, () => {
    it('returns the registered framework strategies in insertion order', () => {
        const registry = new FrameworkScaffoldRegistry();
        const express = new ExpressScaffoldStrategy();
        const next = new NextScaffoldStrategy();
        const nuxt = new NuxtScaffoldStrategy();

        registry.register(express);
        registry.register(next);
        registry.register(nuxt);

        expect(registry.get('express')).toBe(express);
        expect(registry.get('next')).toBe(next);
        expect(registry.get('nuxt')).toBe(nuxt);
        expect(registry.list().map((item) => item.id)).toEqual(['express', 'next', 'nuxt']);
    });

    it('throws on duplicate registration', () => {
        const registry = new FrameworkScaffoldRegistry();
        registry.register(new ExpressScaffoldStrategy());

        expect(() => registry.register(new ExpressScaffoldStrategy())).toThrow(
            "Framework scaffold strategy 'express' is already registered."
        );
    });
});
