import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';

interface HandlerEvent {
   BUCKET_NAME: string;
   OBJECT_KEY_LIST?: string[];
}

interface HandlerResponse {
   STATUS?: 'SUCCEEDED' | 'FAILED';
}

const s3Client = new S3Client({});

const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
   const bucketName = event['BUCKET_NAME'];
   if (!bucketName) throw Error('"BUCKET_NAME" is required');
   const objectKeyList = event['OBJECT_KEY_LIST'];

   if (!objectKeyList) return { STATUS: 'SUCCEEDED' };

   const result = await s3Client.send(
      new DeleteObjectsCommand({
         Bucket: bucketName,
         Delete: {
            Quiet: true,
            Objects: objectKeyList.map(objectKey => ({ Key: objectKey })),
         },
      }),
   );

   if (result.Errors) {
      throw Error('delete objects failed.' + JSON.stringify(result.Errors));
   }

   return { STATUS: 'SUCCEEDED' };
};

export { handler };
