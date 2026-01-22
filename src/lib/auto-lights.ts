import { Light } from "./lights";
import { NodeRed, NodeRedMsg, NodeRedOutput } from "./node-red";

/**
 * Context and requirements summary
 * Purpose: Node-RED function for occupancy-based automatic lights. Computes LightOutput states (Direct, Adjacent, Off) based on luminance and occupancy; integrates with a separate transition module.
 * Inputs:
 * Sensor messages: LightInput { directOccupancy?, adjacentOccupancy?, luminance? }
 * Button messages: ButtonMsg with event_type (single_push used)
 * Behavior:
 * Automatic mode: stateMachine decides transitions (Entering, Leaving, Luminance) using thresholds and hysteresis.
 * Manual mode: triggered by single_push; toggles light between Direct and Off (reason: Manual).
 * While Manual, sensor messages only update prevMsg and manage a manual auto-return timer; they do not change the light state.
 * Return to automatic is occupancy-aware using direct OR adjacent occupancy:
 * Manual ON (Direct): 20 minutes of continuous no occupancy
 * Manual OFF (Off): 3 minutes of continuous no occupancy
 * If occupancy occurs, timer is cleared; when occupancy ends, a new full-duration timer is armed.
 * Upon timer completion:
 * If stateMachine yields a state change: send wrapOutput(newState)
 * If no change: send a status-only message using wrapOutput(undefined, statusOnly) where statusOnly has reason "Leaving" and the current light.
 * Outputs:
 * Primary: { payload: LightOutput } when state changes
 * Secondary: { payload: { fill, text } } for debug/status (also used standalone when only status is emitted)
 */

// NodeRed Msg -----------------------------------
export type LightStateMsg = NodeRedMsg<LightInput | ButtonMsg>

// Inputs provided by NodeRed into the Flow. 
export interface LightInput {
    directOccupancy?: boolean;
    adjacentOccupancy?: boolean;
    luminance?: number;
}

// Represents a button press from HomeAssistant
export interface ButtonMsg {
    new_state: {
        attributes: {
            event_type: "btn_down" | "btn_up" | "single_push" | "double_push" | "long_push" | "triple_push";
        }
    }
}

// Env Settings -----------------------------------
export interface LightSettings {
    luminanceDirectThreshold: number;
    luminanceAdjacentThreshold: number;
    hysteresis: number;
    keepInDirect: boolean;
}

// Output Types -----------------------------------
export interface LightOutput {
    light: Light;
    reason: "Entering" | "Leaving" | "Luminance" | "Manual" | "Init";
}

// Misc Types -----------------------------------
export type ContextKeys = "prevMsg" | "prevState" | "timoeut";

// Shared
function stateToFill(output: LightOutput) {
    switch (output.light) {
        case Light.Direct: return "green"
        case Light.Adjacent: return "yellow"
        case Light.Off: return "red"
    }
}

function wrapOutput(output: LightOutput | undefined, statusFor?: LightOutput): NodeRedOutput<LightOutput> {
    if (output) {
        return [
            {
                payload: output
            },
            {
                payload: { fill: stateToFill(output), text: output.light + " (" + output.reason + ")" },
            }
        ];
    }

    if (!statusFor) {
        return undefined;
    }

    return [
        undefined,
        {
            payload: { fill: stateToFill(statusFor), text: statusFor.light + " (" + statusFor.reason + ")" },
        }
    ];
}


// On Start ---------------------------------
function onStart(node: NodeRed) {
    node.send(wrapOutput({ light: Light.Off, reason: "Init" }));
}

// On Msg -----------------------------------
export function lightState(
    msg: LightStateMsg,
    context: Map<ContextKeys, any>,
    env: Map<keyof LightSettings, any>,
    node: NodeRed,
): NodeRedOutput<LightOutput> {
    // Hard-coded durations (structured for future configurability)
    const MANUAL_ON_NO_OCCUPANCY_MS = 20 * 60 * 1000; // 20 minutes
    const MANUAL_OFF_NO_OCCUPANCY_MS = 3 * 60 * 1000; // 3 minutes

    // Main -----------------------------------
    return main();

    // Fun -----------------------------------
    function main() {
        const currMsg = msg.payload
        const prevMsg: LightInput | undefined = getPrevMsg();
        const prevState: LightOutput = getPrevStateOrDefault();

        if (!isButtonPress(currMsg)) {
            context.set("prevMsg", currMsg);
        }

        let newState: LightOutput | undefined;

        if (isButtonPress(currMsg)) {
            if (isSinglePush(currMsg)) {
                newState = {
                    light: prevState.light == Light.Off ? Light.Direct : Light.Off,
                    reason: "Manual"
                };

                // Enter manual mode and schedule/reset manual auto-return based on occupancy
                scheduleManualAutoReturnIfNeeded(newState);
            }
        } else if (prevState.reason === "Manual") {
            // In manual mode: manage timer based on current occupancy, do not change light state
            scheduleManualAutoReturnIfNeeded();
        } else {
            newState = stateMachine(prevMsg, currMsg, prevState);
        }

        if (newState && newState.light != prevState.light) {
            context.set("prevState", newState)
            return wrapOutput(newState);
        }
    }

    function scheduleManualAutoReturnIfNeeded(manualState?: LightOutput) {
        const lastInput = getPrevMsgOrDefault();
        const occupancy = occupancyPresent(lastInput);
        const currentState = manualState ?? getPrevStateOrDefault();

        // Clear any pending timer first
        clearTimeout(context.get("timoeut"));

        if (currentState.reason !== "Manual") {
            return;
        }

        if (occupancy) {
            // Occupancy present -> do not arm timer
            return;
        }

        const duration = currentState.light === Light.Off ? MANUAL_OFF_NO_OCCUPANCY_MS : MANUAL_ON_NO_OCCUPANCY_MS;
        const timeout = setTimeout(() => {
            const latest = getPrevMsgOrDefault();
            if (occupancyPresent(latest)) {
                // Occupancy resumed -> re-arm full duration from now
                scheduleManualAutoReturnIfNeeded();
                return;
            }
            // No occupancy for full duration -> exit manual and return to automatic
            returnToAutomatic();
        }, duration);

        context.set("timoeut", timeout);
    }

    function returnToAutomatic() {
        const newOutput = stateMachine(getPrevMsg(), getPrevMsgOrDefault(), getPrevStateOrDefault());
        if (!newOutput) {
            // Exit manual without state change -> emit status-only message and update prevState reason
            const current = getPrevStateOrDefault();
            const statusOnly: LightOutput = { light: current.light, reason: "Leaving" };
            context.set("prevState", statusOnly);
            node.send(wrapOutput(undefined, statusOnly));
        } else {
            context.set("prevState", newOutput)
            node.send(wrapOutput(newOutput));
        }
    }

    function occupancyPresent(input: LightInput): boolean {
        return (input.directOccupancy ?? false) || (input.adjacentOccupancy ?? false);
    }

    function getPrevMsg(): LightInput | undefined {
        return context.get("prevMsg");
    }

    function getPrevMsgOrDefault(): LightInput {
        const prevMsg = context.get("prevMsg") ?? { luminance: 0, directOccupancy: false, adjacentOccupancy: false }
        if (!context.get("prevMsg")) {
            node.error("No previous message found.");
        }
        return prevMsg;
    }

    function getPrevStateOrDefault(): LightOutput {
        const prevState = context.get("prevState") ?? { light: Light.Off, reason: "Init" }
        if (!context.get("prevMsg")) {
            node.error("No previous message found.");
        }
        return prevState;
    }

    function stateMachine(prevInput: LightInput | undefined, currInput: LightInput, prevState: LightOutput): LightOutput | undefined {
        // Context
        const directOccupancy = currInput.directOccupancy ?? false;
        const adjacentOccupancy = (currInput.adjacentOccupancy ?? false) || directOccupancy;
        const luminance = currInput.luminance ?? 0;

        // Env
        const directThreshold: number = env.get("luminanceDirectThreshold")
        const envLuminanceAdjacentThreshold: number = env.get("luminanceAdjacentThreshold")
        const adjacentThreshold = (envLuminanceAdjacentThreshold == -1 ? directThreshold : envLuminanceAdjacentThreshold)
        const envKeepInDirect: boolean = env.get("keepInDirect") ?? false;
        const luminanceHysteresis: number = env.get("hysteresis") ?? 1.2;

        const lumBelowDirect = directThreshold > luminance
        const lumBelowDirectHysteresis = luminanceHysteresis * directThreshold > luminance
        const lumBelowAdjacent = adjacentThreshold > luminance
        const lumBelowAdjacentHysteresis = luminanceHysteresis * adjacentThreshold > luminance

        const isDirect = directOccupancy && lumBelowDirect;
        const isAdjacent = adjacentOccupancy && lumBelowAdjacent;

        if (prevState.light == Light.Direct) {
            if (!directOccupancy) {
                if (envKeepInDirect && adjacentOccupancy) {
                    // Do nothing, keep in direct
                } else if (!adjacentOccupancy) {
                    return { light: Light.Off, reason: "Leaving" };
                } else if (isAdjacent) {
                    return { light: Light.Adjacent, reason: "Leaving" };
                }
            }

            if (!lumBelowDirectHysteresis) {
                return { light: Light.Off, reason: "Luminance" };
            }

            return undefined
        }

        if (prevState.light == Light.Adjacent) {
            if (isDirect) {
                return { light: Light.Direct, reason: "Entering" };
            }

            if (!adjacentOccupancy) {
                return { light: Light.Off, reason: "Leaving" };
            }
            if (!lumBelowAdjacentHysteresis) {
                return { light: Light.Off, reason: "Luminance" };
            }

            return undefined
        }

        if (prevState.light == Light.Off) {
            const currLum = prevInput?.luminance ?? 0;
            if (isDirect) {
                return {
                    light: Light.Direct,
                    reason: directThreshold > currLum ? "Entering" : "Luminance"
                };
            }

            if (isAdjacent) {
                return {
                    light: Light.Adjacent,
                    reason: adjacentThreshold > currLum ? "Entering" : "Luminance"
                };
            }

            return undefined
        }
    }

    function isButtonPress(input: LightInput | ButtonMsg): input is ButtonMsg {
        return (input as ButtonMsg).new_state !== undefined;
    }

    function isSinglePush(input: ButtonMsg): boolean {
        return input.new_state.attributes.event_type === "single_push"
    }
}
