import { EventEmitter } from "node:events";

export enum ClientEvent {
  CONNECTION_ADDED = "client:connection:added",
  CONNECTION_REMOVED = "client:connection:removed",
  CONNECTIONS_CHANGED = "client:connections:changed",
}

export interface IClientConnectionAddedEvent {
  name: string;
}

export interface IClientConnectionRemovedEvent {
  name: string;
}

export interface IEventBus {
  emit(event: ClientEvent.CONNECTION_ADDED, data: IClientConnectionAddedEvent): boolean;
  emit(event: ClientEvent.CONNECTION_REMOVED, data: IClientConnectionRemovedEvent): boolean;
  emit(event: ClientEvent.CONNECTIONS_CHANGED): boolean;
  on(
    event: ClientEvent.CONNECTION_ADDED,
    listener: (data: IClientConnectionAddedEvent) => void
  ): this;
  on(
    event: ClientEvent.CONNECTION_REMOVED,
    listener: (data: IClientConnectionRemovedEvent) => void
  ): this;
  on(event: ClientEvent.CONNECTIONS_CHANGED, listener: () => void): this;
  off(event: ClientEvent, listener: (...args: unknown[]) => void): this;
}

export class EventBus extends EventEmitter implements IEventBus {
  private static instance: EventBus | undefined;

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  static resetInstance(): void {
    EventBus.instance = undefined;
  }
}
