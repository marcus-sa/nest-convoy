import type { Command } from '@nest-convoy/commands/common';

import { AggregateRoot } from './aggregate-root';
import { PROCESS_COMMAND_METADATA, APPLY_EVENT_METADATA } from './decorators';

export abstract class CommandProcessingAggregate<
  T extends CommandProcessingAggregate<T, CT>,
  CT extends Command
> /*<
  T extends CommandProcessingAggregate<T, C>,
  C extends Command
> */ extends AggregateRoot<T> {
  private handle<T>(target: any, metadataKey: symbol): T {
    const keys = Object.getOwnPropertyNames(this.constructor.prototype);
    const methodName = keys.find(key => {
      const meta = Reflect.getMetadata(metadataKey, this.constructor, key);
      return meta?.constructor === target.constructor;
    });

    if (!methodName) {
      throw new Error('not found');
    }

    return (this as any)[methodName](target);
  }

  async applyEvent<E>(event: E): Promise<this> {
    return this.handle(event, APPLY_EVENT_METADATA);
  }

  async process<C, E extends readonly any[]>(cmd: C): Promise<E> {
    return this.handle(cmd, PROCESS_COMMAND_METADATA);
  }
}
