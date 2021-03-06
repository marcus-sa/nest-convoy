import { Inject, Type } from '@nestjs/common';
import { firstValueFrom, from, Observable, of, throwError } from 'rxjs';
import { map, retryWhen, take } from 'rxjs/operators';
import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception';
import { CircularDependencyException } from '@nestjs/core/errors/exceptions/circular-dependency.exception';
import { plainToClass } from '@deepkit/type';

import { Command, CommandProvider } from '@nest-convoy/commands/common';
import { DomainEvent } from '@nest-convoy/events/common';

import { EntityIdAndVersion, EventWithMetadata } from './interfaces';
import { CommandProcessingAggregate } from './command-processing-aggregate';
import { Snapshot } from './snapshot';
import { Aggregates } from './aggregates';
import {
  CommandProcessingFailedException,
  DuplicateTriggeringEventException,
  OptimisticLockingException,
} from './exceptions';
import {
  AggregateRepositoryInterceptor,
  UpdateEventsAndOptions,
} from './aggregate-repository-interceptor';
import {
  AggregateCrudSaveOptions,
  AggregateStoreCrud,
  AggregateCrudUpdateOptions,
} from './crud';
import { AggregateRoot } from './aggregate-root';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getAggregateRepositoryToken<AR extends AggregateRoot>(
  aggregate: Type<AR>,
) {
  if (aggregate == null) {
    throw new CircularDependencyException(
      `@${InjectAggregateRepository.name}()`,
    );
  }
  return `${aggregate.name}AggregateRepository`;
}

export class CommandOutcome<E extends readonly DomainEvent[]> {
  constructor(readonly events: E, readonly throwable?: RuntimeException) {}

  isFailure(): boolean {
    return !!this.throwable;
  }
}

export function InjectAggregateRepository<
  AR extends CommandProcessingAggregate<AR, any>,
>(aggregate: Type<AR>): PropertyDecorator {
  return (target: object, key: string | symbol, index?: number) =>
    Inject(getAggregateRepositoryToken(aggregate))(target, key, index);
}

export class AggregateRepository<
  AR extends CommandProcessingAggregate<AR, CT>,
  CT extends Command,
> {
  find = this.aggregateStore.find;

  constructor(
    private readonly aggregateType: Type<AR>,
    private readonly aggregates: Aggregates,
    private readonly aggregateStore: AggregateStoreCrud, // private readonly repository: Repository<AR>,
    // @Inject(AGGREGATE_REPOSITORY_INTERCEPTOR)
    private readonly interceptor: AggregateRepositoryInterceptor,
  ) {}

  private async transformUpdateEventsAndOptions<
    S extends Snapshot,
    E extends readonly DomainEvent[],
  >(
    aggregate: AR,
    commandOutcome: CommandOutcome<E>,
    options?: AggregateCrudUpdateOptions<AR, S>,
  ): Promise<UpdateEventsAndOptions<AR, S, E>> {
    if (commandOutcome.isFailure()) {
      const handled = this.effectiveInterceptor(options).handleException<
        AR,
        S,
        E
      >(aggregate, commandOutcome.throwable, options);
      if (!handled) {
        throw new CommandProcessingFailedException(commandOutcome.throwable);
      }

      return handled;
    } else {
      await this.aggregates.applyEvents(aggregate, commandOutcome.events);

      return this.effectiveInterceptor(options).transformUpdate<AR, S, E>(
        aggregate,
        {
          events: commandOutcome.events,
          ...options,
        },
      );
    }
  }

  private withPossibleSnapshot<S extends Snapshot>(
    aggregate: AR,
    oldEvents: readonly EventWithMetadata<any>[],
    newEvents: readonly DomainEvent[],
    snapshotVersion?: string,
    options?: AggregateCrudUpdateOptions<AR, S>,
  ): AggregateCrudUpdateOptions<AR, S> {
    const snapshot = this.aggregateStore.possibleSnapshot<AR, S>(
      aggregate,
      oldEvents,
      newEvents,
      snapshotVersion,
    );
    return snapshot ? { snapshot } : options!;
  }

  private effectiveInterceptor<
    S extends Snapshot,
    E extends readonly DomainEvent[],
  >(
    options?: AggregateCrudUpdateOptions<AR, S>,
  ): AggregateRepositoryInterceptor {
    return options?.interceptor || this.interceptor;
  }

  private withRetry<T>(request: () => Promise<T>): Observable<T> {
    return from(request()).pipe(
      retryWhen(errors =>
        errors.pipe(
          map(result =>
            result instanceof OptimisticLockingException
              ? throwError(() => result)
              : of(result),
          ),
          take(10),
        ),
      ),
    );
  }

  private updateWithProvidedCommand<
    C extends Command,
    S extends Snapshot,
    E extends readonly DomainEvent[],
  >(
    entityId: string,
    commandProvider: CommandProvider<AR, C>,
    options?: AggregateCrudUpdateOptions<AR, S>,
  ): Promise<EntityIdAndVersion> {
    return firstValueFrom(
      this.withRetry<EntityIdAndVersion>(async () => {
        const entityWithMetadata = await this.aggregateStore.find(
          this.aggregateType,
          entityId,
          options,
        );
        const {
          entity: aggregate,
          events: oldEvents,
          snapshotVersion,
          entityVersion,
        } = entityWithMetadata;

        const command = await commandProvider(aggregate);
        let commandOutcome: CommandOutcome<E>;
        if (command) {
          try {
            commandOutcome = new CommandOutcome<E>(
              await aggregate.process(command),
            );
          } catch (err) {
            commandOutcome = new CommandOutcome<E>([] as never, err);
          }
        } else {
          commandOutcome = new CommandOutcome<E>([] as never);
        }

        const transformed = await this.transformUpdateEventsAndOptions(
          aggregate,
          commandOutcome,
          options,
        );
        if (!transformed.events.length) {
          return { entityId, entityVersion };
        } else {
          try {
            const snapshot = this.withPossibleSnapshot(
              aggregate,
              oldEvents,
              transformed.events,
              snapshotVersion,
              transformed.options,
            );
            return await this.aggregateStore.update(
              aggregate,
              entityWithMetadata,
              transformed.events,
              snapshot,
            );
          } catch (err) {
            if (err instanceof DuplicateTriggeringEventException) {
              // This should not happen but lets handle it anyway
              return this.aggregateStore.find(this.aggregateType, entityId);
            }
            // TODO: Should this be here?
            return { entityId, entityVersion };
          }
        }
      }),
    );
  }

  async save<C>(
    cmd: C,
    options?: AggregateCrudSaveOptions,
  ): Promise<EntityIdAndVersion> {
    const aggregate = plainToClass<Type<AR>>(this.aggregateType, {});
    const events = await aggregate.process(cmd);
    await this.aggregates.applyEvents(aggregate, events);
    return this.aggregateStore.save(aggregate, events, options);
  }

  async update<C extends Command, S extends Snapshot>(
    entityId: string,
    cmd: C,
    options?: AggregateCrudUpdateOptions<AR, S>,
  ): Promise<EntityIdAndVersion> {
    return this.updateWithProvidedCommand(entityId, () => cmd, options);
  }
}
