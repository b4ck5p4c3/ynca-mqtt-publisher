import mitt, {EventHandlerMap, EventType, Emitter} from "mitt";

export class Mitt<TEvents extends Record<EventType, unknown>> {
    constructor() {
        Object.assign(this, mitt());
    }
}

export interface Mitt<TEvents extends Record<EventType, unknown>> extends Emitter<TEvents> {
}