import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

import { Message, MessageProducer } from '@nest-convoy/messaging';

import { KafkaProxy } from './kafka-proxy';
import { KafkaMessageBuilder } from './kafka-message-builder';

@Injectable()
export class KafkaMessageProducer
  extends MessageProducer
  implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    private readonly kafka: KafkaProxy,
    private readonly message: KafkaMessageBuilder,
  ) {
    super();
  }

  async sendBatch(
    destination: string,
    messages: readonly Message[],
    isEvent: boolean,
  ): Promise<void> {
    await this.kafka.producer.send({
      topic: destination,
      messages: messages.map(message => this.message.to(message)),
    });
  }

  async send(
    destination: string,
    message: Message,
    isEvent: boolean,
  ): Promise<void> {
    await this.sendBatch(destination, [message], isEvent);
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.kafka.producer.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.kafka.producer.disconnect();
  }
}
