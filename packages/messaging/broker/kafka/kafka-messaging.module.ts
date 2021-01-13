import { DynamicModule, Global, Injectable, Module } from '@nestjs/common';
import { ConsumerConfig, KafkaConfig, ProducerConfig } from 'kafkajs';
import { paramCase } from 'change-case';

import {
  ConvoyCoreModule,
  ConvoyTypeOrmOptions,
} from '@nest-convoy/core/core.module';
import {
  ConvoyChannelMapping,
  ConvoyMessagingConsumerModule,
  ConvoyMessagingProducerModule,
  DatabaseDuplicateMessageDetector,
} from '@nest-convoy/messaging';

import { KafkaMessageBuilder } from './kafka-message-builder';
import { KafkaMessageProducer } from './kafka-message-producer';
import { KafkaMessageConsumer } from './kafka-message-consumer';
import { KafkaProxy } from './kafka-proxy';
import { KAFKA_CONFIG } from './tokens';

export interface ConvoyKafkaMessagingBrokerModuleOptions {
  readonly consumer?: Omit<ConsumerConfig, 'groupId'>;
  readonly producer?: Omit<ProducerConfig, 'idempotent'>;
  readonly database: ConvoyTypeOrmOptions;
}

@Injectable()
class KafkaChannelMapping extends ConvoyChannelMapping {
  transform(channel: string): string {
    return super.transform(channel);
  }
}

@Global()
@Module({})
export class ConvoyKafkaMessagingModule {
  static register(
    config: Omit<KafkaConfig, 'logCreator'>,
    { database }: ConvoyKafkaMessagingBrokerModuleOptions,
  ): DynamicModule {
    return {
      module: ConvoyKafkaMessagingModule,
      imports: [
        ConvoyCoreModule.forRoot(database),
        ConvoyMessagingConsumerModule.register(
          {
            useExisting: KafkaMessageConsumer,
          },
          {
            useClass: DatabaseDuplicateMessageDetector,
          },
        ),
        ConvoyMessagingProducerModule.register({
          useExisting: KafkaMessageProducer,
        }),
      ],
      providers: [
        {
          provide: KAFKA_CONFIG,
          useValue: config,
        },
        KafkaProxy,
        KafkaMessageBuilder,
        KafkaMessageProducer,
        KafkaMessageConsumer,
      ],
      exports: [
        ConvoyMessagingConsumerModule,
        ConvoyMessagingProducerModule,
        KafkaMessageConsumer,
        KafkaMessageProducer,
      ],
    };
  }
}
