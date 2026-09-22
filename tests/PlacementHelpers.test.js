import { describe, it, expect } from 'vitest';
import { parsePlacementState, getQuadrantPlacementCSS } from '../js/utils/helpers.js';

describe('Placement Helpers Unit Tests', () => {
    it('parses legacy string "bottom" correctly', () => {
        const res = parsePlacementState('bottom');
        expect(res).toEqual({ x: 95, y: 85, isLegacy: true, legacyType: 'bottom' });
    });

    it('parses legacy string "middle" correctly', () => {
        const res = parsePlacementState('middle');
        expect(res).toEqual({ x: 95, y: 50, isLegacy: true, legacyType: 'middle' });
    });

    it('parses JSON string position {"x": 10, "y": 20}', () => {
        const res = parsePlacementState(JSON.stringify({ x: 10, y: 20 }));
        expect(res).toEqual({ x: 10, y: 20 });
    });

    it('clamps values within safety bounds 0-98%', () => {
        const res = parsePlacementState(JSON.stringify({ x: -10, y: 150 }));
        expect(res).toEqual({ x: 0, y: 98 });
    });

    it('computes quadrant CSS for bottom right position (95%, 85%)', () => {
        const quadrant = getQuadrantPlacementCSS(95, 85);
        expect(quadrant.expandDirection).toBe('up');
        expect(quadrant.alignSide).toBe('right');
        expect(quadrant.isRightHalf).toBe(true);
        expect(quadrant.isBottomHalf).toBe(true);
        expect(quadrant.style.right).toBe('5.0%');
        expect(quadrant.style.bottom).toBe('15.0%');
        expect(quadrant.style.left).toBe('auto');
        expect(quadrant.style.top).toBe('auto');
    });

    it('computes quadrant CSS for top left position (10%, 15%)', () => {
        const quadrant = getQuadrantPlacementCSS(10, 15);
        expect(quadrant.expandDirection).toBe('down');
        expect(quadrant.alignSide).toBe('left');
        expect(quadrant.isRightHalf).toBe(false);
        expect(quadrant.isBottomHalf).toBe(false);
        expect(quadrant.style.left).toBe('10.0%');
        expect(quadrant.style.top).toBe('15.0%');
        expect(quadrant.style.right).toBe('auto');
        expect(quadrant.style.bottom).toBe('auto');
    });
});
