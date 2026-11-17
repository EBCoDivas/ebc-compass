import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import type { StudentProfile } from '../types/studentProfile.js'

export interface ProfileRepository {
  get(subject: string): Promise<StudentProfile | undefined>
  save(profile: StudentProfile): Promise<void>
}

export class DynamoProfileRepository implements ProfileRepository {
  constructor(
    private readonly tableName = process.env.PROFILES_TABLE ?? 'StudentProfiles',
    private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } }),
  ) {}
  async get(subject: string): Promise<StudentProfile | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { studentId: subject }, ConsistentRead: true }))
    return result.Item?.profile as StudentProfile | undefined
  }
  async save(profile: StudentProfile): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { studentId: profile.id, profile } }))
  }
}
