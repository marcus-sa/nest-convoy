import { AggregateRoot } from '@nest-convoy/events/aggregate';
import { Type } from '@nestjs/common';

export const EVENT_AGGREGATE_META = Symbol('EVENT_AGGREGATE_META');

export function EventAggregate<AR extends AggregateRoot>(
  entity: Type<AR>,
): ClassDecorator {
  return target => {
    Reflect.defineMetadata(EVENT_AGGREGATE_META, entity, target);
  };
}
