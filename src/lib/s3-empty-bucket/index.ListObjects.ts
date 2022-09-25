import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

interface HandlerEvent {
   BUCKET_NAME?: string;
}

interface HandlerResponse {
   BUCKET_NAME: string;
   OBJECT_KEY_LIST?: string[];
}

const s3Client = new S3Client({});

const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
   const bucketName = event['BUCKET_NAME'];
   if (!bucketName) throw Error('"BUCKET_NAME" is required');

   const { Contents: contents } = await s3Client.send(new ListObjectsV2Command({ Bucket: bucketName }));

   return {
      BUCKET_NAME: bucketName,
      OBJECT_KEY_LIST: contents
         ? contents.map(content => {
              if (!content.Key) throw Error('object key not exists. ' + JSON.stringify(content));
              return content.Key;
           })
         : undefined,
   };
};

export { handler };
