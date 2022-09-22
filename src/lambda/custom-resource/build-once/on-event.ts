import {
   CdkCustomResourceEvent,
   CdkCustomResourceResponse,
   CloudFormationCustomResourceCreateEvent,
   CloudFormationCustomResourceDeleteEvent,
   CloudFormationCustomResourceUpdateEvent,
} from 'aws-lambda';
import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';

const codeBuildClient = new CodeBuildClient({});

const handler = async (event: CdkCustomResourceEvent): Promise<CdkCustomResourceResponse> => {
   switch (event.RequestType) {
      case 'Create':
         return onCreate(event);
      case 'Update':
         return onUpdate(event);
      case 'Delete':
         return onDelete(event);
   }
};

const onCreate = async (event: CloudFormationCustomResourceCreateEvent): Promise<CdkCustomResourceResponse> => {
   const physicalResourceId = event.LogicalResourceId + '-' + event.RequestId;
   const codeBuildProjectName = event.ResourceProperties['CODE_BUILD_PROJECT_NAME'];
   if (!codeBuildProjectName) throw Error('"CODE_BUILD_PROJECT_NAME" is required');
   const outputS3BucketName = event.ResourceProperties['OUTPUT_S3_BUCKET_NAME'];
   if (!outputS3BucketName) throw Error('"OUTPUT_S3_BUCKET_NAME" is required');
   const outputS3BucketObjectKey = event.ResourceProperties['OUTPUT_S3_BUCKET_OBJECT_KEY'];
   if (!outputS3BucketObjectKey) throw Error('"OUTPUT_S3_BUCKET_OBJECT_KEY" is required');

   const buildId = await startBuild(codeBuildProjectName);
   return {
      PhysicalResourceId: physicalResourceId,
      Data: { BUILD_ID: buildId, OUTPUT_S3_BUCKET_NAME: outputS3BucketName, OUTPUT_S3_BUCKET_OBJECT_KEY: outputS3BucketObjectKey },
   };
};

const onUpdate = async (event: CloudFormationCustomResourceUpdateEvent): Promise<CdkCustomResourceResponse> => {
   const physicalResourceId = event.PhysicalResourceId;
   if (!physicalResourceId) throw Error('physicalResourceId not exists');
   const codeBuildProjectName = event.ResourceProperties['CODE_BUILD_PROJECT_NAME'] as string;
   if (!codeBuildProjectName) throw Error('"CODE_BUILD_PROJECT_NAME" is required');
   const outputS3BucketName = event.ResourceProperties['OUTPUT_S3_BUCKET_NAME'] as string;
   if (!outputS3BucketName) throw Error('"OUTPUT_S3_BUCKET_NAME" is required');
   const outputS3BucketObjectKey = event.ResourceProperties['OUTPUT_S3_BUCKET_OBJECT_KEY'] as string;
   if (!outputS3BucketObjectKey) throw Error('"OUTPUT_S3_BUCKET_OBJECT_KEY" is required');
   const buildLock = Boolean(event.ResourceProperties['BUILD_LOCK']) as boolean;

   if (buildLock)
      return {
         PhysicalResourceId: physicalResourceId,
         Data: { OUTPUT_S3_BUCKET_NAME: outputS3BucketName, OUTPUT_S3_BUCKET_OBJECT_KEY: outputS3BucketObjectKey },
      };

   const buildId = await startBuild(codeBuildProjectName);
   return {
      PhysicalResourceId: physicalResourceId,
      Data: { BUILD_ID: buildId, OUTPUT_S3_BUCKET_NAME: outputS3BucketName, OUTPUT_S3_BUCKET_OBJECT_KEY: outputS3BucketObjectKey },
   };
};

const onDelete = async (event: CloudFormationCustomResourceDeleteEvent): Promise<CdkCustomResourceResponse> => {
   const physicalResourceId = event.PhysicalResourceId;
   if (!physicalResourceId) throw Error('physicalResourceId not exists');

   return { PhysicalResourceId: physicalResourceId };
};

const startBuild = async (projectName: string): Promise<string> => {
   const result = await codeBuildClient.send(new StartBuildCommand({ projectName }));

   const buildId = result.build?.id;
   if (!buildId) throw Error('buildId does not exist');

   return buildId;
};

export { handler };
