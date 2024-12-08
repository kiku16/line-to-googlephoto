import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as line from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import { GoogleApi, GooglePhotoApi, MediaType } from './clients';
import Readable from 'stream';


dotenv.config();

// create LINE SDK config from env variables
const config = {
  channelSecret: process.env.L_CHANNEL_SECRET || '',
};
line.middleware(config)

// create LINE SDK client
const client = new line.Client({
  channelAccessToken: process.env.L_CHANNEL_ACCESS_TOKEN || ''
});
console.log("L_CHANNEL_ACCESS_TOKEN", process.env.L_CHANNEL_ACCESS_TOKEN);

const albumId = process.env.G_ALBUM_ID || '';

const extractBody = (event: APIGatewayProxyEvent): any => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  let body = event.body;
  if (event.isBase64Encoded && body) {
    body = Buffer.from(body, 'base64').toString('utf-8');
    console.log("Request body:", body);
  }
  return body ? JSON.parse(body) : {};
}

const streamToBuffer = (stream: Readable): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};

export const callback = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const google = new GoogleApi();
    const photo = new GooglePhotoApi();

    const jwt = await google.getAccessToken();

    const body = extractBody(event);
    const uploadTokens: string[] = [];
    for (const event of body.events) {
      if (event.message.type !== 'image' && event.message.type !== 'video') {
        continue;
      }
      const imageStream = await client.getMessageContent(event.message.id);
      const image = await streamToBuffer(imageStream);
      const mediaType = event.message.type === 'image' ? MediaType.IMAGE : MediaType.VIDEO;
      const timestamp = event.timestamp;
      const uploadToken = await photo.uploadImage(jwt.access_token, timestamp, image, mediaType);
      uploadTokens.push(uploadToken);
    }
    const res = await photo.addImagesToAlbum(jwt.access_token, albumId, uploadTokens);
    console.log("res:", res);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Success' }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
