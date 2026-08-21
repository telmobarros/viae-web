import { canonicalizeMetrics, groupMetrics, metricSpec } from '../model';

describe('groupMetrics: zero/false must not disappear', () => {
    // The user has repeatedly flagged this exact class of bug: a naive
    // `if (value)` check anywhere in this pipeline would make a real 0 or
    // false read as "field absent" instead of "field is zero/false".
    it('renders a numeric 0 as "0.00", not as missing', () => {
        const groups = groupMetrics({ vehicleCost: 0 });
        const item = groups.flatMap((g) => g.items).find((i) => i.key === 'vehicleCost');
        expect(item).toBeDefined();
        expect(item.display).toBe('0.00');
    });

    it('renders feasibility=false as "No", not as missing', () => {
        const groups = groupMetrics({ feasibility: false });
        const item = groups.flatMap((g) => g.items).find((i) => i.key === 'feasibility');
        expect(item).toBeDefined();
        expect(item.display).toBe('No');
    });

    it('renders an integer 0 (e.g. missedCustomers) as "0", not as missing', () => {
        const groups = groupMetrics({ missedCustomers: 0 });
        const item = groups.flatMap((g) => g.items).find((i) => i.key === 'missedCustomers');
        expect(item).toBeDefined();
        expect(item.display).toBe('0');
    });

    it('omits a key that is genuinely absent (undefined/null), which IS "no row"', () => {
        const groups = groupMetrics({ vehicleCost: undefined, profit: null });
        const keys = groups.flatMap((g) => g.items).map((i) => i.key);
        expect(keys).not.toContain('vehicleCost');
        expect(keys).not.toContain('profit');
    });
});

describe('groupMetrics: Decimal-serialized-as-string coercion', () => {
    // Confirmed directly against a real execution payload (execution 1339):
    // RouteStop numeric fields arrive as JSON strings like "0E-10" and
    // "78.1688098595", not JSON numbers, while Route/Solution fields are
    // plain floats. Regression test for the resulting display bug.
    it('renders the string "0E-10" (a Decimal repr of zero) as "0.00", not verbatim', () => {
        const groups = groupMetrics({ serviceTime: '0E-10' });
        const item = groups.flatMap((g) => g.items).find((i) => i.key === 'serviceTime');
        expect(item.display).toBe('0.00');
    });

    it('rounds a full-precision Decimal string to 2dp like a real number would be', () => {
        const groups = groupMetrics({ arrivalTime: '78.1688098595' });
        const item = groups.flatMap((g) => g.items).find((i) => i.key === 'arrivalTime');
        expect(item.display).toBe('78.17');
    });

    it('a Decimal-string zero does not trigger the violation severity styling', () => {
        const groups = groupMetrics({ timeWindowViolation: '0E-10' });
        const item = groups.flatMap((g) => g.items).find((i) => i.key === 'timeWindowViolation');
        expect(item.severity).toBeNull();
    });

    it('a genuine non-zero Decimal string DOES trigger violation severity', () => {
        const groups = groupMetrics({ timeWindowViolation: '12.5000000000' });
        const item = groups.flatMap((g) => g.items).find((i) => i.key === 'timeWindowViolation');
        expect(item.severity).toBe('error');
    });

    it('an int-formatted field given a Decimal string is parsed as a number, not left as the raw string', () => {
        // toLocaleString's separator rendering depends on the runtime's ICU
        // data (Node's default build doesn't add thousand separators the way
        // a browser does), so this checks the coercion happened -- the value
        // parses as 1000 -- rather than asserting a specific separator style.
        const groups = groupMetrics({ nVehicles: '1000' });
        const item = groups.flatMap((g) => g.items).find((i) => i.key === 'nVehicles');
        expect(item.display.replace(/,/g, '')).toBe('1000');
    });

    it('a genuinely non-numeric string (not this bug -- hypothetical) still falls back to String(v) rather than throwing', () => {
        expect(metricSpec('arrivalTime').format('not-a-number')).toBe('not-a-number');
    });
});

describe('canonicalizeMetrics', () => {
    it('does not drop zero/false values from the raw payload during canonicalization itself', () => {
        const out = canonicalizeMetrics({ vehicle_cost: 0, feasibility: false }, true);
        expect(out.vehicleCost).toBe(0);
        expect(out.feasibility).toBe(false);
    });

    it('passes Decimal-string values through untouched -- coercion happens at format time, not canonicalization time', () => {
        const out = canonicalizeMetrics({ service_time: '0E-10' }, true);
        expect(out.serviceTime).toBe('0E-10');
    });
});
