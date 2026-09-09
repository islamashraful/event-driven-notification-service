import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { PushToken, PushTokenPlatform, PushTokenRepository } from "../../domain/ports";

export class DynamoDbPushTokenRepository implements PushTokenRepository {
  constructor(
    private readonly tableName: string,
    private readonly client: Pick<DynamoDBDocumentClient, "send">,
  ) {}

  async getToken(userId: string): Promise<PushToken | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId },
      }),
    );
    return (result.Item as PushToken | undefined) ?? null;
  }

  async saveToken(userId: string, pushToken: string, platform: PushTokenPlatform): Promise<void> {
    const item: PushToken = {
      userId,
      pushToken,
      platform,
      active: true,
      lastActiveAt: new Date().toISOString(),
    };
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async deactivateToken(userId: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: "SET active = :active",
        ExpressionAttributeValues: { ":active": false },
      }),
    );
  }

  async deleteToken(userId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { userId },
      }),
    );
  }

  async findStale(olderThan: Date): Promise<PushToken[]> {
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "lastActiveAt < :cutoff",
        ExpressionAttributeValues: { ":cutoff": olderThan.toISOString() },
      }),
    );
    return (result.Items as PushToken[] | undefined) ?? [];
  }
}
