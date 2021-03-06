import {
  DomainEventEnvelope,
  EventsHandler,
  IEventHandler,
} from '@nest-convoy/core';

import { AccountDebited } from './account-debited';

@EventsHandler(AccountDebited)
export class AccountDebitedHandler implements IEventHandler<AccountDebited> {
  handle({ event }: DomainEventEnvelope<AccountDebited>): void {
    console.log(event);
    /*
    const event = new AccountDebited(uniqueId);
    await this.domainEventPublisher.publish(EVENT_DISPATCHER_ID, [event]);
     */
    // console.log(event, message.getHeaders());
  }
}
