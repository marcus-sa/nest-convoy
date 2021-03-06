import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NEST_CONVOY_CONNECTION } from '@nest-convoy/common';
import { Message, MessageEntity } from '@nest-convoy/messaging/common';
import { MessageProducer } from '@nest-convoy/messaging/producer';

@Injectable()
export class DatabaseMessageProducer extends MessageProducer {
  constructor(
    @InjectRepository(MessageEntity, NEST_CONVOY_CONNECTION)
    private readonly messageRepository: Repository<MessageEntity<unknown>>,
  ) {
    super();
  }

  async send(destination: string, message: Message): Promise<void> {
    await this.sendBatch(destination, [message]);
  }

  async sendBatch(
    destination: string,
    messages: readonly Message[],
  ): Promise<void> {
    await this.messageRepository.manager.transaction(manager =>
      Promise.all(
        messages.map(message =>
          manager.save(MessageEntity, {
            id: message.id,
            // partition: message.partition,
            headers: message.getHeaders(),
            payload: message.getPayload(),
            destination,
          }),
        ),
      ),
    );
  }
}
