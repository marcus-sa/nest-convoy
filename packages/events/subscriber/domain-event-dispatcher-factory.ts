import { Injectable } from '@nestjs/common';
import { DispatcherFactory } from '@nest-convoy/core';
import { NestConvoyMessageConsumer } from '@nest-convoy/messaging/consumer';
import { DomainEventNameMapping } from '@nest-convoy/events/common';

import { DomainEventHandlers } from './domain-event-handlers';
import { DomainEventDispatcher } from './domain-event-dispatcher';

@Injectable()
export class DomainEventDispatcherFactory
  implements DispatcherFactory<DomainEventDispatcher, DomainEventHandlers> {
  constructor(
    private readonly messageConsumer: NestConvoyMessageConsumer,
    private readonly domainEventNameMapping: DomainEventNameMapping,
  ) {}

  create(
    eventDispatcherId: string,
    domainEventHandlers: DomainEventHandlers,
  ): DomainEventDispatcher {
    return new DomainEventDispatcher(
      eventDispatcherId,
      domainEventHandlers,
      this.messageConsumer,
      this.domainEventNameMapping,
    );
  }
}
