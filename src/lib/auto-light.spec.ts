import { lightState, LightStateMsg } from "./auto-lights";

describe('light state', () => {
    test('should turn', () => {

        // expect(result).toEqual(["on", 0, "off"]);
    });
});


/*function setupState(msg: LightStateMsg["payload"], prevState: TestDevice[]) {
    const context = new Map<string, any>();
    if (prevState) {
        context.set("prev", wrap(prevState));
    }
    return lightState({ payload: msg }, context, new DummyNodeRed(), wrap(prevState)).map(result => result.payload);
}*/
