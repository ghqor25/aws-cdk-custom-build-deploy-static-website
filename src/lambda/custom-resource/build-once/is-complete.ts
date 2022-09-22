import { CodeBuildClient, BatchGetBuildsCommand } from '@aws-sdk/client-codebuild';
import { CdkCustomResourceIsCompleteEvent, CdkCustomResourceIsCompleteResponse } from 'aws-lambda';

const codeBuildClient = new CodeBuildClient({});

const handler = async (event: CdkCustomResourceIsCompleteEvent): Promise<CdkCustomResourceIsCompleteResponse> => {
   switch (event.RequestType) {
      case 'Create':
         return onCreate(event);
      case 'Update':
         return onUpdate(event);
      case 'Delete':
         return onDelete(event);
   }
};

const onCreate = async (event: CdkCustomResourceIsCompleteEvent): Promise<CdkCustomResourceIsCompleteResponse> => {
   return await checkBuild(event);
};

const onUpdate = async (event: CdkCustomResourceIsCompleteEvent): Promise<CdkCustomResourceIsCompleteResponse> => {
   const buildLock = Boolean(event.ResourceProperties['BUILD_LOCK']) as boolean;

   if (buildLock) return { IsComplete: true };
   else return await checkBuild(event);
};

const onDelete = async (event: CdkCustomResourceIsCompleteEvent): Promise<CdkCustomResourceIsCompleteResponse> => {
   return { IsComplete: true };
};

const checkBuild = async (event: CdkCustomResourceIsCompleteEvent): Promise<CdkCustomResourceIsCompleteResponse> => {
   const codeBuildProjectName = event.ResourceProperties['CODE_BUILD_PROJECT_NAME'];
   if (!codeBuildProjectName) throw Error('"CODE_BUILD_PROJECT_NAME" is required');
   const buildId = event.Data?.['BUILD_ID'] as string;
   if (!buildId) throw Error('"BUILD_ID" is required');

   const result = await codeBuildClient.send(new BatchGetBuildsCommand({ ids: [buildId] }));
   if (!result.builds || result.builds[0].id !== buildId || result.builds[0].projectName !== codeBuildProjectName)
      throw Error('build info not matched.' + JSON.stringify(result, undefined, 2));

   const buildInfo = result.builds[0];
   const buildStatus = buildInfo.buildStatus;
   if (!buildStatus) throw Error('buildStatus not exist');

   switch (buildStatus) {
      case 'SUCCEEDED':
         return { IsComplete: true };
      case 'IN_PROGRESS':
      case 'STOPPED':
         return { IsComplete: false };
      case 'FAILED':
      case 'FAULT':
      case 'TIMED_OUT':
         throw Error('build error buildStatus: ' + buildStatus);
      default:
         throw Error('unknown buildStatus: ' + buildStatus);
   }
};

export { handler };
