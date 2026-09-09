import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { describe, expect, it } from "bun:test";
import { normalizeEvent } from "../../src/domain/events";
import { SqsEventQueue } from "../../src/infrastructure/sqs/sqs-event-queue";

const userId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const queueUrl = "https://sqs.eu-central-1.amazonaws.com/000000000000/test-queue";

describe("SqsEventQueue", () => {
  it("sends the event as JSON to the configured queue", async () => {
    const sentCommands: SendMessageCommand[] = [];
    const fakeClient = {
      send: async (command: SendMessageCommand) => {
        sentCommands.push(command);
        return {};
      },
    };

    const event = normalizeEvent({
      eventType: "NEW_MESSAGE",
      userId,
      data: { senderName: "Alex" },
    });

    const queue = new SqsEventQueue(queueUrl, fakeClient);
    await queue.enqueue(event);

    expect(sentCommands).toHaveLength(1);
    expect(sentCommands[0]?.input.QueueUrl).toBe(queueUrl);
    expect(sentCommands[0]?.input.MessageBody).toBe(JSON.stringify(event));
  });

  it("propagates the error when the underlying send fails", async () => {
    const fakeClient = {
      send: async () => {
        throw new Error("SQS is unavailable");
      },
    };

    const event = normalizeEvent({
      eventType: "NEW_MESSAGE",
      userId,
      data: { senderName: "Alex" },
    });

    const queue = new SqsEventQueue(queueUrl, fakeClient);

    await expect(queue.enqueue(event)).rejects.toThrow("SQS is unavailable");
  });
});
