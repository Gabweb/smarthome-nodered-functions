import { DummyNodeRed, NodeRed } from "./node-red";
import { ContextKeys, LightSettings, lightTransition, TransitionMsg, TransitionOutput } from "./light-transitions";
import { LightOutput } from "./auto-lights";
import { Light } from "./lights";

const defaultSettings: LightSettings = {
    brigthnessDirect: 100,
    brigthnessAdjacent: 50,
};


const results: [LightOutput, boolean, Partial<TransitionOutput> | undefined][] = [
    [{ light: Light.Off, reason: 'Init' }, true, { state: 'off' }],
    [{ light: Light.Adjacent, reason: 'Entering' }, true, { state: 'on', brightness: 50 }],
    [{ light: Light.Direct, reason: 'Entering' }, true, { state: 'on', brightness: 100 }],
    // Disabled
    [{ light: Light.Off, reason: 'Init' }, false, undefined],
    [{ light: Light.Adjacent, reason: 'Entering' }, false, undefined],
    [{ light: Light.Direct, reason: 'Entering' }, false, undefined],
    // Manual
    [{ light: Light.Off, reason: 'Manual' }, true, { state: 'off' }],
    [{ light: Light.Adjacent, reason: 'Manual' }, true, { state: 'on', brightness: 50 }],
    [{ light: Light.Direct, reason: 'Manual' }, true, { state: 'on', brightness: 100 }],
    [{ light: Light.Off, reason: 'Manual' }, false, { state: 'off' }],
    [{ light: Light.Adjacent, reason: 'Manual' }, false, { state: 'on', brightness: 50 }],
    [{ light: Light.Direct, reason: 'Manual' }, false, { state: 'on', brightness: 100 }],
]

describe('emsAvailEnergy results', () => {
    test.each(results)(
        'should return %p for input %p',
        (input, enabled, expected) => {
            const state = setupState(input, enabled, defaultSettings);
            if (expected === undefined) {
                expect(state).toBeUndefined();
            } else {
                expect(state).toMatchObject(expected);
            }
        }
    );

    test('should return last state if enabled', () => {
        const context = new Map<ContextKeys, any>();
        context.set("enabled", false);
        const prevState: LightOutput = { light: Light.Direct, reason: 'Entering' }
        context.set("prevState", prevState);
        const env = new Map<keyof LightSettings, any>();
        env.set("brigthnessAdjacent", defaultSettings.brigthnessAdjacent);
        env.set("brigthnessDirect", defaultSettings.brigthnessDirect);

        const state = lightTransition(
            { payload: true, topic: "enabled" },
            context,
            env,
            new DummyNodeRed(),
        )?.[0]?.payload;

        expect(state).toMatchObject({ state: 'on', brightness: 100 });
    })
});

function setupState(input: LightOutput, enabled: boolean, settings: LightSettings): TransitionOutput | undefined {
    const context = new Map<ContextKeys, any>();
    context.set("enabled", enabled);
    const env = new Map<keyof LightSettings, any>();
    env.set("brigthnessAdjacent", settings.brigthnessAdjacent);
    env.set("brigthnessDirect", settings.brigthnessDirect);
    return lightTransition(
        { payload: input },
        context,
        env,
        new DummyNodeRed(),
    )?.[0]?.payload;
}
