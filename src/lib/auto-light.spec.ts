import { ButtonMsg, ContextKeys, LightInput, LightSettings, lightState, LightOutput } from "./auto-lights";
import { Light } from "./lights";
import { DummyNodeRed, NodeRed } from "./node-red";

const dark = 0;
const light = 20;
const threshold = 10;

jest.useFakeTimers()

describe('light state: Off', () => {
    test('should be in state Direct if direct occupancy and dark', () => {
        const state = setupState(Light.Off, { directOccupancy: true, adjacentOccupancy: false, luminance: dark });
        expect(state).toEqual({ light: Light.Direct, reason: "Entering" });
    });

    test('should be in state Direct if direct && adjecent occupancy and dark', () => {
        const state = setupState(Light.Off, { directOccupancy: true, adjacentOccupancy: true, luminance: dark });
        expect(state).toEqual({ light: Light.Direct, reason: "Entering" });
    });

    test('should be in state Adjecent if direct && adjecent occupancy and dark', () => {
        const state = setupState(Light.Off, { directOccupancy: false, adjacentOccupancy: true, luminance: dark });
        expect(state).toEqual({ light: Light.Adjacent, reason: "Entering" });
    });

    test('should be direct if direct occupancy and getting dark', () => {
        const state = setupState(Light.Off, { directOccupancy: true, adjacentOccupancy: false, luminance: dark }, defaultSettings, light);
        expect(state).toEqual({ light: Light.Direct, reason: "Luminance" });
    });

    test('should be adjecent if adjecent occupancy and getting dark', () => {
        const state = setupState(Light.Off, { directOccupancy: false, adjacentOccupancy: true, luminance: dark }, defaultSettings, light);
        expect(state).toEqual({ light: Light.Adjacent, reason: "Luminance" });
    });

    test('should be undefined if direct occupancy and light', () => {
        const state = setupState(Light.Off, { directOccupancy: true, adjacentOccupancy: true, luminance: light });
        expect(state).toEqual(undefined);
    });
});

describe('light state: Adjacent', () => {
    test('should be in state Direct if direct occupancy and dark', () => {
        const state = setupState(Light.Adjacent, { directOccupancy: true, adjacentOccupancy: true, luminance: dark });
        expect(state).toEqual({ light: Light.Direct, reason: "Entering" });
    });

    test('should be in state Off neither direct && adjecent occupancy and dark', () => {
        const state = setupState(Light.Adjacent, { directOccupancy: false, adjacentOccupancy: false, luminance: dark });
        expect(state).toEqual({ light: Light.Off, reason: "Leaving" });
    });

    test('should still be in state Adjacent if adjecent occupancy and getting lighter', () => {
        const state = setupState(Light.Adjacent, { directOccupancy: false, adjacentOccupancy: true, luminance: dark + threshold * 1.1 });
        expect(state).toEqual(undefined);
    });

    test('should be Off if adjecent occupancy and way lighter', () => {
        const state = setupState(Light.Adjacent, { directOccupancy: false, adjacentOccupancy: true, luminance: light });
        expect(state).toEqual({ light: Light.Off, reason: "Luminance" });
    });

    test('should be undefined if adjecant occupancy and dark', () => {
        const state = setupState(Light.Adjacent, { directOccupancy: false, adjacentOccupancy: true, luminance: dark });
        expect(state).toEqual(undefined);
    });
});

describe('light state: Direct', () => {
    test('should stay in state Direct if direct occupancy and dark', () => {
        const state = setupState(Light.Direct, { directOccupancy: true, adjacentOccupancy: true, luminance: dark });
        expect(state).toEqual(undefined);
    });

    test('should be in state Off neither direct && adjecent occupancy and dark', () => {
        const state = setupState(Light.Direct, { directOccupancy: false, adjacentOccupancy: false, luminance: dark });
        expect(state).toEqual({ light: Light.Off, reason: "Leaving" });
    });

    test('should be in state Adjacent if adjecent occupancy and dark', () => {
        const state = setupState(Light.Direct, { directOccupancy: false, adjacentOccupancy: true, luminance: dark });
        expect(state).toEqual({ light: Light.Adjacent, reason: "Leaving" });
    });

    test('should still be in state Direct if adjecent occupancy and getting lighter', () => {
        const state = setupState(Light.Direct, { directOccupancy: true, adjacentOccupancy: true, luminance: dark + threshold * 1.1 });
        expect(state).toEqual(undefined);
    });

    test('should be Off if direct occupancy and way lighter', () => {
        const state = setupState(Light.Direct, { directOccupancy: true, adjacentOccupancy: true, luminance: light });
        expect(state).toEqual({ light: Light.Off, reason: "Luminance" });
    });

    test('should still be Direct if only adjecent occupancy but keepInDirect is true', () => {
        const state = setupState(
            Light.Direct,
            { directOccupancy: false, adjacentOccupancy: true, luminance: dark },
            { ...defaultSettings, keepInDirect: true }
        );
        expect(state).toEqual(undefined);
    });
});

describe('Manual', () => {
    test('should toggle light on', () => {
        const node = new DummyNodeRed();
        const state = setupState(Light.Off, { new_state: { attributes: { event_type: "single_push" } } }, defaultSettings, undefined, node);
        expect(state).toEqual({ light: Light.Direct, reason: "Manual" });
    });

    test('should toggle light off', () => {
        const node = new DummyNodeRed();
        const state = setupState(Light.Adjacent, { new_state: { attributes: { event_type: "single_push" } } }, defaultSettings, undefined, node);
        expect(state).toEqual({ light: Light.Off, reason: "Manual" });
        jest.runOnlyPendingTimers();
        expect(node.lastEmit?.[0]).toEqual(undefined);
    });

    test('should toggle light off', () => {
        const node = new DummyNodeRed();
        const state = setupState(Light.Direct, { new_state: { attributes: { event_type: "single_push" } } }, defaultSettings, undefined, node);
        expect(state).toEqual({ light: Light.Off, reason: "Manual" });
        jest.runOnlyPendingTimers();
        expect(node.lastEmit?.[0]).toEqual(undefined);
    });

    test('should return to automatic (manual on) after 20 minutes of no occupancy', () => {
        const node = new DummyNodeRed();
        const env = new Map(Object.entries(defaultSettings)) as any;

        const context = new Map<ContextKeys, any>();
        const prevLightState: LightOutput = { light: Light.Off, reason: "Init" };
        context.set("prevState", prevLightState);
        const prevMsg: LightInput = { luminance: 0, directOccupancy: false, adjacentOccupancy: false };
        context.set("prevMsg", prevMsg);

        const state = lightState(
            { payload: { new_state: { attributes: { event_type: "single_push" } } } },
            context,
            env,
            node,
        )
        expect(state?.[0]?.payload).toEqual({ light: Light.Direct, reason: "Manual" });

        jest.advanceTimersByTime(19 * 60 * 1000);
        expect(node.lastEmit?.[0]).toEqual(undefined);

        jest.advanceTimersByTime(60 * 1000);
        expect(node.lastEmit?.[0]?.payload).toEqual({ light: Light.Off, reason: "Leaving" });
    });

    test('should not return to automatic (manual on) if occupancy occurs within 20 minutes', () => {
        const node = new DummyNodeRed();
        const env = new Map(Object.entries(defaultSettings)) as any;

        const context = new Map<ContextKeys, any>();
        const prevLightState: LightOutput = { light: Light.Off, reason: "Init" };
        context.set("prevState", prevLightState);
        const prevMsg: LightInput = { luminance: 0, directOccupancy: false, adjacentOccupancy: false };
        context.set("prevMsg", prevMsg);

        const state = lightState(
            { payload: { new_state: { attributes: { event_type: "single_push" } } } },
            context,
            env,
            node,
        )
        expect(state?.[0]?.payload).toEqual({ light: Light.Direct, reason: "Manual" });

        // After 10 minutes, occupancy occurs -> should postpone the auto return
        jest.advanceTimersByTime(10 * 60 * 1000);
        lightState(
            { payload: { luminance: 0, directOccupancy: true, adjacentOccupancy: false } },
            context,
            env,
            node,
        );
        expect(node.lastEmit?.[0]).toEqual(undefined);

        // 15 more minutes from start (total 25) but only 15 since last occupancy -> still no auto return
        jest.advanceTimersByTime(15 * 60 * 1000);
        expect(node.lastEmit?.[0]).toEqual(undefined);

        // Occupancy ends -> start new 20-minute window
        lightState(
            { payload: { luminance: 0, directOccupancy: false, adjacentOccupancy: false } },
            context,
            env,
            node,
        );

        jest.advanceTimersByTime(20 * 60 * 1000);
        expect(node.lastEmit?.[0]?.payload).toEqual({ light: Light.Off, reason: "Leaving" });
    });

    test('should return to automatic (manual off) after 3 minutes of no occupancy (verified by next sensor input)', () => {
        const node = new DummyNodeRed();
        const env = new Map(Object.entries(defaultSettings)) as any;

        const context = new Map<ContextKeys, any>();
        const prevLightState: LightOutput = { light: Light.Direct, reason: "Init" };
        context.set("prevState", prevLightState);
        const prevMsg: LightInput = { luminance: 0, directOccupancy: false, adjacentOccupancy: false };
        context.set("prevMsg", prevMsg);

        const state = lightState(
            { payload: { new_state: { attributes: { event_type: "single_push" } } } },
            context,
            env,
            node,
        )
        expect(state?.[0]?.payload).toEqual({ light: Light.Off, reason: "Manual" });

        // Wait full 3 minutes (no status tested)
        jest.advanceTimersByTime(3 * 60 * 1000);

        // Next sensor input should now be processed automatically -> expect Direct on (dark + occupancy)
        const out = lightState(
            { payload: { luminance: 0, directOccupancy: true, adjacentOccupancy: false } },
            context,
            env,
            node,
        );
        expect(out?.[0]?.payload).toEqual({ light: Light.Direct, reason: "Entering" });
    });

    test('should not return to automatic (manual off) if occupancy occurs within 3 minutes', () => {
        const node = new DummyNodeRed();
        const env = new Map(Object.entries(defaultSettings)) as any;

        const context = new Map<ContextKeys, any>();
        const prevLightState: LightOutput = { light: Light.Direct, reason: "Init" };
        context.set("prevState", prevLightState);
        const prevMsg: LightInput = { luminance: 0, directOccupancy: false, adjacentOccupancy: false };
        context.set("prevMsg", prevMsg);

        const state = lightState(
            { payload: { new_state: { attributes: { event_type: "single_push" } } } },
            context,
            env,
            node,
        )
        expect(state?.[0]?.payload).toEqual({ light: Light.Off, reason: "Manual" });

        // After 2 minutes, occupancy occurs -> should postpone the auto return
        jest.advanceTimersByTime(2 * 60 * 1000);
        lightState(
            { payload: { luminance: 0, directOccupancy: true, adjacentOccupancy: false } },
            context,
            env,
            node,
        );

        // Even after another 2 minutes (total 4), still manual mode -> sensor input should be ignored (no state change)
        jest.advanceTimersByTime(2 * 60 * 1000);
        const ignored = lightState(
            { payload: { luminance: 0, directOccupancy: true, adjacentOccupancy: false } },
            context,
            env,
            node,
        );
        expect(ignored).toEqual(undefined);

        // Occupancy ends -> start new 3-minute window
        lightState(
            { payload: { luminance: 0, directOccupancy: false, adjacentOccupancy: false } },
            context,
            env,
            node,
        );

        // After 3 minutes more, next sensor input should be processed automatically -> expect Direct on
        jest.advanceTimersByTime(3 * 60 * 1000);
        const out2 = lightState(
            { payload: { luminance: 0, directOccupancy: true, adjacentOccupancy: false } },
            context,
            env,
            node,
        );
        expect(out2?.[0]?.payload).toEqual({ light: Light.Direct, reason: "Entering" });
    });

    test('should ignore input changes in manual mode', () => {
        const node = new DummyNodeRed();
        const env = new Map(Object.entries(defaultSettings)) as any;

        const context = new Map<ContextKeys, any>();
        const prevLightState: LightOutput = { light: Light.Off, reason: "Manual" };
        context.set("prevState", prevLightState);
        const prevMsg: LightInput = { luminance: 0, directOccupancy: false, adjacentOccupancy: false };
        context.set("prevMsg", prevMsg);

        const state = lightState(
            { payload: { luminance: 0, directOccupancy: true, adjacentOccupancy: false } },
            context,
            env,
            node,
        )
        expect(state?.[0]?.payload).toEqual(undefined);
        jest.runOnlyPendingTimers();
        expect(node.lastEmit?.[0].payload).toEqual(undefined);
    });
})


const defaultSettings: LightSettings = {
    luminanceDirectThreshold: threshold,
    luminanceAdjacentThreshold: threshold,
    hysteresis: 1.2,
    keepInDirect: false,
};

function setupState(currState: Light, input: LightInput | ButtonMsg, settings: LightSettings = defaultSettings, prevLuminance: number | undefined = undefined, node: NodeRed = new DummyNodeRed()): LightOutput | undefined {
    const context = new Map<ContextKeys, any>();
    const env = new Map(Object.entries(settings)) as any;
    if (typeof currState === "string") {
        const prevLightState: LightOutput = { light: currState, reason: "Init" };
        context.set("prevState", prevLightState);
    } else {
        context.set("prevState", currState);
    }

    if (prevLuminance !== undefined) {
        context.set("prevMsg", { luminance: prevLuminance });
    }


    const result = lightState(
        { payload: input },
        context,
        env,
        node,
    )
    const state = result?.[0]?.payload
    return state
}
