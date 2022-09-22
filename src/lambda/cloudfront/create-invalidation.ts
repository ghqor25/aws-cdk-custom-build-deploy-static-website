import { CodePipelineEvent, CodePipelineHandler } from 'aws-lambda';
import { CloudFrontClient, CreateInvalidationCommand, CloudFrontServiceException } from '@aws-sdk/client-cloudfront';
import { CodePipelineClient, PutJobFailureResultCommand, PutJobSuccessResultCommand } from '@aws-sdk/client-codepipeline';

const cloudfrontClient = new CloudFrontClient({});
const codePipelineClient = new CodePipelineClient({});

const handler: CodePipelineHandler = async (event: CodePipelineEvent) => {
   const jobId = event['CodePipeline.job'].id;
   const userParams = JSON.parse(event['CodePipeline.job'].data.actionConfiguration.configuration.UserParameters);
   const distributionId = userParams['DISTRIBUTION_ID'] as string;
   if (!distributionId) throw Error('"DISTRIBUTION_ID" is required');
   console.log(jobId + '&&' + distributionId);

   try {
      const result = await cloudfrontClient.send(
         new CreateInvalidationCommand({
            DistributionId: distributionId,
            InvalidationBatch: { Paths: { Quantity: 1, Items: ['/*'] }, CallerReference: Date.now().toString() },
         }),
      );
      console.log('create invalidation result: ' + result.Invalidation?.Status);
   } catch (e) {
      if (e instanceof CloudFrontServiceException) {
         await codePipelineClient.send(new PutJobFailureResultCommand({ jobId, failureDetails: { type: 'JobFailed', message: e.message } }));
      } else throw Error('create invalidation failed' + e);
   }

   await codePipelineClient.send(new PutJobSuccessResultCommand({ jobId }));
};
export { handler };
