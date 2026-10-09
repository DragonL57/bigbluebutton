import { RedisMessage } from '../types';
import { throwErrorIfInvalidInput, throwErrorIfNotPresenter } from '../imports/validation';

/**
 * Removes one uploaded media file from the meeting. The presenter gate here is the first of
 * two: akka-apps checks the presenter again against the live meeting before deleting the row.
 */
export default function buildRedisMessage(sessionVariables: Record<string, unknown>, input: Record<string, unknown>): RedisMessage {
  throwErrorIfInvalidInput(input,
    [
      { name: 'mediaFileId', type: 'string', required: true },
    ]
  );

  throwErrorIfNotPresenter(sessionVariables);
  const eventName = `RemoveMediaFilePubMsg`;

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
    mediaFileId: input.mediaFileId,
  };

  return { eventName, routing, header, body };
}
