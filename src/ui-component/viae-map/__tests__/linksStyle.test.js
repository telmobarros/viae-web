import { linkColorFor } from '../layers/linksStyle';

describe('linkColorFor', () => {
    it('is low-alpha so it never competes visually with routes', () => {
        expect(linkColorFor('light')[3]).toBeLessThan(150);
        expect(linkColorFor('dark')[3]).toBeLessThan(150);
    });

    it('differs between themes so it stays visible on both backgrounds', () => {
        expect(linkColorFor('light')).not.toEqual(linkColorFor('dark'));
    });
});
