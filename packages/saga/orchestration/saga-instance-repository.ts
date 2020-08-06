import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { NEST_SAGA_CONNECTION } from '@nest-convoy/saga/common';

import { SagaInstance } from './saga-instance';
import { SagaInstanceEntity, SagaInstanceParticipantsEntity } from './entities';
import { DestinationAndResource } from './destination-and-resource';

@Injectable()
export abstract class SagaInstanceRepository {
  abstract save(sagaInstance: SagaInstance): Promise<SagaInstance>;
  abstract find(sagaType: string, sagaId: string): Promise<SagaInstance>;
  abstract update(sagaInstance: SagaInstance): Promise<void>;
}

@Injectable()
export class SagaMemoryInstanceRepository extends SagaInstanceRepository {
  find(sagaType: string, sagaId: string): Promise<SagaInstance> {
    return undefined;
  }

  save(sagaInstance: SagaInstance): Promise<SagaInstance> {
    return undefined;
  }

  update(sagaInstance: SagaInstance): Promise<void> {
    return undefined;
  }
}

@Injectable()
export class SagaDatabaseInstanceRepository extends SagaInstanceRepository {
  constructor(
    @InjectRepository(SagaInstanceEntity, NEST_SAGA_CONNECTION)
    private readonly sagaInstanceRepository: Repository<SagaInstanceEntity>,
    @InjectRepository(SagaInstanceParticipantsEntity, NEST_SAGA_CONNECTION)
    private readonly sagaInstanceParticipantsRepository: Repository<
      SagaInstanceParticipantsEntity
    >,
    @InjectConnection(NEST_SAGA_CONNECTION)
    private readonly connection: Connection,
  ) {
    super();
  }

  private async createDestinationsAndResources({
    destinationsAndResources,
    sagaId,
    sagaType,
  }: SagaInstance): Promise<void> {
    // const queryRunner = this.sagaInstanceParticipantsRepository.manager.connection.createQueryRunner();
    // await queryRunner.connect();
    // await queryRunner.startTransaction();

    await this.connection.transaction(async manager => {
      await Promise.all(
        destinationsAndResources.map(dr =>
          manager.create(SagaInstanceParticipantsEntity, {
            sagaId,
            sagaType,
            ...dr,
          }),
        ),
      );
    });

    // try {
    //   await Promise.all(
    //     destinationsAndResources.map(dr =>
    //       queryRunner.manager.update(
    //         SagaInstanceParticipantsEntity,
    //         { sagaId, sagaType },
    //         dr,
    //       ),
    //     ),
    //   );
    //
    //   await queryRunner.commitTransaction();
    // } catch (e) {
    //   // since we have errors lets rollback the changes we made
    //   await queryRunner.rollbackTransaction();
    // } finally {
    //   // you need to release a queryRunner which was manually instantiated
    //   await queryRunner.release();
    // }
  }

  private async findDestinationsAndResources(
    sagaType: string,
    sagaId: string,
  ): Promise<DestinationAndResource[]> {
    const sagaInstanceParticipants = await this.sagaInstanceParticipantsRepository.find(
      {
        sagaType,
        sagaId,
      },
    );

    return sagaInstanceParticipants.map(
      ({ destination, resource }) =>
        new DestinationAndResource(destination, resource),
    );
  }

  async find(sagaType: string, sagaId: string): Promise<SagaInstance> {
    const destinationAndResources = await this.findDestinationsAndResources(
      sagaType,
      sagaId,
    );

    const {
      stateName,
      lastRequestId,
      sagaData,
      sagaDataType,
    } = await this.sagaInstanceRepository.findOne({
      sagaType,
      sagaId,
    });

    // if (!sagaInstance) {
    //   throw new RuntimeException(
    //     `Cannot find saga instance ${sagaType} ${sagaId}`,
    //   );
    // }

    return new SagaInstance(
      sagaType,
      sagaId,
      stateName,
      lastRequestId,
      sagaDataType,
      sagaData,
      destinationAndResources,
    );
  }

  async save(sagaInstance: SagaInstance): Promise<SagaInstance> {
    const entity = await this.sagaInstanceRepository.create(sagaInstance);
    await this.createDestinationsAndResources(sagaInstance);
    return Object.assign(sagaInstance, entity);
  }

  async update({
    sagaType,
    sagaId,
    destinationsAndResources,
    ...sagaInstance
  }: SagaInstance): Promise<void> {
    const result = await this.sagaInstanceRepository.update(
      {
        sagaType,
        sagaId,
      },
      sagaInstance,
    );

    await this.createDestinationsAndResources(arguments[0] as SagaInstance);
  }
}
