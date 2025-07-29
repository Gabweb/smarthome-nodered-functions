import { State, SunModel } from "./util/homeassistant-model";
import { NodeRed, NodeRedMsg } from "./node-red";
import { isBefore, isToday } from "./util/date-utils";

export interface EmsAvailEnergyMsg {
    gridonline?: boolean;
    gridpower?: number;
    batLoad?: number;
    batChargeLimit?: number;
    batW?: number;
    sun?: State<SunModel>;
}

// Env Settings -----------------------------------


// Misc Types -----------------------------------
export type ContextKeys = void;

// -------------------------------------------------

export function emsAvailEnergy(
    msg: NodeRedMsg<EmsAvailEnergyMsg>,
    context: Map<ContextKeys, any>,
    env: Map<void, any>,
    node: NodeRed,
): NodeRedMsg<number> {
    // Main -----------------------------------   
    return main();

    // Fun -----------------------------------
    function main(): NodeRedMsg<number> {
        const gridonline = msg.payload.gridonline ?? true
        const zero = gridonline ? 50 : -100;

        const batLoad = msg.payload.batLoad ?? 100
        const batChargeLimit = msg.payload.batChargeLimit ?? 50
        const batPower = (msg.payload.batW ?? 0) * -1 // Charge = positive
        const availGridEnergy = (msg.payload.gridpower ?? 9_999) * -1  // Avail = positive

        const beforeNoon = isBeforeNoon(msg.payload.sun?.attributes, 2 * 60) // 2 hours before noon
        const isSunSetting = isSetting(msg.payload.sun?.attributes, 2 * 60) // 2 hours before sunset
        const multiplier = beforeNoon ? 0.5 : isSunSetting ? 2 : 1

        const reserved = reservedCharge(multiplier, batChargeLimit, batLoad);
        const avail = availGridEnergy + batPower - reserved - zero

        node.status({ text: `Available: ${avail}W, Reserved for Bat: ${reserved}W` });
        return { payload: avail }
    }

    function reservedCharge(multiplier: number, batChargeLimit: number, batLoad: number) {
        const chargeLimit = batChargeLimit * 52;
        // Battery is limited to 38A
        const maxBatteryCharge = Math.min(1800, chargeLimit);
        const batIsFull = batLoad == 100

        const reserved = batIsFull ? 500 : Math.ceil((100 - batLoad) / 10) * 500
        return Math.min(reserved * multiplier, maxBatteryCharge)
    }

    function isBeforeNoon(sun: SunModel | undefined, offsetMinutes: number): boolean {
        if (!sun || !isToday(sun.next_noon)) return false;
        const noon = new Date(sun.next_noon);
        noon.setMinutes(noon.getMinutes() - offsetMinutes);
        const now = new Date();
        return isBefore(now, noon);
    }

    function isSetting(sun: SunModel | undefined, offsetMinutes: number): boolean {
        if (!sun) return false;
        if (!isToday(sun.next_dusk)) return true; // Already below horizon
        const sunSetting = new Date(sun.next_dusk);
        sunSetting.setMinutes(sunSetting.getMinutes() - offsetMinutes);
        const now = new Date();
        return isBefore(sunSetting, now)
    }
}
