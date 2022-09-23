import { CloudFrontClient, GetInvalidationCommand } from '@aws-sdk/client-cloudfront';

const cloudfrontClient = new CloudFrontClient({});

const handler = async (event: any) => {
   const distributionId = event['DISTRIBUTION_ID'];
   if (!distributionId) throw Error('"DISTRIBUTION_ID" is required ');
   const invalidationId = event['INVALIDATION_ID'];
   if (!invalidationId) throw Error('"INVALIDATION_ID" is required ');

   const result = await cloudfrontClient.send(new GetInvalidationCommand({ DistributionId: distributionId, Id: invalidationId }));
   const status = result.Invalidation?.Status === 'Completed' ? 'SUCCEEDED' : undefined;

   return { status };
};
export { handler };
