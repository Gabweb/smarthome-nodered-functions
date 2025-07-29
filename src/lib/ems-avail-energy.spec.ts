import { Light } from "./lights";
import { DummyNodeRed, NodeRed } from "./node-red";
import { emsAvailEnergy, EmsAvailEnergyMsg } from "./ems-avail-energy";
import { State, SunModel } from "./util/homeassistant-model";

const now = new Date();
const threeHoursBefore = new Date(now.getTime() - 3 * 60 * 60 * 1000);
const inOneHour = new Date(now.getTime() + 1 * 60 * 60 * 1000);
const inThreeHours = new Date(now.getTime() + 3 * 60 * 60 * 1000);
const inFiveHours = new Date(now.getTime() + 5 * 60 * 60 * 1000);


const results: [EmsAvailEnergyMsg, number][] = [
    // negative bat == charging
    // negative grid == available
    [{ gridonline: true, gridpower: -1000, batLoad: 100, batChargeLimit: 0, batW: 900 }, 50],
    [{ gridonline: true, gridpower: -50, batLoad: 50, batW: -1800 }, 0],
    [{ gridonline: false, gridpower: -1000, batLoad: 100, batChargeLimit: 0, batW: 0 }, 1100],
    [{ gridonline: false, gridpower: 0, batLoad: 40, batW: 0 }, -1700],

    // Sun related tests --------------
    // Baseline
    [{ gridonline: true, gridpower: -2000, batLoad: 80, batW: 0 }, 950],
    // In the morning reserve half power for battery
    [{ gridonline: true, gridpower: -2000, batLoad: 80, batW: 0, sun: genSun(inThreeHours, inFiveHours) }, 1450],
    // In the afternoon reserve 2x power for battery
    [{ gridonline: true, gridpower: -2000, batLoad: 80, batW: 0, sun: genSun(threeHoursBefore, inOneHour) }, 150],
    [{ gridonline: true, gridpower: -2000, batLoad: 91, batW: 0, sun: genSun(threeHoursBefore, inOneHour) }, 950],

    // Should consider batMaxCharge
    [{ gridonline: true, gridpower: -1000, batLoad: 100, batChargeLimit: 0, batW: 0 }, 950],
    [{ gridonline: true, gridpower: -1000, batLoad: 100, batChargeLimit: 20, batW: 0 }, 950 - 500],
    [{ gridonline: true, gridpower: -1000, batLoad: 100, batChargeLimit: 40, batW: 0 }, 950 - 500],
    // Should never happen, but chargeLimit must still be considered as upper limit
    [{ gridonline: true, gridpower: -1000, batLoad: 50, batChargeLimit: 0, batW: 0 }, 950],
]

describe('emsAvailEnergy results', () => {
    test.each(results)(
        'should return %p for input %p',
        (input, expected) => {
            const state = setupState(input);
            expect(state).toEqual(expected);
        }
    );
});

function setupState(input: EmsAvailEnergyMsg): number {
    return emsAvailEnergy(
        { payload: input },
        new Map(),
        new Map(),
        new DummyNodeRed(),
    ).payload
}

function genSun(
    nextNoon: Date,
    nextDusk: Date,
): State<SunModel> {
    const sun: Partial<State<Partial<SunModel>>> = {
        attributes: {
            next_noon: nextNoon.toISOString(),
            next_dusk: nextDusk.toISOString(),
        }
    }
    return sun as any
}
