import { RedisMessage } from '../types';
import { throwErrorIfInvalidInput, throwErrorIfNotPresenter } from '../imports/validation';

export default function buildRedisMessage(sessionVariables: Record<string, unknown>, input: Record<string, unknown>): RedisMessage {
  throwErrorIfNotPresenter(sessionVariables);
  throwErrorIfInvalidInput(input,
    [
      { name: 'status', type: 'string', required: true },
      { name: 'rate', type: 'number', required: true },
      { name: 'time', type: 'number', required: true },
      { name: 'state', type: 'int', required: true },
      { name: 'compact', type: 'boolean', required: true },
    ]
  )

  const eventName = `UpdateMediaPlayerPubMsg`;

  const routing = {
    meetingId: sessionVariables['x-hasura-meetingid'] as String,
    userId: sessionVariables['x-hasura-userid'] as String
  };

  const header = {
    name: eventName,
    meetingId: routing.meetingId,
    userId: routing.userId
  };

  const body = {
    status: input.status,
    rate: input.rate,
    time: input.time,
    state: input.state,
    compact: input.compact,
  };

  return { eventName, routing, header, body };
}
