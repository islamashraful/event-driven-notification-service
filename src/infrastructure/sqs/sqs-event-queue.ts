import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { NotificationEvent } from "../../domain/events";

export class SqsEventQueue {
  constructor(
    private readonly queueUrl: string,
    private readonly client: Pick<SQSClient, "send"> = new SQSClient({}),
  ) {}

  async enqueue(event: NotificationEvent): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(event),
      }),
    );
  }
}
