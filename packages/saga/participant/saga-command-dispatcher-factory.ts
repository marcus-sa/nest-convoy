import { DispatcherFactory } from '@nest-convoy/core';
import { CommandHandlers } from '@nest-convoy/commands/consumer';
import { Injectable } from '@nestjs/common';
import { NestConvoyMessageConsumer } from '@nest-convoy/messaging/consumer';
import { NestConvoyMessageProducer } from '@nest-convoy/messaging/producer';
import { SagaLockManager } from '@nest-convoy/saga/common';

import { SagaCommandDispatcher } from './saga-command-dispatcher';

@Injectable()
export class SagaCommandDispatcherFactory
  implements DispatcherFactory<SagaCommandDispatcher, CommandHandlers> {
  constructor(
    private readonly messageConsumer: NestConvoyMessageConsumer,
    private readonly messageProducer: NestConvoyMessageProducer,
    private readonly sagaLockManager: SagaLockManager,
  ) {}

  create(
    commandDispatcherId: string,
    commandHandlers: CommandHandlers,
  ): SagaCommandDispatcher {
    return new SagaCommandDispatcher(
      commandDispatcherId,
      commandHandlers,
      this.messageConsumer,
      this.messageProducer,
      this.sagaLockManager,
    );
  }
}
