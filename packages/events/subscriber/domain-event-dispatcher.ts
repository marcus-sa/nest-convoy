import { Logger } from '@nestjs/common';
import { InternalMessageConsumer } from '@nest-convoy/messaging/consumer';
import { Message } from '@nest-convoy/messaging/common';
import { Dispatcher } from '@nest-convoy/core';
import {
  DomainEvent,
  DomainEventNameMapping,
  EventMessageHeaders,
} from '@nest-convoy/events/common';

import { DomainEventHandlers } from './domain-event-handlers';
import { DomainEventEnvelope } from './domain-event-envelope';

export class DomainEventDispatcher implements Dispatcher {
  private readonly logger = new Logger(this.constructor.name);

  constructor(
    private readonly eventDispatcherId: string,
    private readonly domainEventHandlers: DomainEventHandlers,
    private readonly messageConsumer: InternalMessageConsumer,
    private readonly domainEventNameMapping: DomainEventNameMapping,
  ) {}

  subscribe(): void {
    this.messageConsumer.subscribe(
      this.eventDispatcherId,
      this.domainEventHandlers.getAggregateTypesAndEvents(),
      this.handleMessage.bind(this),
    );
  }

  async handleMessage(message: Message): Promise<void> {
    const aggregateType = message.getRequiredHeader(
      EventMessageHeaders.AGGREGATE_TYPE,
    );

    const eventType = message.getRequiredHeader(EventMessageHeaders.EVENT_TYPE);
    const eventName = this.domainEventNameMapping.externalEventTypeToEventClassName(
      aggregateType,
      eventType,
    );
    message.setHeader(EventMessageHeaders.EVENT_TYPE, eventName);

    const handler = this.domainEventHandlers.findTargetMethod(message);
    if (!handler) return;

    const param = {} as DomainEvent;
    const aggregateId = message.getRequiredHeader(
      EventMessageHeaders.AGGREGATE_ID,
    );
    const messageId = message.getRequiredHeader(Message.ID);
    const dee = new DomainEventEnvelope(
      message,
      aggregateType,
      aggregateId,
      messageId,
      param,
    );

    await handler.invoke(dee);
  }
}
