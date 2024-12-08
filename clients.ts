import axios from 'axios';

export enum MediaType {
  IMAGE = 'jpg',
  VIDEO = 'mp4',
}

class HttpClient {
  protected readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

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

export class GoogleApi extends HttpClient {
  constructor() {
    super('https://www.googleapis.com');
  }

  /**
   * [getAccessToken アクセストークンを取得する]
   * @return {Promise<any>} [Promise]
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

export class GooglePhotoApi extends HttpClient {
  constructor() {
    super('https://photoslibrary.googleapis.com');
  }

  /**
   * [uploadImage 画像アップロード]
   * https://developers.google.com/photos/library/guides/upload-media#uploading-bytes
   * @param  {string}       accessToken [アクセストークン]
   * @param  {number}       timestamp   [タイムスタンプ（画像のファイル名に使います）]
   * @param  {binary}       image       [画像ファイル]
   * @param  {MediaType}    mediaType   [メディアタイプ（画像または動画）]
   * @return {Promise<any>}             [Promise]
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
   * [addImagesToAlbum アップロードした写真をアルバムに追加]
   * @param  {string}       albumToken  [アルバムトークン]
   * @param  {string[]}     imageTokens [アップロードトークンの配列]
   * @param  {string}       accessToken [アクセストークン]
   * @return {Promise<any>}             [Promise]
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