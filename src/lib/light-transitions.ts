import { LightOutput } from "./auto-lights";
import { Light } from "./lights";
import { NodeRed, NodeRedMsg, NodeRedOutput } from "./node-red";

type TransitionMsg = NodeRedMsg<LightOutput> | NodeRedMsg<boolean, "enabled">;

// Env Settings -----------------------------------
export interface LightSettings {
    brigthnessDirect: number;
    brigthnessAdjacent: number;
}

// Output Types -----------------------------------
export interface TransitionOutput {
    state: 'on' | 'off',
    brightness: number | undefined,
    transition: number
}

// Misc Types -----------------------------------
export type ContextKeys = "enabled";

// -------------------------------------------------

export function lightState(
    msg: TransitionMsg,
    context: Map<ContextKeys, any>,
    env: Map<keyof LightSettings, any>,
    node: NodeRed,
): NodeRedOutput<TransitionOutput> {
    // Main -----------------------------------
    return main();

    // Fun -----------------------------------
    function main(): NodeRedOutput<TransitionOutput> {
        if (isEnabledTopic(msg)) {
            context.set("enabled", msg.payload)
        }

        // TODO consider manual even if disabled
        if (context.get("enabled") === false) {
            return [
                undefined,
                { payload: { fill: 'grey', text: 'disabled' } }
            ]
        }

        if (!isEnabledTopic(msg)) {
            const transition = getTransition(msg.payload)
            return [
                { payload: transition },
                { payload: { fill: transition.state == 'on' ? 'green' : 'grey', text: transition.brightness ? transition.brightness + "%" : "off" } }
            ]
        }
    }

    function isEnabledTopic(msg: TransitionMsg): msg is NodeRedMsg<boolean, "enabled"> {
        return msg.topic === "enabled";
    }

    function getTransition(state: LightOutput): TransitionOutput {
        const brightness = getBrightness(state.light)
        const transition = transitionTime(state)
        return {
            state: brightness > 0 ? 'on' : 'off',
            brightness: brightness > 0 ? brightness : undefined,
            transition
        }
    }

    function getBrightness(light: Light): number {
        switch (light) {
            case Light.Direct: return env.get('brigthnessDirect')
            case Light.Adjacent: return env.get('brigthnessAdjacent')
            case Light.Off: return 0
        }
        node.error(`Unknown light state: ${light}`);
    }

    function transitionTime(state: LightOutput) {
        switch (state.reason) {
            case "Manual": return 0.4
            case "Init": return 0
            case "Entering": return state.light == Light.Direct ? 0.4 : 1
            case "Leaving": return state.light == Light.Off ? 3 : 10
            case "Luminance": return 5
        }
        node.error(`Unknown reason state: ${state.reason}`);
    }

}