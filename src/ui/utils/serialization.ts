import { SessionData, CounterData, DenominationDetail } from "../common/types";

// 纯JavaScript实现的轻量级序列化器（避免CSP问题）
export class SimpleProtobufSerializer {
  private static readonly MAGIC_BYTES = new Uint8Array([0x50, 0x42, 0x53, 0x44]); // "PBSD"
  private static readonly VERSION = 1;

  /**
   * 序列化 SessionData 为二进制数据
   */
  public static serializeSessionData(sessionData: SessionData): Uint8Array {
    const writer = new BinaryWriter();
    
    // 写入魔数和版本
    writer.writeBytes(this.MAGIC_BYTES);
    writer.writeUInt32(this.VERSION);
    
    // 写入 SessionData
    this.writeSessionData(writer, sessionData);
    
    return writer.toUint8Array();
  }

  /**
   * 反序列化二进制数据为 SessionData
   */
  public static deserializeSessionData(buffer: Uint8Array): SessionData {
    const reader = new BinaryReader(buffer);
    
    // 验证魔数
    const magic = reader.readBytes(4);
    if (!this.arrayEqual(magic, this.MAGIC_BYTES)) {
      throw new Error('Invalid magic bytes');
    }
    
    // 验证版本
    const version = reader.readUInt32();
    if (version !== this.VERSION) {
      throw new Error(`Unsupported version: ${version}`);
    }
    
    // 读取 SessionData
    return this.readSessionData(reader);
  }

  /**
   * 序列化为 Base64 字符串
   */
  public static serializeToBase64(sessionData: SessionData): string {
    const buffer = this.serializeSessionData(sessionData);
    return btoa(String.fromCharCode(...buffer));
  }

  /**
   * 从 Base64 字符串反序列化
   */
  public static deserializeFromBase64(base64: string): SessionData {
    const binaryString = atob(base64);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }
    return this.deserializeSessionData(buffer);
  }

  /**
   * 序列化批量数据
   */
  public static serializeBatch(sessions: SessionData[]): Uint8Array {
    const writer = new BinaryWriter();
    
    // 写入魔数和版本
    writer.writeBytes(this.MAGIC_BYTES);
    writer.writeUInt32(this.VERSION);
    
    // 写入数量
    writer.writeUInt32(sessions.length);
    
    // 写入每个 SessionData
    for (const session of sessions) {
      this.writeSessionData(writer, session);
    }
    
    return writer.toUint8Array();
  }

  /**
   * 反序列化批量数据
   */
  public static deserializeBatch(buffer: Uint8Array): SessionData[] {
    const reader = new BinaryReader(buffer);
    
    // 验证魔数和版本
    const magic = reader.readBytes(4);
    if (!this.arrayEqual(magic, this.MAGIC_BYTES)) {
      throw new Error('Invalid magic bytes');
    }
    
    const version = reader.readUInt32();
    if (version !== this.VERSION) {
      throw new Error(`Unsupported version: ${version}`);
    }
    
    // 读取数量
    const count = reader.readUInt32();
    const sessions: SessionData[] = [];
    
    // 读取每个 SessionData
    for (let i = 0; i < count; i++) {
      sessions.push(this.readSessionData(reader));
    }
    
    return sessions;
  }

  /**
   * 写入 SessionData
   */
  private static writeSessionData(writer: BinaryWriter, data: SessionData): void {
    writer.writeUInt32(data.id);
    writer.writeUInt32(data.no);
    writer.writeString(data.timestamp);
    writer.writeString(data.startTime);
    writer.writeString(data.endTime || '');
    writer.writeString(data.machineMode || '');
    writer.writeUInt32(data.totalCount);
    writer.writeUInt64(data.totalAmount || 0);
    writer.writeUInt32(data.errorCount);
    writer.writeString(data.status);
    writer.writeString(data.errorCode || '');
    
    // 写入 denominationBreakdown
    writer.writeUInt32(data.denominationBreakdown.size);
    for (const [key, value] of data.denominationBreakdown) {
      writer.writeUInt32(key);
      writer.writeUInt32(value.denomination);
      writer.writeUInt32(value.count);
      writer.writeUInt64(value.amount);
    }
    
    // 写入 details
    const details = data.details || [];
    writer.writeUInt32(details.length);
    for (const detail of details) {
      writer.writeUInt32(detail.id);
      writer.writeUInt32(detail.no);
      writer.writeString(detail.timestamp);
      writer.writeString(detail.currencyCode);
      writer.writeUInt32(detail.denomination);
      writer.writeString(detail.status);
      writer.writeString(detail.errorCode || '');
      writer.writeString(detail.serialNumber || '');
    }
  }

  /**
   * 读取 SessionData
   */
  private static readSessionData(reader: BinaryReader): SessionData {
    const id = reader.readUInt32();
    const no = reader.readUInt32();
    const timestamp = reader.readString();
    const startTime = reader.readString();
    const endTime = reader.readString() || undefined;
    const machineMode = reader.readString() || undefined;
    const totalCount = reader.readUInt32();
    const totalAmount = reader.readUInt64();
    const errorCount = reader.readUInt32();
    const status = reader.readString() as "counting" | "completed" | "error" | "paused";
    const errorCode = reader.readString() || undefined;
    
    // 读取 denominationBreakdown
    const breakdownSize = reader.readUInt32();
    const denominationBreakdown = new Map<number, DenominationDetail>();
    for (let i = 0; i < breakdownSize; i++) {
      const key = reader.readUInt32();
      const denomination = reader.readUInt32();
      const count = reader.readUInt32();
      const amount = reader.readUInt64();
      denominationBreakdown.set(key, { denomination, count, amount });
    }
    
    // 读取 details
    const detailsLength = reader.readUInt32();
    const details: CounterData[] = [];
    for (let i = 0; i < detailsLength; i++) {
      const detailId = reader.readUInt32();
      const detailNo = reader.readUInt32();
      const detailTimestamp = reader.readString();
      const currencyCode = reader.readString();
      const denomination = reader.readUInt32();
      const detailStatus = reader.readString() as "counting" | "completed" | "error" | "paused";
      const detailErrorCode = reader.readString() || undefined;
      const serialNumber = reader.readString() || undefined;
      
      details.push({
        id: detailId,
        no: detailNo,
        timestamp: detailTimestamp,
        currencyCode,
        denomination,
        status: detailStatus,
        errorCode: detailErrorCode,
        serialNumber
      });
    }
    
    return {
      id,
      no,
      timestamp,
      startTime,
      endTime,
      machineMode,
      totalCount,
      totalAmount,
      errorCount,
      status,
      errorCode,
      denominationBreakdown,
      details
    };
  }

  /**
   * 比较两个数组是否相等
   */
  private static arrayEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * 获取序列化后的大小
   */
  public static getSerializedSize(sessionData: SessionData): number {
    return this.serializeSessionData(sessionData).length;
  }

  /**
   * 与 JSON 序列化进行比较
   */
  public static compareWithJSON(sessionData: SessionData): {
    protobufSize: number;
    jsonSize: number;
    compressionRatio: number;
  } {
    // 转换 Map 为 Object 以便 JSON 序列化
    const jsonData = {
      ...sessionData,
      denominationBreakdown: Object.fromEntries(sessionData.denominationBreakdown)
    };
    
    const protobufBuffer = this.serializeSessionData(sessionData);
    const jsonString = JSON.stringify(jsonData);
    
    const protobufSize = protobufBuffer.length;
    const jsonSize = new TextEncoder().encode(jsonString).length;
    
    return {
      protobufSize,
      jsonSize,
      compressionRatio: jsonSize / protobufSize
    };
  }
}

// 二进制写入器
class BinaryWriter {
  private buffer: number[] = [];

  writeUInt32(value: number): void {
    this.buffer.push(value & 0xFF);
    this.buffer.push((value >>> 8) & 0xFF);
    this.buffer.push((value >>> 16) & 0xFF);
    this.buffer.push((value >>> 24) & 0xFF);
  }

  writeUInt64(value: number): void {
    // JavaScript 数字精度限制，分别写入低32位和高32位
    const low = value & 0xFFFFFFFF;
    const high = Math.floor(value / 0x100000000);
    this.writeUInt32(low);
    this.writeUInt32(high);
  }

  writeString(value: string): void {
    const bytes = new TextEncoder().encode(value);
    this.writeUInt32(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
  }

  writeBytes(bytes: Uint8Array): void {
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

// 二进制读取器
class BinaryReader {
  private buffer: Uint8Array;
  private offset: number = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
  }

  readUInt32(): number {
    const value = this.buffer[this.offset] |
                  (this.buffer[this.offset + 1] << 8) |
                  (this.buffer[this.offset + 2] << 16) |
                  (this.buffer[this.offset + 3] << 24);
    this.offset += 4;
    return value >>> 0; // 无符号右移确保正数
  }

  readUInt64(): number {
    const low = this.readUInt32();
    const high = this.readUInt32();
    return high * 0x100000000 + low;
  }

  readString(): string {
    const length = this.readUInt32();
    const bytes = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return new TextDecoder().decode(bytes);
  }

  readBytes(length: number): Uint8Array {
    const bytes = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return bytes;
  }
}

// 向后兼容的 ProtobufSerializationService
export class ProtobufSerializationService {
  constructor() {
    console.log('Simple Protobuf serialization service initialized successfully (CSP-safe mode)');
  }

  /**
   * 序列化 SessionData
   */
  public serializeSessionData(sessionData: SessionData): Uint8Array {
    return SimpleProtobufSerializer.serializeSessionData(sessionData);
  }

  /**
   * 反序列化 SessionData
   */
  public deserializeSessionData(buffer: Uint8Array): SessionData {
    return SimpleProtobufSerializer.deserializeSessionData(buffer);
  }

  /**
   * 序列化批量数据
   */
  public serializeSessionDataBatch(sessionDataArray: SessionData[]): Uint8Array {
    return SimpleProtobufSerializer.serializeBatch(sessionDataArray);
  }

  /**
   * 反序列化批量数据
   */
  public deserializeSessionDataBatch(buffer: Uint8Array): SessionData[] {
    return SimpleProtobufSerializer.deserializeBatch(buffer);
  }

  /**
   * 序列化为 Base64
   */
  public serializeSessionDataToBase64(sessionData: SessionData): string {
    return SimpleProtobufSerializer.serializeToBase64(sessionData);
  }

  /**
   * 从 Base64 反序列化
   */
  public deserializeSessionDataFromBase64(base64String: string): SessionData {
    return SimpleProtobufSerializer.deserializeFromBase64(base64String);
  }

  /**
   * 批量序列化为 Base64
   */
  public serializeSessionDataBatchToBase64(sessionDataArray: SessionData[]): string {
    const buffer = SimpleProtobufSerializer.serializeBatch(sessionDataArray);
    return btoa(String.fromCharCode(...buffer));
  }

  /**
   * 从 Base64 批量反序列化
   */
  public deserializeSessionDataBatchFromBase64(base64String: string): SessionData[] {
    const binaryString = atob(base64String);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }
    return SimpleProtobufSerializer.deserializeBatch(buffer);
  }

  /**
   * 获取序列化大小
   */
  public getSerializedSize(sessionData: SessionData): number {
    return SimpleProtobufSerializer.getSerializedSize(sessionData);
  }

  /**
   * 获取批量序列化大小
   */
  public getBatchSerializedSize(sessionDataArray: SessionData[]): number {
    return SimpleProtobufSerializer.serializeBatch(sessionDataArray).length;
  }

  /**
   * 与 JSON 比较
   */
  public compareWithJSON(sessionData: SessionData): {
    protobufSize: number;
    jsonSize: number;
    compressionRatio: number;
  } {
    return SimpleProtobufSerializer.compareWithJSON(sessionData);
  }
}

export type { SessionData, CounterData, DenominationDetail };