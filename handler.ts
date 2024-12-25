import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as dotenv from 'dotenv';
import { GoogleApi, GooglePhotoApi, MediaType, Line } from './clients';


dotenv.config();

const albumId = process.env.G_ALBUM_ID || '';
const startDatetime = new Date(process.env.START_DATETIME || new Date());
const endDatetime = new Date(process.env.END_DATETIME || new Date(new Date().getTime() + 60 * 60 * 1000));

const google = new GoogleApi();
const photo = new GooglePhotoApi();
const line = new Line();

/**
 * Extracts the body from the API Gateway event.
 * @param event The API Gateway event.
 * @returns The parsed body.
 */
const extractBody = (event: APIGatewayProxyEvent): any => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  let body = event.body;
  if (event.isBase64Encoded && body) {
    body = Buffer.from(body, 'base64').toString('utf-8');
    console.log("Request body:", body);
  }
  return body ? JSON.parse(body) : {};
}

/**
 * Checks if the current datetime is within the allowed range.
 * @returns True if within range, false otherwise.
 */
const isWithinDatetimeRange = (): boolean => {
  const now = new Date();
  return endDatetime > now && now >= startDatetime;
};

/**
 * Polls the transcoding status of a message.
 * @param line The LINE client instance.
 * @param messageId The ID of the message.
 * @param interval The polling interval in milliseconds.
 * @param maxAttempts The maximum number of attempts.
 * @returns The transcoding status.
 * @throws If transcoding does not succeed within the allowed attempts.
 */
const pollTranscodingStatus = async (line: Line, messageId: string, interval: number, maxAttempts: number): Promise<any> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const transcodingStatus = await line.getMessageContentTranscodingByMessageId(messageId);
    if (transcodingStatus.status === 'succeeded') {
      return transcodingStatus;
    }
    if (transcodingStatus.status === 'failed') {
      break;
    }
    console.log(`Transcoding status is not succeeded (attempt ${attempt + 1}):`, transcodingStatus);
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Transcoding did not succeed within the allowed attempts');
};

/**
 * Lambda function handler for processing LINE messages and uploading to Google Photos.
 * @param event The API Gateway event.
 * @returns The API Gateway response.
 */
export const callback = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

  try {
    const body = extractBody(event);

    if (!isWithinDatetimeRange()) {
      console.log("Request is outside of allowed datetime range");
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Request is outside of allowed datetime range' }),
      };
    }

    const lineUserId = body.events[0].source.userId;
    const profile = await line.getProfile(lineUserId);
    
    const jwt = await google.getAccessToken();

    const uploadTokens: string[] = [];
    for (const event of body.events) {
      if (event.message.type !== 'image' && event.message.type !== 'video') {
        continue;
      }
      if (event.message.type === 'video') {
        try {
          await pollTranscodingStatus(line, event.message.id, 3000, 20); // 3秒間隔、最大20回試行
        } catch (error) {
          console.log("Transcoding failed:", error.message);
          continue;
        }
      }
      const content = await line.getMessageContent(event.message.id);
      const mediaType = event.message.type === 'image' ? MediaType.IMAGE : MediaType.VIDEO;
      const timestamp = event.timestamp;
      const uploadToken = await photo.uploadImage(jwt.access_token, timestamp, content, mediaType);
      uploadTokens.push(uploadToken);
    }
    if (uploadTokens.length > 0) {
      const res = await photo.addImagesToAlbum(jwt.access_token, albumId, uploadTokens, `${profile.displayName}さんが投稿`);
      console.log("res:", res);
    }

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
