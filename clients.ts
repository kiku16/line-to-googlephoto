import * as line from '@line/bot-sdk';
import axios from 'axios';
import Readable from 'stream';

export enum MediaType {
  IMAGE = 'jpg',
  VIDEO = 'mp4',
}

/**
 * Converts a readable stream to a buffer.
 * @param stream The readable stream to convert.
 * @returns A promise that resolves to a buffer.
 */
export const streamToBuffer = (stream: Readable): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};

/**
 * Class representing the LINE API client.
 */
export class Line {
  protected readonly client: line.messagingApi.MessagingApiBlobClient;

  constructor() {

    // create LINE SDK config from env variables
    const config = {
      channelSecret: process.env.L_CHANNEL_SECRET || '',
    };
    line.middleware(config)

    // create LINE SDK client
    this.client = new line.messagingApi.MessagingApiBlobClient({
      channelAccessToken: process.env.L_CHANNEL_ACCESS_TOKEN || ''
    });
    // console.log("L_CHANNEL_ACCESS_TOKEN", process.env.L_CHANNEL_ACCESS_TOKEN);

  }

  /**
   * Retrieves the content of a message by its ID.
   * @param messageId The ID of the message.
   * @returns A promise that resolves to a buffer containing the message content.
   */
  public async getMessageContent(messageId: string): Promise<Buffer> {
    const stream = await this.client.getMessageContent(messageId);
    return streamToBuffer(stream);
  }

  /**
   * Retrieves the transcode status of a message by its ID.
   * @param messageId The ID of the message.
   * @returns A promise that resolves to the transcoded message content.
   */
  public async getMessageContentTranscodingByMessageId(messageId: string): Promise<any> {
    return this.client.getMessageContentTranscodingByMessageId(messageId);
  }
}

/**
 * Class representing a generic HTTP client.
 */
class HttpClient {
  protected readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Makes an HTTP request.
   * @param method The HTTP method.
   * @param url The URL to request.
   * @param data The data to send with the request.
   * @param params The URL parameters to send with the request.
   * @param headers The headers to send with the request.
   * @returns A promise that resolves to the response data.
   */
  public async request(method: string, url: string, data?: any, params?: any, headers?: any): Promise<any> {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${url}`,
        data,
        params,
        headers,
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        console.error('Error response:', error.response.data);
      } else {
        console.error('Error:', error.message);
      }
      throw error;
    }
  }
}

/**
 * Class representing the Google API client.
 */
export class GoogleApi extends HttpClient {
  constructor() {
    super('https://www.googleapis.com');
  }

  /**
   * Retrieves an access token.
   * @returns A promise that resolves to the access token.
   */
  public async getAccessToken(): Promise<any> {
    return this.request('POST', '/oauth2/v4/token', null, {
      refresh_token: process.env.G_REFRESH_TOKEN,
      client_id: process.env.G_CLIENT_ID,
      client_secret: process.env.G_CLIENT_SECRET,
      grant_type: 'refresh_token',
    });
  }
}

/**
 * Class representing the Google Photos API client.
 */
export class GooglePhotoApi extends HttpClient {
  constructor() {
    super('https://photoslibrary.googleapis.com');
  }

  /**
   * Uploads an image to Google Photos.
   * @param accessToken The access token.
   * @param timestamp The timestamp to use in the image file name.
   * @param image The image file.
   * @param mediaType The media type (image or video).
   * @returns A promise that resolves to the upload response.
   */
  public async uploadImage(accessToken: string, timestamp: number, image: Buffer, mediaType: MediaType): Promise<any> {
    return this.request('POST', '/v1/uploads', image, null, {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'X-Goog-Upload-File-Name': `${timestamp}.${mediaType}`,
      'X-Goog-Upload-Protocol': 'raw',
    });
  }

  /**
   * Adds uploaded images to an album.
   * @param albumToken The album token.
   * @param imageTokens The array of upload tokens.
   * @param accessToken The access token.
   * @returns A promise that resolves to the response.
   */
  public async addImagesToAlbum(accessToken: string, albumToken: string, imageTokens: string[]): Promise<any> {
    const newMediaItems = imageTokens.map(token => ({
      description: '',
      simpleMediaItem: {
        uploadToken: token,
      },
    }));

    const json = {
      albumId: albumToken,
      newMediaItems: newMediaItems,
    };

    return this.request('POST', '/v1/mediaItems:batchCreate', json, null, {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    });
  }
}